"""
Module 1 (Member 3): Slot Management + Overbooking Prevention
Free/Open-source friendly implementation (no paid OpenAI key required).

What this file provides:
1) Time-slot conflict detection
2) Capacity and resource-based overbooking prevention
3) Optional FastAPI router for demo/use in the project
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from fastapi import APIRouter
from pydantic import BaseModel


@dataclass
class SlotRecord:
    slot_id: str
    date: str
    start_time: str
    end_time: str
    is_blocked: bool = False
    resource_required: int = 1


@dataclass
class SlotEvaluationResult:
    has_time_conflict: bool
    conflict_pairs: list[str]
    exceeds_daily_capacity: bool
    exceeds_resource_limit: bool
    can_accept_new_booking: bool
    blocked_recommendations: list[str]


def _parse_time(value: str) -> datetime:
    return datetime.strptime(value, "%H:%M")


def evaluate_slots(
    slots: list[SlotRecord],
    max_daily_capacity: int,
    available_resources: int,
    requested_bookings_for_day: int,
) -> SlotEvaluationResult:
    """Evaluate slot schedule for overlap and overbooking risk."""
    active_slots = [s for s in slots if not s.is_blocked]

    conflict_pairs: list[str] = []
    grouped: dict[str, list[SlotRecord]] = {}
    for slot in active_slots:
        grouped.setdefault(slot.date, []).append(slot)

    for day_slots in grouped.values():
        sorted_slots = sorted(day_slots, key=lambda x: _parse_time(x.start_time))
        for idx in range(len(sorted_slots) - 1):
            a = sorted_slots[idx]
            b = sorted_slots[idx + 1]
            if _parse_time(a.end_time) > _parse_time(b.start_time):
                conflict_pairs.append(f"{a.slot_id} overlaps {b.slot_id}")

    exceeds_daily_capacity = requested_bookings_for_day > max_daily_capacity
    total_resource_need = sum(s.resource_required for s in active_slots)
    exceeds_resource_limit = total_resource_need > available_resources

    blocked_recommendations: list[str] = []
    if conflict_pairs:
        blocked_recommendations.append("Resolve overlapping slot times before accepting bookings.")
    if exceeds_daily_capacity:
        blocked_recommendations.append("Increase capacity or reject extra booking requests for this date.")
    if exceeds_resource_limit:
        blocked_recommendations.append("Not enough resources available; block low-priority slots.")

    can_accept_new_booking = not (conflict_pairs or exceeds_daily_capacity or exceeds_resource_limit)

    return SlotEvaluationResult(
        has_time_conflict=bool(conflict_pairs),
        conflict_pairs=conflict_pairs,
        exceeds_daily_capacity=exceeds_daily_capacity,
        exceeds_resource_limit=exceeds_resource_limit,
        can_accept_new_booking=can_accept_new_booking,
        blocked_recommendations=blocked_recommendations,
    )


# Optional router for easy API demo.
router = APIRouter(prefix="/api/member3/module1", tags=["Member3 Module1"])


class SlotInput(BaseModel):
    slot_id: str
    date: str
    start_time: str
    end_time: str
    is_blocked: bool = False
    resource_required: int = 1


class SlotEvaluationRequest(BaseModel):
    slots: list[SlotInput]
    max_daily_capacity: int
    available_resources: int
    requested_bookings_for_day: int


@router.post("/evaluate-slots")
def evaluate_slot_management(payload: SlotEvaluationRequest) -> dict[str, Any]:
    slot_records = [SlotRecord(**s.model_dump()) for s in payload.slots]
    result = evaluate_slots(
        slots=slot_records,
        max_daily_capacity=payload.max_daily_capacity,
        available_resources=payload.available_resources,
        requested_bookings_for_day=payload.requested_bookings_for_day,
    )
    return {
        "has_time_conflict": result.has_time_conflict,
        "conflict_pairs": result.conflict_pairs,
        "exceeds_daily_capacity": result.exceeds_daily_capacity,
        "exceeds_resource_limit": result.exceeds_resource_limit,
        "can_accept_new_booking": result.can_accept_new_booking,
        "blocked_recommendations": result.blocked_recommendations,
        "engine": "rule-based-local",
    }
