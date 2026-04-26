from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from app_models import Service, TimeSlot, Review, User, ServicePriority
from auth import get_current_user, require_role
from datetime import datetime, date
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
    def status_value(raw_status):
        if hasattr(raw_status, "value"):
            return str(raw_status.value)
        return str(raw_status)

    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    total_bookings = 0
    total_completed = 0
    total_cancelled = 0
    earnings = 0
    for s in services:
        for b in s.bookings:
            status = status_value(b.status)
            total_bookings += 1
            if status == "completed":
                total_completed += 1
                earnings += s.price_per_hour
            elif status == "cancelled":
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
def provider_analytics_report(
    months: int = Query(6, ge=1, le=36),
    history_limit: int = Query(100, ge=1, le=500),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    def status_value(raw_status):
        if hasattr(raw_status, "value"):
            return str(raw_status.value)
        return str(raw_status)

    def in_date_range(booked_at_dt: datetime) -> bool:
        booked_date = booked_at_dt.date()
        if start_date and booked_date < start_date:
            return False
        if end_date and booked_date > end_date:
            return False
        return True

    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    services_by_id = {s.id: s for s in services}

    bookings = []
    for service in services:
        bookings.extend(service.bookings)

    bookings = sorted(bookings, key=lambda b: b.booked_at, reverse=True)

    if start_date or end_date:
        bookings = [b for b in bookings if in_date_range(b.booked_at)]
    else:
        recent_month_keys = []
        for booking in bookings:
            month_key = booking.booked_at.strftime("%Y-%m")
            if month_key not in recent_month_keys:
                recent_month_keys.append(month_key)
            if len(recent_month_keys) >= months:
                break
        if recent_month_keys:
            bookings = [b for b in bookings if b.booked_at.strftime("%Y-%m") in recent_month_keys]

    filtered_booking_ids = {booking.id for booking in bookings}

    monthly = defaultdict(
        lambda: {
            "bookings": 0,
            "completed": 0,
            "cancelled": 0,
            "approved": 0,
            "pending": 0,
            "rescheduled": 0,
            "earnings": 0.0,
        }
    )

    totals = {
        "bookings": 0,
        "completed": 0,
        "cancelled": 0,
        "approved": 0,
        "pending": 0,
        "rescheduled": 0,
        "earnings": 0.0,
    }

    history = []
    for booking in bookings:
        service = services_by_id.get(booking.service_id)
        status = status_value(booking.status)
        month_key = booking.booked_at.strftime("%Y-%m")
        amount = float(service.price_per_hour if service else 0)

        monthly[month_key]["bookings"] += 1
        totals["bookings"] += 1

        if status == "completed":
            monthly[month_key]["completed"] += 1
            monthly[month_key]["earnings"] += amount
            totals["completed"] += 1
            totals["earnings"] += amount
        elif status == "cancelled":
            monthly[month_key]["cancelled"] += 1
            totals["cancelled"] += 1
        elif status == "approved":
            monthly[month_key]["approved"] += 1
            totals["approved"] += 1
        elif status == "pending":
            monthly[month_key]["pending"] += 1
            totals["pending"] += 1
        elif status == "rescheduled":
            monthly[month_key]["rescheduled"] += 1
            totals["rescheduled"] += 1

        history.append({
            "booking_id": booking.id,
            "service_id": booking.service_id,
            "service_title": service.title if service else "N/A",
            "student_id": booking.student_id,
            "student_name": booking.student.name if getattr(booking, "student", None) else "N/A",
            "slot_id": booking.slot_id,
            "status": status,
            "booked_at": booking.booked_at.isoformat(),
            "reschedule_count": booking.reschedule_count,
            "notes": booking.notes,
            "amount": amount,
        })

    service_efficiency = []
    for service in services:
        service_bookings = [
            booking for booking in service.bookings
            if booking.id in filtered_booking_ids
        ]

        total = len(service_bookings)
        completed = len([booking for booking in service_bookings if status_value(booking.status) == "completed"])
        cancelled = len([booking for booking in service_bookings if status_value(booking.status) == "cancelled"])
        pending = len([booking for booking in service_bookings if status_value(booking.status) == "pending"])
        avg_reschedule = round(
            sum(booking.reschedule_count or 0 for booking in service_bookings) / total,
            2
        ) if total else 0.0

        completion_rate = round((completed / total) * 100, 1) if total else 0.0
        cancellation_rate = round((cancelled / total) * 100, 1) if total else 0.0

        service_efficiency.append({
            "service_id": service.id,
            "service_title": service.title,
            "priority": str(service.priority.value) if hasattr(service.priority, "value") else str(service.priority),
            "total_bookings": total,
            "completed_bookings": completed,
            "cancelled_bookings": cancelled,
            "pending_bookings": pending,
            "avg_reschedule_count": avg_reschedule,
            "efficiency_percent": completion_rate,
            "completion_rate": completion_rate,
            "cancellation_rate": cancellation_rate,
        })

    service_efficiency.sort(key=lambda item: item["efficiency_percent"], reverse=True)

    monthly_summary = []
    for month in sorted(monthly.keys(), reverse=True):
        rec = monthly[month]
        bookings_count = rec["bookings"]
        monthly_summary.append({
            "month": month,
            "bookings": bookings_count,
            "completed": rec["completed"],
            "cancelled": rec["cancelled"],
            "approved": rec["approved"],
            "pending": rec["pending"],
            "rescheduled": rec["rescheduled"],
            "earnings": round(rec["earnings"], 2),
            "completion_rate": round((rec["completed"] / bookings_count) * 100, 1) if bookings_count else 0.0,
            "cancellation_rate": round((rec["cancelled"] / bookings_count) * 100, 1) if bookings_count else 0.0,
        })

    total_bookings = totals["bookings"]
    return {
        "report_name": "booking_performance_report",
        "generated_at": datetime.utcnow().isoformat(),
        "filters": {
            "months": months,
            "history_limit": history_limit,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
        },
        "summary": {
            "total_services": len(services),
            "total_bookings": total_bookings,
            "completed_bookings": totals["completed"],
            "cancelled_bookings": totals["cancelled"],
            "approved_bookings": totals["approved"],
            "pending_bookings": totals["pending"],
            "rescheduled_bookings": totals["rescheduled"],
            "completion_rate": round((totals["completed"] / total_bookings) * 100, 1) if total_bookings else 0.0,
            "cancellation_rate": round((totals["cancelled"] / total_bookings) * 100, 1) if total_bookings else 0.0,
            "estimated_earnings": round(totals["earnings"], 2),
        },
        "booking_history": history[:history_limit],
        "service_efficiency": service_efficiency,
        "monthly_summary": monthly_summary,
    }
