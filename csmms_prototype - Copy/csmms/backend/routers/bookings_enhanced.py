"""
Enhanced Bookings Router with comprehensive validation for:
- Time conflict detection
- Daily capacity enforcement
- Blocked date checking
- Double booking prevention
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


# ─── Utility Functions ────────────────────────────────────────────────────────
def validate_booking_slot(db: Session, service_id: int, slot_id: int, student_id: int):
    """
    Comprehensive validation for booking a slot:
    - Slot exists and belongs to service
    - Slot is not blocked
    - Slot has capacity
    - No time conflicts
    - Daily capacity not exceeded
    - Date is not blocked
    """
    slot = db.query(models.ServiceSlot).filter(models.ServiceSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    if slot.service_id != service_id:
        raise HTTPException(status_code=400, detail="Slot does not belong to this service")
    
    if slot.is_blocked:
        raise HTTPException(status_code=400, detail="This slot is blocked by the provider")
    
    # Check if slot is full
    if slot.current_bookings >= slot.max_bookings:
        raise HTTPException(
            status_code=400,
            detail=f"Slot is full ({slot.current_bookings}/{slot.max_bookings} bookings)"
        )
    
    # Check for user's existing bookings on same slot
    duplicate = db.query(models.Booking).filter(
        models.Booking.student_id == student_id,
        models.Booking.slot_id == slot_id,
        models.Booking.status.in_([
            models.BookingStatus.pending,
            models.BookingStatus.approved
        ])
    ).first()
    
    if duplicate:
        raise HTTPException(status_code=400, detail="You already have a booking for this slot")
    
    # Check if date is blocked
    date_blocked = db.query(models.BlockedDate).filter(
        models.BlockedDate.service_id == service_id,
        models.BlockedDate.blocked_date == slot.slot_date,
    ).first()
    
    if date_blocked:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot book on this date: {date_blocked.reason or 'Date is blocked'}"
        )
    
    # Check daily capacity
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if service:
        daily_bookings = db.query(models.Booking).join(
            models.ServiceSlot,
            models.Booking.slot_id == models.ServiceSlot.id
        ).filter(
            models.Booking.service_id == service_id,
            models.ServiceSlot.slot_date == slot.slot_date,
            models.Booking.status.in_([
                models.BookingStatus.pending,
                models.BookingStatus.approved
            ])
        ).count()
        
        if daily_bookings >= service.max_capacity_per_day:
            raise HTTPException(
                status_code=400,
                detail=f"Daily capacity reached ({daily_bookings}/{service.max_capacity_per_day})",
            )
    
    return slot


# ─── Create Booking ───────────────────────────────────────────────────────────
@router.post("/", response_model=schemas.BookingOut, status_code=201)
def create_booking(
    payload: schemas.BookingCreate,
    db: Session = Depends(get_db),
):
    """
    Student books a service slot.
    Validates:
    - Service exists
    - Slot exists and belongs to service
    - No time/capacity conflicts
    - Date is not blocked
    """
    service = db.query(models.Service).filter(
        models.Service.id == payload.service_id
    ).first()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    student = db.query(models.User).filter(
        models.User.id == payload.student_id
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Validate slot
    slot = validate_booking_slot(
        db,
        payload.service_id,
        payload.slot_id,
        payload.student_id
    )
    
    # Create booking
    booking = models.Booking(
        student_id=payload.student_id,
        service_id=payload.service_id,
        slot_id=payload.slot_id,
        notes=payload.notes,
        status=models.BookingStatus.pending,
    )
    
    # Increment slot bookings
    slot.current_bookings += 1
    
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
    return booking


# ─── Get My Bookings ──────────────────────────────────────────────────────────
@router.get("/my", response_model=List[schemas.BookingOut])
def get_my_bookings(
    student_id: int = Query(...),
    status: models.BookingStatus = Query(None),
    db: Session = Depends(get_db),
):
    """Get bookings for a specific student."""
    q = db.query(models.Booking).filter(
        models.Booking.student_id == student_id
    )
    
    if status:
        q = q.filter(models.Booking.status == status)
    
    return q.order_by(models.Booking.created_at.desc()).all()


# ─── Get Provider Bookings ────────────────────────────────────────────────────
@router.get("/provider/{provider_id}", response_model=List[schemas.BookingOut])
def get_provider_bookings(
    provider_id: int,
    service_id: int = Query(None),
    status: models.BookingStatus = Query(None),
    date_from: date = Query(None),
    date_to: date = Query(None),
    db: Session = Depends(get_db),
):
    """Get all bookings for provider's services with filtering."""
    # Get provider's services
    services = db.query(models.Service).filter(
        models.Service.provider_id == provider_id
    ).all()
    service_ids = [s.id for s in services]
    
    if not service_ids:
        return []
    
    q = db.query(models.Booking).filter(
        models.Booking.service_id.in_(service_ids)
    )
    
    if service_id:
        q = q.filter(models.Booking.service_id == service_id)
    
    if status:
        q = q.filter(models.Booking.status == status)
    
    # Filter by slot date range
    if date_from or date_to:
        q = q.join(models.ServiceSlot, models.Booking.slot_id == models.ServiceSlot.id)
        if date_from:
            q = q.filter(models.ServiceSlot.slot_date >= date_from)
        if date_to:
            q = q.filter(models.ServiceSlot.slot_date <= date_to)
    
    return q.order_by(models.Booking.created_at.desc()).all()


# ─── Update Booking Status ────────────────────────────────────────────────────
@router.put("/{booking_id}/status", response_model=schemas.BookingOut)
def update_booking_status(
    booking_id: int,
    payload: schemas.BookingStatusUpdate,
    db: Session = Depends(get_db),
):
    """
    Update booking status.
    Validates status transitions and updates slot capacity accordingly.
    """
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    current_status = booking.status
    new_status = payload.status
    
    # Validate transitions
    valid_transitions = {
        models.BookingStatus.pending: [
            models.BookingStatus.approved,
            models.BookingStatus.cancelled,
        ],
        models.BookingStatus.approved: [
            models.BookingStatus.completed,
            models.BookingStatus.rescheduled,
            models.BookingStatus.cancelled,
        ],
        models.BookingStatus.rescheduled: [
            models.BookingStatus.approved,
            models.BookingStatus.cancelled,
        ],
        models.BookingStatus.completed: [],
        models.BookingStatus.cancelled: [],
    }
    
    if new_status not in valid_transitions.get(current_status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {current_status.value} to {new_status.value}",
        )
    
    # If cancelling, free up slot capacity
    if new_status == models.BookingStatus.cancelled and booking.slot_id:
        slot = db.query(models.ServiceSlot).filter(
            models.ServiceSlot.id == booking.slot_id
        ).first()
        if slot and slot.current_bookings > 0:
            slot.current_bookings -= 1
    
    booking.status = new_status
    booking.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(booking)
    
    return booking


# ─── Reschedule Booking ───────────────────────────────────────────────────────
@router.put("/{booking_id}/reschedule", response_model=schemas.BookingOut)
def reschedule_booking(
    booking_id: int,
    new_slot_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    Reschedule a booking to a different slot.
    Validates new slot availability and updates capacities.
    """
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status not in [models.BookingStatus.approved, models.BookingStatus.pending]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reschedule booking in {booking.status.value} status",
        )
    
    # Validate new slot
    new_slot = validate_booking_slot(
        db,
        booking.service_id,
        new_slot_id,
        booking.student_id,
    )
    
    # Free up old slot
    if booking.slot_id:
        old_slot = db.query(models.ServiceSlot).filter(
            models.ServiceSlot.id == booking.slot_id
        ).first()
        if old_slot and old_slot.current_bookings > 0:
            old_slot.current_bookings -= 1
    
    # Assign new slot
    new_slot.current_bookings += 1
    booking.slot_id = new_slot_id
    booking.reschedule_count += 1
    booking.status = models.BookingStatus.rescheduled
    booking.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(booking)
    
    return booking


# ─── Check Slot Availability ──────────────────────────────────────────────────
@router.get("/availability/{service_id}/{slot_id}", response_model=schemas.SlotAvailabilityStatus)
def check_slot_availability(
    service_id: int,
    slot_id: int,
    db: Session = Depends(get_db),
):
    """Check if a slot is available for booking."""
    slot = db.query(models.ServiceSlot).filter(
        models.ServiceSlot.id == slot_id
    ).first()
    
    if not slot or slot.service_id != service_id:
        return schemas.SlotAvailabilityStatus(
            is_available=False,
            reason="Slot not found",
        )
    
    if slot.is_blocked:
        return schemas.SlotAvailabilityStatus(
            is_available=False,
            reason="Slot blocked by provider",
        )
    
    # Check capacity
    available_slots = slot.max_bookings - slot.current_bookings
    if available_slots <= 0:
        return schemas.SlotAvailabilityStatus(
            is_available=False,
            reason="Slot at full capacity",
            available_slots=0,
            max_slots=slot.max_bookings,
        )
    
    # Check date block
    date_blocked = db.query(models.BlockedDate).filter(
        models.BlockedDate.service_id == service_id,
        models.BlockedDate.blocked_date == slot.slot_date,
    ).first()
    
    if date_blocked:
        return schemas.SlotAvailabilityStatus(
            is_available=False,
            reason=f"Date blocked: {date_blocked.reason or 'Provider unavailable'}",
        )
    
    # Check daily capacity
    service = db.query(models.Service).filter(
        models.Service.id == service_id
    ).first()
    
    if service:
        daily_bookings = db.query(models.Booking).join(
            models.ServiceSlot,
            models.Booking.slot_id == models.ServiceSlot.id
        ).filter(
            models.Booking.service_id == service_id,
            models.ServiceSlot.slot_date == slot.slot_date,
            models.Booking.status.in_([
                models.BookingStatus.pending,
                models.BookingStatus.approved
            ])
        ).count()
        
        if daily_bookings >= service.max_capacity_per_day:
            return schemas.SlotAvailabilityStatus(
                is_available=False,
                reason="Daily capacity reached",
            )
    
    return schemas.SlotAvailabilityStatus(
        is_available=True,
        available_slots=available_slots,
        max_slots=slot.max_bookings,
    )


# ─── Get Available Slots ──────────────────────────────────────────────────────
@router.get("/available/{service_id}", response_model=List[schemas.SlotOut])
def get_available_slots(
    service_id: int,
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
):
    """Get all available slots for a date range (considering capacity and blocks)."""
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be before to_date")
    
    service = db.query(models.Service).filter(
        models.Service.id == service_id
    ).first()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Get all slots in range
    slots = db.query(models.ServiceSlot).filter(
        models.ServiceSlot.service_id == service_id,
        models.ServiceSlot.slot_date >= from_date,
        models.ServiceSlot.slot_date <= to_date,
        models.ServiceSlot.is_blocked == False,
    ).all()
    
    # Get blocked dates
    blocked_dates = db.query(models.BlockedDate).filter(
        models.BlockedDate.service_id == service_id,
        models.BlockedDate.blocked_date >= from_date,
        models.BlockedDate.blocked_date <= to_date,
    ).all()
    blocked_date_set = {bd.blocked_date for bd in blocked_dates}
    
    # Filter for availability
    available = []
    for slot in slots:
        # Skip if date is blocked
        if slot.slot_date in blocked_date_set:
            continue
        
        # Skip if slot is full
        if slot.current_bookings >= slot.max_bookings:
            continue
        
        # Check daily capacity
        daily_bookings = db.query(models.Booking).join(
            models.ServiceSlot,
            models.Booking.slot_id == models.ServiceSlot.id
        ).filter(
            models.Booking.service_id == service_id,
            models.ServiceSlot.slot_date == slot.slot_date,
            models.Booking.status.in_([
                models.BookingStatus.pending,
                models.BookingStatus.approved
            ])
        ).count()
        
        if daily_bookings < service.max_capacity_per_day:
            available.append(slot)
    
    return sorted(available, key=lambda s: (s.slot_date, s.start_time))


# ─── Get Booking Details ──────────────────────────────────────────────────────
@router.get("/{booking_id}", response_model=schemas.BookingOut)
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific booking."""
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return booking


# ─── Cancel Booking ───────────────────────────────────────────────────────────
@router.delete("/{booking_id}", status_code=204)
def cancel_booking(booking_id: int, db: Session = Depends(get_db)):
    """Student cancels their booking."""
    booking = db.query(models.Booking).filter(
        models.Booking.id == booking_id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status == models.BookingStatus.completed:
        raise HTTPException(status_code=400, detail="Cannot cancel completed booking")
    
    if booking.status == models.BookingStatus.cancelled:
        raise HTTPException(status_code=400, detail="Booking already cancelled")
    
    # Free up slot capacity
    if booking.slot_id:
        slot = db.query(models.ServiceSlot).filter(
            models.ServiceSlot.id == booking.slot_id
        ).first()
        if slot and slot.current_bookings > 0:
            slot.current_bookings -= 1
    
    booking.status = models.BookingStatus.cancelled
    booking.updated_at = datetime.utcnow()
    
    db.commit()
