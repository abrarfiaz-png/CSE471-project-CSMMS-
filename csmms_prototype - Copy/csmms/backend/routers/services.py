from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from app_models import Service, TimeSlot, Review, User, ServicePriority, BlockedDate, Booking, BookingStatus
from auth import get_current_user, require_role
from datetime import datetime, timedelta, date
from collections import defaultdict
import math

router = APIRouter()

# ─── Helper Functions ──────────────────────────────────────────────────────────
def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate distance between two geographic points using Haversine formula.
    Returns distance in kilometers.
    """
    if not all([lat1, lng1, lat2, lng2]):
        return None
    
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lng1_rad = math.radians(lng1)
    lat2_rad = math.radians(lat2)
    lng2_rad = math.radians(lng2)
    
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c


def build_service_response(service: Service, db: Session, distance_km: Optional[float] = None) -> dict:
    """Build standardized service response with provider and review info."""
    provider = db.query(User).filter(User.id == service.provider_id).first()
    reviews = db.query(Review).filter(Review.service_id == service.id).all()
    avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0
    
    response = {
        "id": service.id,
        "title": service.title,
        "description": service.description,
        "category": service.category,
        "price_per_hour": service.price_per_hour,
        "priority": service.priority,
        "location_name": service.location_name,
        "location_lat": service.location_lat,
        "location_lng": service.location_lng,
        "provider_id": service.provider_id,
        "provider_name": provider.name if provider else "Unknown",
        "tutor_id": service.tutor_id,
        "tutor_name": service.tutor.name if service.tutor else None,
        "students_helped": service.students_helped,
        "completion_rate": service.completion_rate,
        "average_rating": avg_rating,
        "review_count": len(reviews),
        "policy_validated": service.policy_validated,
        "policy_flagged": service.policy_flagged,
    }
    
    if distance_km is not None:
        response["distance_km"] = round(distance_km, 2)
    
    return response

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


class ServiceCapacityUpdate(BaseModel):
    max_daily_capacity: int


class SlotBlockUpdate(BaseModel):
    is_blocked: bool


class BlockDateCreate(BaseModel):
    date: str
    reason: Optional[str] = None

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
    result = [build_service_response(s, db) for s in services]
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


@router.get("/nearby")
def find_nearby_services(
    latitude: float,
    longitude: float,
    radius_km: float = 5.0,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Find services near a geographic location.
    
    Args:
        latitude: User's latitude
        longitude: User's longitude
        radius_km: Search radius in kilometers (default 5)
        category: Optional service category filter
    
    Returns:
        List of services within radius, sorted by distance
    """
    # Get all active services
    query = db.query(Service).filter(Service.is_active == True)
    
    if category:
        query = query.filter(Service.category == category)
    
    services = query.all()
    nearby_services = []
    
    for service in services:
        # Skip services without location data
        if not service.location_lat or not service.location_lng:
            continue
        
        # Calculate distance
        distance = calculate_distance_km(latitude, longitude, service.location_lat, service.location_lng)
        
        # Include if within radius
        if distance is not None and distance <= radius_km:
            service_data = build_service_response(service, db, distance)
            nearby_services.append(service_data)
    
    # Sort by distance
    nearby_services.sort(key=lambda x: x["distance_km"])
    
    return nearby_services


@router.post("/")
def create_service(
    data: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student", "provider", "admin"))
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
            "max_daily_capacity": s.max_daily_capacity,
            "tutor_id": s.tutor_id,
            "tutor_name": s.tutor.name if s.tutor else None,
            "students_helped": s.students_helped, "completion_rate": s.completion_rate,
            "total_bookings": len(bookings), "is_active": s.is_active,
            "cancellation_policy": s.cancellation_policy,
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


@router.put("/{service_id}/capacity")
def update_service_capacity(
    service_id: int,
    data: ServiceCapacityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    if data.max_daily_capacity < 1:
        raise HTTPException(status_code=400, detail="max_daily_capacity must be at least 1")
    service = db.query(Service).filter(Service.id == service_id, Service.provider_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    service.max_daily_capacity = data.max_daily_capacity
    db.commit()
    return {"message": f"Daily capacity updated to {data.max_daily_capacity}"}

@router.post("/{service_id}/slots")
def add_slot(
    service_id: int, data: SlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    service = db.query(Service).filter(Service.id == service_id, Service.provider_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    date_blocked = db.query(BlockedDate).filter(
        BlockedDate.service_id == service_id,
        BlockedDate.date == data.date,
    ).first()
    if date_blocked:
        raise HTTPException(status_code=400, detail="This date is blocked by provider")
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
    data: SlotBlockUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    service = db.query(Service).filter(Service.id == service_id, Service.provider_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id, TimeSlot.service_id == service_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_blocked = data.is_blocked
    db.commit()
    return {"message": "Slot updated", "is_blocked": slot.is_blocked}


@router.post("/{service_id}/blocked-dates")
def block_unavailable_date(
    service_id: int,
    data: BlockDateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    service = db.query(Service).filter(Service.id == service_id, Service.provider_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    exists = db.query(BlockedDate).filter(BlockedDate.service_id == service_id, BlockedDate.date == data.date).first()
    if exists:
        raise HTTPException(status_code=400, detail="Date already blocked")
    blocked = BlockedDate(service_id=service_id, date=data.date, reason=data.reason)
    db.add(blocked)
    db.commit()
    db.refresh(blocked)
    # Block existing slots for this date immediately.
    slots = db.query(TimeSlot).filter(TimeSlot.service_id == service_id, TimeSlot.date == data.date).all()
    for s in slots:
        s.is_blocked = True
    db.commit()
    return {"id": blocked.id, "date": blocked.date, "reason": blocked.reason}


@router.get("/{service_id}/blocked-dates")
def get_blocked_dates(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    service = db.query(Service).filter(Service.id == service_id, Service.provider_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    rows = db.query(BlockedDate).filter(BlockedDate.service_id == service_id).order_by(BlockedDate.date.asc()).all()
    return [{"id": r.id, "date": r.date, "reason": r.reason} for r in rows]


@router.delete("/{service_id}/blocked-dates/{blocked_date_id}")
def unblock_date(
    service_id: int,
    blocked_date_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    service = db.query(Service).filter(Service.id == service_id, Service.provider_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    row = db.query(BlockedDate).filter(BlockedDate.id == blocked_date_id, BlockedDate.service_id == service_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Blocked date not found")
    db.delete(row)
    db.commit()
    return {"message": "Blocked date removed"}

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


# ═══════════════════════════════════════════════════════════════════════════════
# ADVANCED ANALYTICS ENDPOINTS (NEW)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/analytics/earnings")
def earnings_breakdown(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin")),
    days: int = 90
):
    """Earnings breakdown by service, category, and over time"""
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    cutoff_date = datetime.now() - timedelta(days=days)
    
    total_earnings = 0
    by_service = []
    by_category = defaultdict(float)
    daily_earnings = defaultdict(float)
    
    for service in services:
        service_earnings = 0
        for booking in service.bookings:
            if booking.status == "completed" and booking.updated_at >= cutoff_date:
                service_earnings += service.price_per_hour
                total_earnings += service.price_per_hour
                by_category[service.category] += service.price_per_hour
                day_key = booking.updated_at.date().isoformat()
                daily_earnings[day_key] += service.price_per_hour
        
        if service_earnings > 0 or len([b for b in service.bookings if b.status == "completed"]):
            by_service.append({
                "service_id": service.id,
                "title": service.title,
                "category": service.category,
                "price_per_hour": service.price_per_hour,
                "earnings": service_earnings,
                "completed_count": len([b for b in service.bookings if b.status == "completed"])
            })
    
    daily_data = [
        {"date": date, "earnings": amount}
        for date, amount in sorted(daily_earnings.items())
    ]
    
    return {
        "total_earnings": round(total_earnings, 2),
        "by_service": sorted(by_service, key=lambda x: x["earnings"], reverse=True),
        "by_category": dict(sorted(by_category.items(), key=lambda x: x[1], reverse=True)),
        "daily_earnings": daily_data,
        "period_days": days
    }


@router.get("/analytics/booking-trends")
def booking_trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin")),
    days: int = 90
):
    """Booking trends over time - daily breakdown"""
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    cutoff_date = datetime.now() - timedelta(days=days)
    
    daily_stats = defaultdict(lambda: {"total": 0, "completed": 0, "cancelled": 0, "pending": 0})
    
    for service in services:
        for booking in service.bookings:
            if booking.booked_at >= cutoff_date:
                day_key = booking.booked_at.date().isoformat()
                daily_stats[day_key]["total"] += 1
                
                if booking.status == "completed":
                    daily_stats[day_key]["completed"] += 1
                elif booking.status == "cancelled":
                    daily_stats[day_key]["cancelled"] += 1
                elif booking.status == "pending":
                    daily_stats[day_key]["pending"] += 1
    
    trends = [
        {
            "date": date,
            **stats
        }
        for date, stats in sorted(daily_stats.items())
    ]
    
    return {
        "trends": trends,
        "period_days": days
    }


@router.get("/analytics/cancellation-analysis")
def cancellation_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin")),
    days: int = 90
):
    """Detailed cancellation analysis"""
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    cutoff_date = datetime.now() - timedelta(days=days)
    
    total_bookings = 0
    total_cancelled = 0
    cancelled_by_service = {}
    cancellation_by_month = defaultdict(lambda: {"total": 0, "cancelled": 0})
    cancellation_by_day_of_week = defaultdict(lambda: {"total": 0, "cancelled": 0})
    
    for service in services:
        service_total = 0
        service_cancelled = 0
        
        for booking in service.bookings:
            if booking.booked_at >= cutoff_date:
                total_bookings += 1
                service_total += 1
                
                if booking.status == "cancelled":
                    total_cancelled += 1
                    service_cancelled += 1
                
                month_key = booking.booked_at.strftime("%Y-%m")
                day_of_week = booking.booked_at.strftime("%A")
                
                cancellation_by_month[month_key]["total"] += 1
                cancellation_by_day_of_week[day_of_week]["total"] += 1
                
                if booking.status == "cancelled":
                    cancellation_by_month[month_key]["cancelled"] += 1
                    cancellation_by_day_of_week[day_of_week]["cancelled"] += 1
        
        if service_total > 0:
            cancelled_by_service[service.title] = {
                "total": service_total,
                "cancelled": service_cancelled,
                "rate": round((service_cancelled / service_total) * 100, 1)
            }
    
    monthly_breakdown = [
        {
            "month": month,
            "total": stats["total"],
            "cancelled": stats["cancelled"],
            "rate": round((stats["cancelled"] / stats["total"]) * 100, 1) if stats["total"] > 0 else 0
        }
        for month, stats in sorted(cancellation_by_month.items())
    ]
    
    dow_breakdown = [
        {
            "day": day,
            "total": stats["total"],
            "cancelled": stats["cancelled"],
            "rate": round((stats["cancelled"] / stats["total"]) * 100, 1) if stats["total"] > 0 else 0
        }
        for day, stats in cancellation_by_day_of_week.items()
    ]
    
    overall_rate = round((total_cancelled / total_bookings) * 100, 1) if total_bookings > 0 else 0
    
    return {
        "overall_cancellation_rate": overall_rate,
        "total_bookings": total_bookings,
        "total_cancelled": total_cancelled,
        "by_service": cancelled_by_service,
        "by_month": monthly_breakdown,
        "by_day_of_week": dow_breakdown,
        "period_days": days
    }


@router.get("/analytics/performance-insights")
def performance_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin")),
):
    """Deep performance insights for each service"""
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    
    service_insights = []
    
    for service in services:
        total_bookings = len(service.bookings)
        completed = len([b for b in service.bookings if b.status == "completed"])
        cancelled = len([b for b in service.bookings if b.status == "cancelled"])
        pending = len([b for b in service.bookings if b.status == "pending"])
        
        # Get reviews/ratings for this service
        reviews = db.query(Review).filter(Review.service_id == service.id).all()
        avg_rating = sum(r.rating for r in reviews) / len(reviews) if reviews else 0
        
        # Students helped by this service
        students_helped = service.students_helped
        
        # Calculate metrics
        completion_rate = (completed / total_bookings * 100) if total_bookings > 0 else 0
        cancellation_rate = (cancelled / total_bookings * 100) if total_bookings > 0 else 0
        
        # Get recent 7 days performance
        week_ago = datetime.now() - timedelta(days=7)
        week_bookings = [b for b in service.bookings if b.booked_at >= week_ago]
        week_completed = len([b for b in week_bookings if b.status == "completed"])
        
        service_insights.append({
            "service_id": service.id,
            "title": service.title,
            "category": service.category,
            "priority": service.priority,
            "price_per_hour": service.price_per_hour,
            "total_bookings": total_bookings,
            "completed": completed,
            "cancelled": cancelled,
            "pending": pending,
            "completion_rate": round(completion_rate, 1),
            "cancellation_rate": round(cancellation_rate, 1),
            "average_rating": round(avg_rating, 2),
            "review_count": len(reviews),
            "students_helped": students_helped,
            "week_completed": week_completed,
            "is_active": service.is_active
        })
    
    return {
        "services": sorted(service_insights, key=lambda x: x["completed"], reverse=True),
        "total_services": len(service_insights),
        "top_performing": sorted(service_insights, key=lambda x: x["completion_rate"], reverse=True)[:3]
    }


@router.get("/analytics/trend-comparison")
def trend_comparison(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin")),
):
    """Compare current month vs previous month trends"""
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    
    now = datetime.now()
    current_month_start = now.replace(day=1)
    previous_month_end = current_month_start - timedelta(days=1)
    previous_month_start = previous_month_end.replace(day=1)
    
    def get_month_stats(start_date, end_date):
        total_bookings = 0
        completed = 0
        cancelled = 0
        earnings = 0.0
        
        for service in services:
            for booking in service.bookings:
                if start_date <= booking.booked_at <= end_date:
                    total_bookings += 1
                    if booking.status == "completed":
                        completed += 1
                        earnings += service.price_per_hour
                    elif booking.status == "cancelled":
                        cancelled += 1
        
        return {
            "total_bookings": total_bookings,
            "completed": completed,
            "cancelled": cancelled,
            "earnings": round(earnings, 2),
            "completion_rate": round((completed / total_bookings * 100), 1) if total_bookings > 0 else 0,
            "cancellation_rate": round((cancelled / total_bookings * 100), 1) if total_bookings > 0 else 0
        }
    
    current_stats = get_month_stats(current_month_start, now)
    previous_stats = get_month_stats(previous_month_start, previous_month_end)
    
    # Calculate growth rates
    booking_growth = ((current_stats["total_bookings"] - previous_stats["total_bookings"]) / previous_stats["total_bookings"] * 100) if previous_stats["total_bookings"] > 0 else 0
    earnings_growth = ((current_stats["earnings"] - previous_stats["earnings"]) / previous_stats["earnings"] * 100) if previous_stats["earnings"] > 0 else 0
    
    return {
        "current_month": current_stats,
        "previous_month": previous_stats,
        "booking_growth_percent": round(booking_growth, 1),
        "earnings_growth_percent": round(earnings_growth, 1),
        "current_month_name": current_month_start.strftime("%B %Y"),
        "previous_month_name": previous_month_start.strftime("%B %Y")
    }


@router.get("/analytics/peak-analysis")
def peak_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin")),
    days: int = 30
):
    """Analyze peak booking hours and days"""
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    cutoff_date = datetime.now() - timedelta(days=days)
    
    hour_stats = defaultdict(lambda: {"count": 0, "completed": 0})
    day_of_week_stats = defaultdict(lambda: {"count": 0, "completed": 0})
    
    for service in services:
        for booking in service.bookings:
            if booking.booked_at >= cutoff_date:
                hour = booking.booked_at.hour
                day_of_week = booking.booked_at.strftime("%A")
                
                hour_stats[hour]["count"] += 1
                day_of_week_stats[day_of_week]["count"] += 1
                
                if booking.status == "completed":
                    hour_stats[hour]["completed"] += 1
                    day_of_week_stats[day_of_week]["completed"] += 1
    
    peak_hours = sorted(
        [{"hour": h, "bookings": s["count"], "completion_rate": round((s["completed"] / s["count"] * 100), 1)} 
         for h, s in hour_stats.items()],
        key=lambda x: x["bookings"],
        reverse=True
    )[:5]
    
    peak_days = sorted(
        [{"day": d, "bookings": s["count"], "completion_rate": round((s["completed"] / s["count"] * 100), 1)} 
         for d, s in day_of_week_stats.items()],
        key=lambda x: x["bookings"],
        reverse=True
    )
    
    return {
        "peak_hours": peak_hours,
        "peak_days": peak_days,
        "analysis_period_days": days
    }

