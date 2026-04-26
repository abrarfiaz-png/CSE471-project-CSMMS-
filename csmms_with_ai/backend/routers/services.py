from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from app_models import Service, TimeSlot, Review, User, ServicePriority
from auth import get_current_user, require_role
from datetime import datetime
from collections import defaultdict

router = APIRouter()

class ServiceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    price_per_hour: float
    priority: ServicePriority = ServicePriority.medium
    max_daily_capacity: int = 5
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_name: Optional[str] = None
    cancellation_policy: Optional[str] = None
    tutor_id: Optional[int] = None

class SlotCreate(BaseModel):
    date: str
    start_time: str
    end_time: str

class ReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None


class ServicePriorityUpdate(BaseModel):
    priority: ServicePriority

@router.get("/")
def list_services(
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Service).filter(Service.is_active == True)
    if category:
        query = query.filter(Service.category == category)
    if keyword:
        query = query.filter(Service.title.ilike(f"%{keyword}%"))
    services = query.all()
    result = []
    for s in services:
        provider = db.query(User).filter(User.id == s.provider_id).first()
        reviews = db.query(Review).filter(Review.service_id == s.id).all()
        avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0
        result.append({
            "id": s.id, "title": s.title, "description": s.description,
            "category": s.category, "price_per_hour": s.price_per_hour,
            "priority": s.priority, "location_name": s.location_name,
            "location_lat": s.location_lat, "location_lng": s.location_lng,
            "provider_id": s.provider_id, "provider_name": provider.name if provider else "Unknown",
            "tutor_id": s.tutor_id,
            "tutor_name": s.tutor.name if s.tutor else None,
            "students_helped": s.students_helped, "completion_rate": s.completion_rate,
            "avg_rating": avg_rating, "review_count": len(reviews),
            "policy_validated": s.policy_validated, "policy_flagged": s.policy_flagged
        })
    return result


@router.get("/tutors")
def list_available_tutors(db: Session = Depends(get_db), current_user: User = Depends(require_role("provider", "admin"))):
    tutors = db.query(User).filter(User.role == "student", User.is_active == True).order_by(User.student_rating.desc()).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "email": t.email,
            "student_rating": round(t.student_rating or 0, 2),
            "ratings_received": t.ratings_received or 0,
        }
        for t in tutors
    ]

@router.post("/")
def create_service(
    data: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student", "admin"))
):
    provider_id = current_user.id
    tutor_id = data.tutor_id

    if current_user.role == "student":
        if data.category.lower() != "tutoring":
            raise HTTPException(status_code=400, detail="Students can only create tutoring services")
        tutor_id = current_user.id

    if current_user.role == "admin" and tutor_id:
        tutor = db.query(User).filter(User.id == tutor_id).first()
        if not tutor:
            raise HTTPException(status_code=400, detail="Assigned tutor not found")

    service = Service(
        title=data.title, description=data.description, category=data.category,
        price_per_hour=data.price_per_hour, priority=data.priority,
        max_daily_capacity=data.max_daily_capacity, location_lat=data.location_lat,
        location_lng=data.location_lng, location_name=data.location_name,
        cancellation_policy=data.cancellation_policy, provider_id=provider_id,
        tutor_id=tutor_id
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return {"id": service.id, "message": "Service created"}

@router.get("/my")
def my_services(db: Session = Depends(get_db), current_user: User = Depends(require_role("student", "provider", "admin"))):
    if current_user.role == "student":
        services = db.query(Service).filter(Service.tutor_id == current_user.id).all()
    else:
        services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    result = []
    for s in services:
        bookings = s.bookings
        earnings = sum(s.price_per_hour for b in bookings if b.status == "completed")
        result.append({
            "id": s.id, "title": s.title, "category": s.category,
            "price_per_hour": s.price_per_hour, "priority": s.priority,
            "tutor_id": s.tutor_id,
            "tutor_name": s.tutor.name if s.tutor else None,
            "students_helped": s.students_helped, "completion_rate": s.completion_rate,
            "total_bookings": len(bookings), "is_active": s.is_active,
            "policy_validated": s.policy_validated, "policy_flagged": s.policy_flagged
        })
    return result


@router.put("/{service_id}/priority")
def update_service_priority(
    service_id: int,
    data: ServicePriorityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    service = db.query(Service).filter(Service.id == service_id, Service.provider_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    service.priority = data.priority
    db.commit()
    return {"message": f"Priority updated to {data.priority}"}

@router.post("/{service_id}/slots")
def add_slot(
    service_id: int, data: SlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    service = db.query(Service).filter(Service.id == service_id, Service.provider_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    # Prevent overlapping slots on the same date for the same service.
    conflict = db.query(TimeSlot).filter(
        TimeSlot.service_id == service_id,
        TimeSlot.date == data.date,
        TimeSlot.start_time < data.end_time,
        TimeSlot.end_time > data.start_time
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail="Conflicting slot already exists")
    slot = TimeSlot(service_id=service_id, date=data.date, start_time=data.start_time, end_time=data.end_time)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return {"id": slot.id, "message": "Slot added"}

@router.get("/{service_id}/slots")
def get_slots(service_id: int, db: Session = Depends(get_db)):
    slots = db.query(TimeSlot).filter(TimeSlot.service_id == service_id).all()
    return [{"id": s.id, "date": s.date, "start_time": s.start_time, "end_time": s.end_time,
             "is_blocked": s.is_blocked, "is_booked": s.is_booked} for s in slots]

@router.put("/{service_id}/slots/{slot_id}/block")
def block_slot(
    service_id: int,
    slot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    service = db.query(Service).filter(Service.id == service_id, Service.provider_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id, TimeSlot.service_id == service_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_blocked = True
    db.commit()
    return {"message": "Slot blocked"}

@router.post("/{service_id}/reviews")
def add_review(service_id: int, data: ReviewCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    review = Review(author_id=current_user.id, service_id=service_id, rating=data.rating, comment=data.comment)
    db.add(review)
    db.commit()
    return {"message": "Review added"}

@router.get("/{service_id}/reviews")
def get_reviews(service_id: int, db: Session = Depends(get_db)):
    reviews = db.query(Review).filter(Review.service_id == service_id).all()
    result = []
    for r in reviews:
        author = db.query(User).filter(User.id == r.author_id).first()
        result.append({"id": r.id, "rating": r.rating, "comment": r.comment,
                       "author_name": author.name if author else "Anonymous",
                       "created_at": r.created_at.isoformat()})
    return result

@router.get("/analytics/provider")
def provider_analytics(db: Session = Depends(get_db), current_user: User = Depends(require_role("provider", "admin"))):
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    total_bookings = 0
    total_completed = 0
    total_cancelled = 0
    earnings = 0
    for s in services:
        for b in s.bookings:
            total_bookings += 1
            if b.status == "completed":
                total_completed += 1
                earnings += s.price_per_hour
            elif b.status == "cancelled":
                total_cancelled += 1
    return {
        "total_services": len(services),
        "total_bookings": total_bookings,
        "completed_bookings": total_completed,
        "cancelled_bookings": total_cancelled,
        "cancellation_ratio": round(total_cancelled / total_bookings * 100, 1) if total_bookings else 0,
        "estimated_earnings": earnings,
        "students_helped": sum(s.students_helped for s in services)
    }


@router.get("/analytics/report")
def provider_analytics_report(db: Session = Depends(get_db), current_user: User = Depends(require_role("provider", "admin"))):
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    service_ids = [s.id for s in services]
    bookings = []
    if service_ids:
        for s in services:
            bookings.extend(s.bookings)

    monthly = defaultdict(lambda: {"bookings": 0, "completed": 0, "cancelled": 0, "earnings": 0.0})
    history = []
    for b in sorted(bookings, key=lambda x: x.booked_at, reverse=True):
        service = next((s for s in services if s.id == b.service_id), None)
        month_key = b.booked_at.strftime("%Y-%m")
        monthly[month_key]["bookings"] += 1
        if b.status == "completed":
            monthly[month_key]["completed"] += 1
            monthly[month_key]["earnings"] += float(service.price_per_hour if service else 0)
        if b.status == "cancelled":
            monthly[month_key]["cancelled"] += 1
        history.append({
            "booking_id": b.id,
            "service_title": service.title if service else "N/A",
            "status": b.status,
            "booked_at": b.booked_at.isoformat(),
            "amount": float(service.price_per_hour if service else 0),
        })

    service_efficiency = []
    for s in services:
        total = len(s.bookings)
        completed = len([b for b in s.bookings if b.status == "completed"])
        cancelled = len([b for b in s.bookings if b.status == "cancelled"])
        efficiency = round((completed / total) * 100, 1) if total else 0.0
        service_efficiency.append({
            "service_id": s.id,
            "service_title": s.title,
            "priority": s.priority,
            "total_bookings": total,
            "completed_bookings": completed,
            "cancelled_bookings": cancelled,
            "efficiency_percent": efficiency,
        })

    monthly_summary = []
    for month in sorted(monthly.keys()):
        rec = monthly[month]
        monthly_summary.append({
            "month": month,
            "bookings": rec["bookings"],
            "completed": rec["completed"],
            "cancelled": rec["cancelled"],
            "earnings": round(rec["earnings"], 2),
        })

    return {
        "booking_history": history[:100],
        "service_efficiency": service_efficiency,
        "monthly_summary": monthly_summary,
    }
