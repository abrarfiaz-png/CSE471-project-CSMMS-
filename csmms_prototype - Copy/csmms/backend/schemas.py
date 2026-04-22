from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, time, datetime
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────
class UserRole(str, Enum):
    student = "student"
    provider = "provider"
    admin = "admin"


class BookingStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rescheduled = "rescheduled"
    completed = "completed"
    cancelled = "cancelled"


class ServicePriority(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class ServiceCategory(str, Enum):
    tutoring = "tutoring"
    printing = "printing"
    lab_assistance = "lab_assistance"
    equipment_sharing = "equipment_sharing"
    other = "other"


# ─── User Schemas ──────────────────────────────────────────────────────────────
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole = UserRole.student


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Service Schemas ───────────────────────────────────────────────────────────
class ServiceBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    category: ServiceCategory
    priority: ServicePriority = ServicePriority.medium
    price_per_hour: float = Field(..., gt=0)
    max_capacity_per_day: int = Field(5, ge=1)
    image_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None


class ServiceCreate(ServiceBase):
    provider_id: int


class ServiceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[ServicePriority] = None
    price_per_hour: Optional[float] = None
    max_capacity_per_day: Optional[int] = None
    is_active: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None


class ServiceOut(ServiceBase):
    id: int
    is_active: bool
    total_students_helped: int
    average_rating: float
    completion_rate: float
    provider_id: int
    provider: Optional[UserOut] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Slot Schemas ──────────────────────────────────────────────────────────────
class SlotBase(BaseModel):
    slot_date: date
    start_time: time
    end_time: time
    max_bookings: int = Field(1, ge=1)


class SlotCreate(SlotBase):
    service_id: int


class SlotBlock(BaseModel):
    is_blocked: bool


class SlotOut(SlotBase):
    id: int
    service_id: int
    is_blocked: bool
    current_bookings: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Booking Schemas ───────────────────────────────────────────────────────────
class BookingCreate(BaseModel):
    student_id: int
    service_id: int
    slot_id: int
    notes: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus


class BookingOut(BaseModel):
    id: int
    student_id: int
    service_id: int
    slot_id: int
    status: BookingStatus
    notes: Optional[str] = None
    reschedule_count: int
    created_at: datetime
    service: Optional[ServiceOut] = None
    slot: Optional[SlotOut] = None

    class Config:
        from_attributes = True


# ─── Review Schemas ────────────────────────────────────────────────────────────
class ReviewCreate(BaseModel):
    booking_id: int
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None


class ReviewOut(ReviewCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Nearby Search ────────────────────────────────────────────────────────────
class NearbySearchParams(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = Field(5.0, gt=0)


# ─── Blocked Dates Schemas ────────────────────────────────────────────────────
class BlockedDateCreate(BaseModel):
    blocked_date: date
    reason: Optional[str] = Field(None, max_length=500)


class BlockedDateOut(BlockedDateCreate):
    id: int
    service_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Availability Status ──────────────────────────────────────────────────────
class SlotAvailabilityStatus(BaseModel):
    is_available: bool
    reason: Optional[str] = None
    available_slots: int = 0
    max_slots: int = 0


class CapacityInfo(BaseModel):
    service_id: int
    slot_date: date
    max_capacity: int
    current_bookings: int
    available_slots: int
    is_full: bool
    is_date_blocked: bool
