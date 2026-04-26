from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas.student_schema import StudentInput
from models.student_model import StudentAnalysis
from services.ai_service import analyze_student

router = APIRouter()

@router.post("/analyze-student")
def analyze_student_data(data: StudentInput, db: Session = Depends(get_db)):
    
    ai_result = analyze_student(data.marks_data)

    # Simple split (you can improve later)
    weakness = ai_result
    tutor = ai_result
    plan = ai_result

    new_entry = StudentAnalysis(
        student_name=data.student_name,
        marks_data=data.marks_data,
        weakness_summary=weakness,
        tutor_summary=tutor,
        study_plan=plan
    )

    db.add(new_entry)
    db.commit()

    return {
        "message": "Analysis Done",
        "data": ai_result
    }
