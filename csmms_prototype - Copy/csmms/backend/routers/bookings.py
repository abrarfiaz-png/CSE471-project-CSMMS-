from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from app_models import Booking, BookingStatus, TimeSlot, Service, User, Notification, StudentRating, BlockedDate
from auth import get_current_user, require_role
from datetime import datetime

router = APIRouter()

class BookingCreate(BaseModel):
    service_id: int
    slot_id: Optional[int] = None
    notes: Optional[str] = None

class RescheduleRequest(BaseModel):
    new_slot_id: int


class StudentRatingRequest(BaseModel):
    rating: int
    comment: Optional[str] = None

def add_notification(db: Session, user_id: int, title: str, message: str):
    n = Notification(user_id=user_id, title=title, message=message)
    db.add(n)

@router.post("/")
def create_booking(
    data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student"))
):
    service = db.query(Service).filter(Service.id == data.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    if not data.slot_id:
        raise HTTPException(status_code=400, detail="slot_id is required for booking")

    slot = None
    if data.slot_id:
        slot = db.query(TimeSlot).filter(TimeSlot.id == data.slot_id).first()
        if slot and slot.service_id != service.id:
            raise HTTPException(status_code=400, detail="Selected slot does not belong to this service")
        if not slot or slot.is_booked or slot.is_blocked:
            raise HTTPException(status_code=400, detail="Slot unavailable")

    if slot:
        blocked = db.query(BlockedDate).filter(
            BlockedDate.service_id == data.service_id,
            BlockedDate.date == slot.date,
        ).first()
        if blocked:
            raise HTTPException(status_code=400, detail="Selected date is blocked by provider")

        slot_occupied = db.query(Booking).filter(
            Booking.slot_id == slot.id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.approved, BookingStatus.rescheduled])
        ).first()
        if slot_occupied:
            raise HTTPException(status_code=400, detail="Slot already booked")

    # Enforce per-day capacity when a slot is selected.
    if slot:
        day_bookings = db.query(Booking).join(TimeSlot, Booking.slot_id == TimeSlot.id).filter(
            Booking.service_id == data.service_id,
            TimeSlot.date == slot.date,
            Booking.status.in_([BookingStatus.pending, BookingStatus.approved, BookingStatus.rescheduled])
        ).count()
        if day_bookings >= service.max_daily_capacity:
            raise HTTPException(status_code=400, detail="Service has reached maximum daily capacity for that date")

    booking = Booking(
        student_id=current_user.id, service_id=data.service_id,
        slot_id=data.slot_id, notes=data.notes
    )
    db.add(booking)
    slot.is_booked = True
    # Notify provider
    add_notification(db, service.provider_id, "New Booking", f"{current_user.name} booked {service.title}")
    add_notification(db, current_user.id, "Booking Submitted", f"Your booking for {service.title} is pending approval")
    db.commit()
    db.refresh(booking)
    return {"id": booking.id, "status": booking.status, "message": "Booking created"}

@router.get("/my")
def my_bookings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bookings = db.query(Booking).filter(Booking.student_id == current_user.id).order_by(Booking.booked_at.desc()).all()
    result = []
    for b in bookings:
        service = db.query(Service).filter(Service.id == b.service_id).first()
        provider = db.query(User).filter(User.id == service.provider_id).first() if service else None
        slot = db.query(TimeSlot).filter(TimeSlot.id == b.slot_id).first() if b.slot_id else None
        result.append({
            "id": b.id, "status": b.status, "notes": b.notes,
            "awaiting_tutor_approval": b.awaiting_tutor_approval,
            "service_id": b.service_id,
            "slot_id": b.slot_id,
            "service_title": service.title if service else "N/A",
            "tutor_name": service.tutor.name if service and service.tutor else None,
            "provider_name": provider.name if provider else "N/A",
            "slot_date": slot.date if slot else None,
            "slot_time": f"{slot.start_time} - {slot.end_time}" if slot else None,
            "booked_at": b.booked_at.isoformat(), "reschedule_count": b.reschedule_count
        })
    return result

@router.get("/provider")
def provider_bookings(db: Session = Depends(get_db), current_user: User = Depends(require_role("provider", "admin"))):
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    service_ids = [s.id for s in services]
    bookings = db.query(Booking).filter(Booking.service_id.in_(service_ids)).order_by(Booking.booked_at.desc()).all()
    result = []
    for b in bookings:
        student = db.query(User).filter(User.id == b.student_id).first()
        service = db.query(Service).filter(Service.id == b.service_id).first()
        slot = db.query(TimeSlot).filter(TimeSlot.id == b.slot_id).first() if b.slot_id else None
        result.append({
            "id": b.id, "status": b.status,
            "awaiting_tutor_approval": b.awaiting_tutor_approval,
            "student_name": student.name if student else "N/A",
            "student_rating": round(student.student_rating, 2) if student else 0,
            "service_title": service.title if service else "N/A",
            "tutor_name": service.tutor.name if service and service.tutor else None,
            "slot_date": slot.date if slot else None,
            "slot_time": f"{slot.start_time} - {slot.end_time}" if slot else None,
            "booked_at": b.booked_at.isoformat(), "notes": b.notes
        })
    return result


@router.get("/provider/pending")
def provider_pending_bookings(db: Session = Depends(get_db), current_user: User = Depends(require_role("provider"))):
    services = db.query(Service).filter(Service.provider_id == current_user.id).all()
    service_ids = [s.id for s in services]
    bookings = db.query(Booking).filter(
        Booking.service_id.in_(service_ids),
        Booking.status == BookingStatus.pending,
    ).order_by(Booking.booked_at.desc()).all()

    result = []
    for b in bookings:
        student = db.query(User).filter(User.id == b.student_id).first()
        service = db.query(Service).filter(Service.id == b.service_id).first()
        slot = db.query(TimeSlot).filter(TimeSlot.id == b.slot_id).first() if b.slot_id else None
        result.append({
            "id": b.id,
            "status": b.status,
            "awaiting_tutor_approval": b.awaiting_tutor_approval,
            "student_name": student.name if student else "N/A",
            "student_rating": round(student.student_rating, 2) if student else 0,
            "service_id": b.service_id,
            "service_title": service.title if service else "N/A",
            "slot_id": b.slot_id,
            "slot_date": slot.date if slot else None,
            "slot_time": f"{slot.start_time} - {slot.end_time}" if slot else None,
            "booked_at": b.booked_at.isoformat(),
            "notes": b.notes,
        })
    return result


@router.get("/tutor/pending")
def tutor_pending_bookings(db: Session = Depends(get_db), current_user: User = Depends(require_role("student"))):
    bookings = db.query(Booking).join(Service, Booking.service_id == Service.id).filter(
        Service.tutor_id == current_user.id,
        Booking.awaiting_tutor_approval == True,
        Booking.status == BookingStatus.pending,
    ).order_by(Booking.booked_at.desc()).all()

    result = []
    for b in bookings:
        service = db.query(Service).filter(Service.id == b.service_id).first()
        student = db.query(User).filter(User.id == b.student_id).first()
        slot = db.query(TimeSlot).filter(TimeSlot.id == b.slot_id).first() if b.slot_id else None
        result.append({
            "id": b.id,
            "status": b.status,
            "student_name": student.name if student else "N/A",
            "student_rating": round(student.student_rating, 2) if student else 0,
            "service_title": service.title if service else "N/A",
            "slot_date": slot.date if slot else None,
            "slot_time": f"{slot.start_time} - {slot.end_time}" if slot else None,
            "booked_at": b.booked_at.isoformat(),
            "notes": b.notes,
        })
    return result


@router.get("/tutor/completed-to-rate")
def tutor_completed_to_rate(db: Session = Depends(get_db), current_user: User = Depends(require_role("student"))):
    rated_booking_ids = [r.booking_id for r in db.query(StudentRating).filter(StudentRating.tutor_id == current_user.id).all()]
    query = db.query(Booking).join(Service, Booking.service_id == Service.id).filter(
        Service.tutor_id == current_user.id,
        Booking.status == BookingStatus.completed,
    )
    if rated_booking_ids:
        query = query.filter(~Booking.id.in_(rated_booking_ids))
    bookings = query.order_by(Booking.booked_at.desc()).all()

    result = []
    for b in bookings:
        service = db.query(Service).filter(Service.id == b.service_id).first()
        student = db.query(User).filter(User.id == b.student_id).first()
        result.append({
            "id": b.id,
            "student_id": b.student_id,
            "student_name": student.name if student else "N/A",
            "student_rating": round(student.student_rating, 2) if student else 0,
            "service_title": service.title if service else "N/A",
            "booked_at": b.booked_at.isoformat(),
        })
    return result

@router.put("/{booking_id}/status")
def update_booking_status(
    booking_id: int,
    status: BookingStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("provider", "admin"))
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    service = db.query(Service).filter(Service.id == booking.service_id).first()
    if not service or service.provider_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only manage bookings for your own services")

    allowed = {
        BookingStatus.approved,
        BookingStatus.completed,
        BookingStatus.cancelled,
    }
    if status not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported status transition")

    if status == BookingStatus.completed and booking.status not in [BookingStatus.approved, BookingStatus.rescheduled]:
        raise HTTPException(status_code=400, detail="Only approved/rescheduled bookings can be completed")

    if status == BookingStatus.approved and booking.status != BookingStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending bookings can be approved")

    if status == BookingStatus.approved:
        if booking.slot_id:
            already_reserved = db.query(Booking).filter(
                Booking.id != booking.id,
                Booking.slot_id == booking.slot_id,
                Booking.status == BookingStatus.approved,
            ).first()
            if already_reserved:
                raise HTTPException(status_code=400, detail="This slot already has an approved booking")

        if not service.tutor_id:
            # Backward compatibility for services with no assigned tutor.
            booking.status = BookingStatus.approved
        else:
            booking.status = BookingStatus.pending
            booking.awaiting_tutor_approval = True
            booking.selected_by_provider = True
            add_notification(db, booking.student_id, "Shortlisted", "You were shortlisted and forwarded to tutor approval")
            add_notification(db, service.tutor_id, "Tutor Approval Needed", f"Please review booking #{booking.id} for {service.title}")
            db.commit()
            return {"message": "Booking forwarded to tutor for final approval"}

    if status == BookingStatus.cancelled and booking.slot_id:
        old_slot = db.query(TimeSlot).filter(TimeSlot.id == booking.slot_id).first()
        if old_slot:
            remaining = db.query(Booking).filter(
                Booking.id != booking.id,
                Booking.slot_id == old_slot.id,
                Booking.status.in_([BookingStatus.pending, BookingStatus.approved, BookingStatus.rescheduled])
            ).count()
            old_slot.is_booked = remaining > 0

    booking.status = status
    booking.awaiting_tutor_approval = False
    if status == BookingStatus.completed:
        if service:
            service.students_helped += 1
    add_notification(db, booking.student_id, "Booking Update", f"Your booking status changed to {status}")
    db.commit()
    return {"message": f"Status updated to {status}"}


@router.put("/{booking_id}/tutor-decision")
def tutor_decision(
    booking_id: int,
    approve: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student"))
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    service = db.query(Service).filter(Service.id == booking.service_id).first()
    if not service or service.tutor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only assigned tutor can make this decision")

    if not booking.awaiting_tutor_approval or booking.status != BookingStatus.pending:
        raise HTTPException(status_code=400, detail="Booking is not waiting for tutor approval")

    booking.awaiting_tutor_approval = False
    if approve:
        booking.status = BookingStatus.approved
        if booking.slot_id:
            slot = db.query(TimeSlot).filter(TimeSlot.id == booking.slot_id).first()
            if slot:
                slot.is_booked = True

            competing = db.query(Booking).filter(
                Booking.id != booking.id,
                Booking.slot_id == booking.slot_id,
                Booking.status == BookingStatus.pending,
            ).all()
            for other in competing:
                other.status = BookingStatus.cancelled
                other.awaiting_tutor_approval = False
                add_notification(db, other.student_id, "Slot Not Selected", f"Your booking #{other.id} was not selected for this slot")

        add_notification(db, booking.student_id, "Tutor Approved", f"Your booking #{booking.id} was approved by tutor")
        add_notification(db, service.provider_id, "Tutor Decision", f"Tutor approved booking #{booking.id}")
        db.commit()
        return {"message": "Booking approved by tutor"}

    booking.status = BookingStatus.cancelled
    if booking.slot_id:
        slot = db.query(TimeSlot).filter(TimeSlot.id == booking.slot_id).first()
        if slot:
            remaining = db.query(Booking).filter(
                Booking.id != booking.id,
                Booking.slot_id == slot.id,
                Booking.status.in_([BookingStatus.pending, BookingStatus.approved, BookingStatus.rescheduled])
            ).count()
            slot.is_booked = remaining > 0
    add_notification(db, booking.student_id, "Tutor Rejected", f"Your booking #{booking.id} was rejected by tutor")
    add_notification(db, service.provider_id, "Tutor Decision", f"Tutor rejected booking #{booking.id}")
    db.commit()
    return {"message": "Booking rejected by tutor"}


@router.post("/{booking_id}/rate-student")
def rate_student(
    booking_id: int,
    data: StudentRatingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student"))
):
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    service = db.query(Service).filter(Service.id == booking.service_id).first()
    if not service or service.tutor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only assigned tutor can rate this student")

    if booking.status != BookingStatus.completed:
        raise HTTPException(status_code=400, detail="Student can only be rated after completion")

    existing = db.query(StudentRating).filter(StudentRating.booking_id == booking_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already rated for this booking")

    rating = StudentRating(
        booking_id=booking.id,
        student_id=booking.student_id,
        tutor_id=current_user.id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(rating)

    student = db.query(User).filter(User.id == booking.student_id).first()
    if student:
        total_score = (student.student_rating or 0) * (student.ratings_received or 0) + data.rating
        student.ratings_received = (student.ratings_received or 0) + 1
        student.student_rating = round(total_score / student.ratings_received, 2)

    add_notification(db, booking.student_id, "New Student Rating", f"You received a rating of {data.rating}/5")
    db.commit()
    return {"message": "Student rated successfully"}


@router.get("/my/progress")
def my_progress(db: Session = Depends(get_db), current_user: User = Depends(require_role("student"))):
    bookings = db.query(Booking).filter(Booking.student_id == current_user.id).all()
    taken = len(bookings)
    completed = len([b for b in bookings if b.status == BookingStatus.completed])
    completion_percent = round((completed / taken) * 100, 1) if taken else 0.0
    return {
        "taken_services": taken,
        "completed_services": completed,
        "completion_percent": completion_percent,
        "student_rating": round(current_user.student_rating or 0, 2),
        "ratings_received": current_user.ratings_received or 0,
    }


@router.get("/my/ratings")
def my_rating_history(db: Session = Depends(get_db), current_user: User = Depends(require_role("student"))):
    ratings = db.query(StudentRating).filter(StudentRating.student_id == current_user.id).order_by(StudentRating.created_at.desc()).all()
    result = []
    for r in ratings:
        tutor = db.query(User).filter(User.id == r.tutor_id).first()
        booking = db.query(Booking).filter(Booking.id == r.booking_id).first()
        service = db.query(Service).filter(Service.id == booking.service_id).first() if booking else None
        result.append({
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "tutor_name": tutor.name if tutor else "N/A",
            "service_title": service.title if service else "N/A",
            "created_at": r.created_at.isoformat(),
        })
    return result

@router.put("/{booking_id}/cancel")
def cancel_my_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student"))
):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.student_id == current_user.id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != BookingStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending bookings can be cancelled by student")

    booking.status = BookingStatus.cancelled
    if booking.slot_id:
        old_slot = db.query(TimeSlot).filter(TimeSlot.id == booking.slot_id).first()
        if old_slot:
            remaining = db.query(Booking).filter(
                Booking.id != booking.id,
                Booking.slot_id == old_slot.id,
                Booking.status.in_([BookingStatus.pending, BookingStatus.approved, BookingStatus.rescheduled])
            ).count()
            old_slot.is_booked = remaining > 0

    service = db.query(Service).filter(Service.id == booking.service_id).first()
    if service:
        add_notification(db, service.provider_id, "Booking Cancelled", f"{current_user.name} cancelled a booking for {service.title}")
    add_notification(db, current_user.id, "Booking Cancelled", "Your pending booking has been cancelled")
    db.commit()
    return {"message": "Booking cancelled"}

@router.put("/{booking_id}/reschedule")
def reschedule_booking(
    booking_id: int,
    data: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student"))
):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.student_id == current_user.id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status == BookingStatus.cancelled:
        raise HTTPException(status_code=400, detail="Cancelled bookings cannot be rescheduled")
    service = db.query(Service).filter(Service.id == booking.service_id).first()
    max_reschedules = 2
    if booking.reschedule_count >= max_reschedules:
        raise HTTPException(status_code=400, detail="Maximum reschedule limit reached")
    # Free old slot
    if booking.slot_id:
        old_slot = db.query(TimeSlot).filter(TimeSlot.id == booking.slot_id).first()
        if old_slot:
            old_slot.is_booked = False
    # Book new slot
    new_slot = db.query(TimeSlot).filter(TimeSlot.id == data.new_slot_id, TimeSlot.service_id == booking.service_id).first()
    if not new_slot or new_slot.is_booked or new_slot.is_blocked:
        raise HTTPException(status_code=400, detail="New slot unavailable")
    blocked = db.query(BlockedDate).filter(
        BlockedDate.service_id == booking.service_id,
        BlockedDate.date == new_slot.date,
    ).first()
    if blocked:
        raise HTTPException(status_code=400, detail="New slot date is blocked by provider")
    slot_occupied = db.query(Booking).filter(
        Booking.id != booking.id,
        Booking.slot_id == new_slot.id,
        Booking.status.in_([BookingStatus.pending, BookingStatus.approved, BookingStatus.rescheduled])
    ).first()
    if slot_occupied:
        raise HTTPException(status_code=400, detail="New slot already booked")
    day_bookings = db.query(Booking).join(TimeSlot, Booking.slot_id == TimeSlot.id).filter(
        Booking.id != booking.id,
        Booking.service_id == booking.service_id,
        TimeSlot.date == new_slot.date,
        Booking.status.in_([BookingStatus.pending, BookingStatus.approved, BookingStatus.rescheduled])
    ).count()
    if service and day_bookings >= service.max_daily_capacity:
        raise HTTPException(status_code=400, detail="Service has reached maximum daily capacity for that date")
    new_slot.is_booked = True
    booking.slot_id = data.new_slot_id
    booking.status = BookingStatus.rescheduled
    booking.reschedule_count += 1
    add_notification(db, service.provider_id, "Reschedule Request", f"Booking #{booking_id} was rescheduled")
    db.commit()
    return {"message": "Booking rescheduled"}
