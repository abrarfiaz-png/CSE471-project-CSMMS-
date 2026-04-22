from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import date, datetime, timedelta

from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/slots", tags=["Slots"])


# ─── Utility Functions ────────────────────────────────────────────────────────
def check_time_overlap(start1, end1, start2, end2):
    """Check if two time ranges overlap."""
    return start1 < end2 and end1 > start2


def get_daily_capacity_info(db: Session, service_id: int, slot_date: date):
    """Get capacity information for a specific date."""
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        return None
    
    # Check if date is blocked
    is_blocked = db.query(models.BlockedDate).filter(
        models.BlockedDate.service_id == service_id,
        models.BlockedDate.blocked_date == slot_date,
    ).first() is not None
    
    # Count active bookings for the date
    booked_slots = db.query(models.ServiceSlot).filter(
        models.ServiceSlot.service_id == service_id,
        models.ServiceSlot.slot_date == slot_date,
    ).all()
    
    total_current_bookings = sum(slot.current_bookings for slot in booked_slots)
    
    return schemas.CapacityInfo(
        service_id=service_id,
        slot_date=slot_date,
        max_capacity=service.max_capacity_per_day,
        current_bookings=total_current_bookings,
        available_slots=max(0, service.max_capacity_per_day - total_current_bookings),
        is_full=total_current_bookings >= service.max_capacity_per_day,
        is_date_blocked=is_blocked,
    )


# ─── Get Slots for a Service ──────────────────────────────────────────────────
@router.get("/service/{service_id}", response_model=List[schemas.SlotOut])
def get_service_slots(
    service_id: int,
    from_date: date = Query(None),
    to_date: date = Query(None),
    available_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Get all slots for a service, optionally filtered by date range and availability."""
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    q = db.query(models.ServiceSlot).filter(
        models.ServiceSlot.service_id == service_id
    )
    
    if from_date:
        q = q.filter(models.ServiceSlot.slot_date >= from_date)
    if to_date:
        q = q.filter(models.ServiceSlot.slot_date <= to_date)
    
    if available_only:
        q = q.filter(
            models.ServiceSlot.is_blocked == False,
            models.ServiceSlot.current_bookings < models.ServiceSlot.max_bookings,
        )

    return q.order_by(models.ServiceSlot.slot_date, models.ServiceSlot.start_time).all()


# ─── Create Slot ──────────────────────────────────────────────────────────────
@router.post("/", response_model=schemas.SlotOut, status_code=201)
def create_slot(payload: schemas.SlotCreate, db: Session = Depends(get_db)):
    """Provider creates a new time slot with time conflict checking."""
    service = db.query(models.Service).filter(models.Service.id == payload.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Check if date is blocked
    date_blocked = db.query(models.BlockedDate).filter(
        models.BlockedDate.service_id == payload.service_id,
        models.BlockedDate.blocked_date == payload.slot_date,
    ).first()
    
    if date_blocked:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot create slot on blocked date: {date_blocked.reason or 'Date blocked by provider'}",
        )

    # Time conflict check with existing slots
    conflict = db.query(models.ServiceSlot).filter(
        models.ServiceSlot.service_id == payload.service_id,
        models.ServiceSlot.slot_date == payload.slot_date,
        models.ServiceSlot.start_time < payload.end_time,
        models.ServiceSlot.end_time > payload.start_time,
    ).first()

    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Time conflict with existing slot {conflict.start_time}–{conflict.end_time}",
        )

    # Check daily capacity
    daily_capacity = get_daily_capacity_info(db, payload.service_id, payload.slot_date)
    if daily_capacity and daily_capacity.is_full:
        raise HTTPException(
            status_code=400,
            detail="Daily capacity limit reached for this date",
        )

    slot = models.ServiceSlot(**payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


# ─── Bulk Create Slots for Date Range ──────────────────────────────────────────
@router.post("/bulk/", response_model=List[schemas.SlotOut], status_code=201)
def create_recurring_slots(
    service_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    start_time: str = Query(...),  # Format: "09:00"
    end_time: str = Query(...),     # Format: "10:00"
    max_bookings: int = Query(1, ge=1),
    db: Session = Depends(get_db),
):
    """Create recurring slots for a date range (bulk creation)."""
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    # Parse time strings
    try:
        from datetime import time as time_obj
        start_time_obj = time_obj.fromisoformat(start_time)
        end_time_obj = time_obj.fromisoformat(end_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format (use HH:MM)")

    if start_time_obj >= end_time_obj:
        raise HTTPException(status_code=400, detail="start_time must be before end_time")

    created_slots = []
    current_date = start_date

    while current_date <= end_date:
        # Skip blocked dates
        date_blocked = db.query(models.BlockedDate).filter(
            models.BlockedDate.service_id == service_id,
            models.BlockedDate.blocked_date == current_date,
        ).first()

        if not date_blocked:
            # Check for time conflicts
            conflict = db.query(models.ServiceSlot).filter(
                models.ServiceSlot.service_id == service_id,
                models.ServiceSlot.slot_date == current_date,
                models.ServiceSlot.start_time < end_time_obj,
                models.ServiceSlot.end_time > start_time_obj,
            ).first()

            if not conflict:
                slot = models.ServiceSlot(
                    service_id=service_id,
                    slot_date=current_date,
                    start_time=start_time_obj,
                    end_time=end_time_obj,
                    max_bookings=max_bookings,
                )
                db.add(slot)
                created_slots.append(slot)

        current_date += timedelta(days=1)

    db.commit()
    for slot in created_slots:
        db.refresh(slot)
    return created_slots


# ─── Block / Unblock Single Slot ──────────────────────────────────────────────
@router.patch("/{slot_id}/block", response_model=schemas.SlotOut)
def toggle_slot_block(slot_id: int, payload: schemas.SlotBlock, db: Session = Depends(get_db)):
    """Provider blocks or unblocks a slot."""
    slot = db.query(models.ServiceSlot).filter(models.ServiceSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    if payload.is_blocked and slot.current_bookings > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot block slot with active bookings"
        )
    
    slot.is_blocked = payload.is_blocked
    db.commit()
    db.refresh(slot)
    return slot


# ─── Block Date Range ────────────────────────────────────────────────────────
@router.post("/blocked-dates/", response_model=List[schemas.BlockedDateOut], status_code=201)
def block_date_range(
    service_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    reason: str = Query(None),
    db: Session = Depends(get_db),
):
    """Provider blocks a date range (e.g., for vacation, maintenance)."""
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    blocked_dates = []
    current_date = start_date

    while current_date <= end_date:
        # Check if already blocked
        existing = db.query(models.BlockedDate).filter(
            models.BlockedDate.service_id == service_id,
            models.BlockedDate.blocked_date == current_date,
        ).first()

        if not existing:
            # Check for bookings on this date
            conflicting_bookings = db.query(models.Booking).join(
                models.ServiceSlot,
                models.Booking.slot_id == models.ServiceSlot.id
            ).filter(
                models.Booking.service_id == service_id,
                models.ServiceSlot.slot_date == current_date,
                models.Booking.status.in_([models.BookingStatus.pending, models.BookingStatus.approved]),
            ).all()

            if conflicting_bookings:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot block {current_date}: has {len(conflicting_bookings)} active booking(s)",
                )

            blocked_date = models.BlockedDate(
                service_id=service_id,
                blocked_date=current_date,
                reason=reason,
            )
            db.add(blocked_date)
            blocked_dates.append(blocked_date)

        current_date += timedelta(days=1)

    db.commit()
    for bd in blocked_dates:
        db.refresh(bd)
    return blocked_dates


# ─── Unblock Single Date ──────────────────────────────────────────────────────
@router.delete("/blocked-dates/{blocked_date_id}", status_code=204)
def unblock_date(blocked_date_id: int, db: Session = Depends(get_db)):
    """Provider unblocks a previously blocked date."""
    blocked_date = db.query(models.BlockedDate).filter(
        models.BlockedDate.id == blocked_date_id
    ).first()
    
    if not blocked_date:
        raise HTTPException(status_code=404, detail="Blocked date not found")
    
    db.delete(blocked_date)
    db.commit()


# ─── Get Blocked Dates for Service ────────────────────────────────────────────
@router.get("/blocked-dates/{service_id}", response_model=List[schemas.BlockedDateOut])
def get_blocked_dates(
    service_id: int,
    from_date: date = Query(None),
    to_date: date = Query(None),
    db: Session = Depends(get_db),
):
    """Get all blocked dates for a service."""
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    q = db.query(models.BlockedDate).filter(
        models.BlockedDate.service_id == service_id
    )
    
    if from_date:
        q = q.filter(models.BlockedDate.blocked_date >= from_date)
    if to_date:
        q = q.filter(models.BlockedDate.blocked_date <= to_date)
    
    return q.order_by(models.BlockedDate.blocked_date).all()


# ─── Get Daily Capacity Info ──────────────────────────────────────────────────
@router.get("/capacity/{service_id}/{slot_date}", response_model=schemas.CapacityInfo)
def get_capacity_for_date(
    service_id: int,
    slot_date: date,
    db: Session = Depends(get_db),
):
    """Get capacity information for a specific date."""
    capacity = get_daily_capacity_info(db, service_id, slot_date)
    if capacity is None:
        raise HTTPException(status_code=404, detail="Service not found")
    return capacity


# ─── Delete Slot ──────────────────────────────────────────────────────────────
@router.delete("/{slot_id}", status_code=204)
def delete_slot(slot_id: int, db: Session = Depends(get_db)):
    """Provider deletes a slot (only if no active bookings)."""
    slot = db.query(models.ServiceSlot).filter(models.ServiceSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Don't allow deleting slots with active bookings
    active_bookings = db.query(models.Booking).filter(
        models.Booking.slot_id == slot_id,
        models.Booking.status.in_([models.BookingStatus.pending, models.BookingStatus.approved]),
    ).count()
    
    if active_bookings > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete slot with active bookings"
        )

    db.delete(slot)
    db.commit()


# ─── Update Slot ──────────────────────────────────────────────────────────────
@router.patch("/{slot_id}", response_model=schemas.SlotOut)
def update_slot(
    slot_id: int,
    max_bookings: int = Query(..., ge=1),
    db: Session = Depends(get_db),
):
    """Provider updates slot capacity."""
    slot = db.query(models.ServiceSlot).filter(models.ServiceSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    # Can't reduce capacity below current bookings
    if max_bookings < slot.current_bookings:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reduce capacity below current bookings ({slot.current_bookings})",
        )
    
    slot.max_bookings = max_bookings
    db.commit()
    db.refresh(slot)
    return slot
