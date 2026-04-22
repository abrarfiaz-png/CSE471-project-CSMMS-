from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from app_models import User, Service, Booking, Item, AILog, Notification
from auth import require_role

router = APIRouter()

@router.get("/dashboard")
def admin_dashboard(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    total_users = db.query(User).count()
    total_services = db.query(Service).count()
    total_bookings = db.query(Booking).count()
    total_items = db.query(Item).count()
    flagged_policies = db.query(Service).filter(Service.policy_flagged == True).count()
    ai_logs = db.query(AILog).count()
    return {
        "total_users": total_users,
        "total_services": total_services,
        "total_bookings": total_bookings,
        "total_items": total_items,
        "flagged_policies": flagged_policies,
        "ai_logs": ai_logs
    }

@router.get("/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role,
             "is_active": u.is_active, "created_at": u.created_at.isoformat()} for u in users]

@router.put("/users/{user_id}/toggle")
def toggle_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}"}

@router.get("/flagged-policies")
def flagged_policies(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    services = db.query(Service).filter(Service.policy_flagged == True).all()
    result = []
    for s in services:
        provider = db.query(User).filter(User.id == s.provider_id).first()
        result.append({
            "id": s.id, "title": s.title,
            "provider_name": provider.name if provider else "Unknown",
            "cancellation_policy": s.cancellation_policy,
            "policy_flagged": s.policy_flagged
        })
    return result

@router.put("/services/{service_id}/approve-policy")
def approve_policy(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    service.policy_flagged = False
    service.policy_validated = True
    db.commit()
    return {"message": "Policy approved"}

@router.get("/ai-logs")
def ai_logs(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    logs = db.query(AILog).order_by(AILog.created_at.desc()).limit(100).all()
    return [{"id": l.id, "user_id": l.user_id, "action_type": l.action_type,
             "input_summary": l.input_summary, "output_summary": l.output_summary,
             "flagged": l.flagged, "created_at": l.created_at.isoformat()} for l in logs]

@router.get("/overbooking-monitor")
def overbooking_monitor(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    services = db.query(Service).all()
    result = []
    for s in services:
        active_bookings = db.query(Booking).filter(
            Booking.service_id == s.id,
            Booking.status.in_(["pending", "approved"])
        ).count()
        result.append({
            "service_id": s.id, "service_title": s.title,
            "max_capacity": s.max_daily_capacity,
            "active_bookings": active_bookings,
            "is_over_capacity": active_bookings >= s.max_daily_capacity
        })
    return result
