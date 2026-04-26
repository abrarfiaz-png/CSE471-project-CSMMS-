from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from app_models import User, AILog
from auth import get_current_user
import os, base64
from openai import OpenAI

router = APIRouter()

def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    return OpenAI(api_key=api_key)

class PolicyValidationRequest(BaseModel):
    policy_text: str
    service_id: int

class ChatRequest(BaseModel):
    message: str
    context: str = "general"

def log_ai_action(db: Session, user_id: int, action: str, input_summary: str, output_summary: str, flagged: bool = False):
    log = AILog(user_id=user_id, action_type=action, input_summary=input_summary,
                output_summary=output_summary, flagged=flagged)
    db.add(log)
    db.commit()

@router.post("/analyze-marksheet")
async def analyze_marksheet(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = get_openai_client()
    if not client:
        # Demo mode without API key
        return {
            "weak_subjects": ["Mathematics", "Physics"],
            "strong_subjects": ["English", "Chemistry"],
            "performance_trends": "Declining in STEM subjects over last 3 semesters",
            "weakness_summary": "Student shows consistent weakness in quantitative subjects. Recommend focused tutoring in Mathematics and Physics.",
            "recommended_focus": ["Calculus", "Mechanics", "Statistics"],
            "suggested_study_plan": "3 hours/week Mathematics, 2 hours/week Physics, weekly tutor sessions",
            "note": "Demo mode - configure OPENAI_API_KEY for real AI analysis"
        }
    try:
        content = await file.read()
        b64 = base64.b64encode(content).decode()
        media_type = file.content_type or "image/jpeg"
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}},
                    {"type": "text", "text": """Analyze this student mark sheet. Extract:
                    1. Subject-wise marks
                    2. Weak subjects (below 60%)
                    3. Strong subjects (above 75%)
                    4. Performance trends
                    5. Weakness summary
                    6. Recommended focus areas
                    7. Suggested study plan
                    Return as JSON with keys: weak_subjects, strong_subjects, performance_trends, weakness_summary, recommended_focus, suggested_study_plan"""}
                ]
            }],
            max_tokens=800
        )
        import json
        text = response.choices[0].message.content
        try:
            result = json.loads(text.strip("```json\n").strip("```"))
        except:
            result = {"raw_analysis": text}
        log_ai_action(db, current_user.id, "marksheet_analysis", f"File: {file.filename}", str(result)[:200])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

@router.post("/validate-policy")
def validate_policy(
    data: PolicyValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = get_openai_client()
    if not client:
        # Demo mode
        flagged = any(word in data.policy_text.lower() for word in ["discriminate", "ban", "illegal", "harmful"])
        return {
            "is_valid": not flagged,
            "flagged": flagged,
            "issues": ["Contains potentially discriminatory language"] if flagged else [],
            "suggestions": "Review policy for inclusive and fair language" if flagged else "Policy looks good",
            "note": "Demo mode - configure OPENAI_API_KEY for real AI validation"
        }
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "system",
                "content": "You are a policy compliance checker for a university platform. Analyze service provider policies for discrimination, inappropriate rules, unethical restrictions, or harmful statements. Return JSON with: is_valid (bool), flagged (bool), issues (list), suggestions (string)."
            }, {
                "role": "user",
                "content": f"Check this service policy: {data.policy_text}"
            }],
            max_tokens=400
        )
        import json
        text = response.choices[0].message.content
        try:
            result = json.loads(text.strip("```json\n").strip("```"))
        except:
            result = {"is_valid": True, "flagged": False, "issues": [], "suggestions": text}
        # Update service policy status
        from app_models import Service
        service = db.query(Service).filter(Service.id == data.service_id).first()
        if service:
            service.policy_validated = True
            service.policy_flagged = result.get("flagged", False)
            db.commit()
        log_ai_action(db, current_user.id, "policy_validation", data.policy_text[:100],
                      str(result)[:200], flagged=result.get("flagged", False))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Policy validation failed: {str(e)}")

@router.post("/chat")
def chatbot(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client = get_openai_client()
    if not client:
        return {
            "response": "Hi! I'm the CSMMS AI Assistant. I can help you find tutors, services, items on the marketplace, and answer questions about campus resources. Configure your OPENAI_API_KEY to enable full AI capabilities.",
            "note": "Demo mode"
        }
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "system",
                "content": "You are a helpful assistant for the Campus Service & Marketplace Management System (CSMMS). Help students find services, tutors, items for sale, and navigate the platform."
            }, {
                "role": "user", "content": data.message
            }],
            max_tokens=400
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs")
def get_ai_logs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    logs = db.query(AILog).order_by(AILog.created_at.desc()).limit(50).all()
    return [{"id": l.id, "user_id": l.user_id, "action_type": l.action_type,
             "flagged": l.flagged, "created_at": l.created_at.isoformat()} for l in logs]
