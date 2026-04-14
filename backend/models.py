from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text, Enum as SAEnum, Date, Time
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UserRole(str, enum.Enum):
    student = "student"
    provider = "provider"
    admin = "admin"


class BookingStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rescheduled = "rescheduled"
    completed = "completed"
    cancelled = "cancelled"


class ServicePriority(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class ServiceCategory(str, enum.Enum):
    tutoring = "tutoring"
    printing = "printing"
    lab_assistance = "lab_assistance"
    equipment_sharing = "equipment_sharing"
    other = "other"


# ─── Users ────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.student, nullable=False)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    services = relationship("Service", back_populates="provider")
    bookings = relationship("Booking", back_populates="student", foreign_keys="Booking.student_id")


# ─── Services ─────────────────────────────────────────────────────────────────
class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(SAEnum(ServiceCategory), nullable=False)
    priority = Column(SAEnum(ServicePriority), default=ServicePriority.medium)
    price_per_hour = Column(Float, nullable=False)
    max_capacity_per_day = Column(Integer, default=5)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)

    # Location fields (Feature 2: Map Discovery)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(300), nullable=True)

    # Stats
    total_students_helped = Column(Integer, default=0)
    average_rating = Column(Float, default=0.0)
    completion_rate = Column(Float, default=0.0)

    provider_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    provider = relationship("User", back_populates="services")
    slots = relationship("ServiceSlot", back_populates="service", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="service")


# ─── Service Slots ─────────────────────────────────────────────────────────────
class ServiceSlot(Base):
    __tablename__ = "service_slots"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    slot_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_blocked = Column(Boolean, default=False)
    current_bookings = Column(Integer, default=0)
    max_bookings = Column(Integer, default=1)

    # Relationships
    service = relationship("Service", back_populates="slots")
    bookings = relationship("Booking", back_populates="slot")


# ─── Bookings ─────────────────────────────────────────────────────────────────
class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("service_slots.id"), nullable=False)
    status = Column(SAEnum(BookingStatus), default=BookingStatus.pending)
    notes = Column(Text, nullable=True)
    reschedule_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    student = relationship("User", back_populates="bookings", foreign_keys=[student_id])
    service = relationship("Service", back_populates="bookings")
    slot = relationship("ServiceSlot", back_populates="bookings")
    review = relationship("Review", back_populates="booking", uselist=False)


# ─── Reviews ──────────────────────────────────────────────────────────────────
class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    booking = relationship("Booking", back_populates="review")
