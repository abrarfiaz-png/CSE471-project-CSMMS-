from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from database import get_db
import app_models as models
import schemas

router = APIRouter(prefix="/api/slots", tags=["Slots"])


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
    """Provider creates a new time slot. Checks for time conflicts."""
    service = db.query(models.Service).filter(models.Service.id == payload.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Time conflict check
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

    slot = models.ServiceSlot(**payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


# ─── Block / Unblock Slot ─────────────────────────────────────────────────────
@router.patch("/{slot_id}/block", response_model=schemas.SlotOut)
def toggle_slot_block(slot_id: int, payload: schemas.SlotBlock, db: Session = Depends(get_db)):
    """Provider blocks or unblocks a slot (unavailable date handling)."""
    slot = db.query(models.ServiceSlot).filter(models.ServiceSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_blocked = payload.is_blocked
    db.commit()
    db.refresh(slot)
    return slot


# ─── Delete Slot ──────────────────────────────────────────────────────────────
@router.delete("/{slot_id}", status_code=204)
def delete_slot(slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(models.ServiceSlot).filter(models.ServiceSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Don't allow deleting slots with active bookings
    active_bookings = db.query(models.Booking).filter(
        models.Booking.slot_id == slot_id,
        models.Booking.status.in_([models.BookingStatus.pending, models.BookingStatus.approved]),
    ).count()
    if active_bookings > 0:
        raise HTTPException(status_code=400, detail="Cannot delete slot with active bookings")

    db.delete(slot)
    db.commit()
