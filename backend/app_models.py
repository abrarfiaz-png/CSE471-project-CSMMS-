from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import enum

Base = declarative_base()


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


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.student)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    student_rating = Column(Float, default=0.0)
    ratings_received = Column(Integer, default=0)

    items = relationship("Item", back_populates="owner")
    services = relationship("Service", foreign_keys="Service.provider_id", back_populates="provider")
    tutoring_services = relationship("Service", foreign_keys="Service.tutor_id", back_populates="tutor")
    bookings_as_student = relationship("Booking", foreign_keys="Booking.student_id", back_populates="student")
    reviews = relationship("Review", back_populates="author")
    notifications = relationship("Notification", back_populates="user")


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    category = Column(String(100))
    image_url = Column(String(500), nullable=True)
    is_available = Column(Boolean, default=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="items")


class Service(Base):
    __tablename__ = "services"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    price_per_hour = Column(Float)
    priority = Column(Enum(ServicePriority), default=ServicePriority.medium)
    is_active = Column(Boolean, default=True)
    max_daily_capacity = Column(Integer, default=5)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    location_name = Column(String(200), nullable=True)
    cancellation_policy = Column(Text, nullable=True)
    policy_validated = Column(Boolean, default=False)
    policy_flagged = Column(Boolean, default=False)
    students_helped = Column(Integer, default=0)
    completion_rate = Column(Float, default=0.0)
    provider_id = Column(Integer, ForeignKey("users.id"))
    tutor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    provider = relationship("User", foreign_keys=[provider_id], back_populates="services")
    tutor = relationship("User", foreign_keys=[tutor_id], back_populates="tutoring_services")
    bookings = relationship("Booking", back_populates="service")
    slots = relationship("TimeSlot", back_populates="service")
    reviews = relationship("Review", back_populates="service")


class TimeSlot(Base):
    __tablename__ = "time_slots"
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"))
    date = Column(String(20))
    start_time = Column(String(10))
    end_time = Column(String(10))
    is_blocked = Column(Boolean, default=False)
    is_booked = Column(Boolean, default=False)

    service = relationship("Service", back_populates="slots")


class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    service_id = Column(Integer, ForeignKey("services.id"))
    slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=True)
    status = Column(Enum(BookingStatus), default=BookingStatus.pending)
    notes = Column(Text, nullable=True)
    reschedule_count = Column(Integer, default=0)
    awaiting_tutor_approval = Column(Boolean, default=False)
    selected_by_provider = Column(Boolean, default=False)
    booked_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("User", foreign_keys=[student_id], back_populates="bookings_as_student")
    service = relationship("Service", back_populates="bookings")


class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"))
    service_id = Column(Integer, ForeignKey("services.id"))
    rating = Column(Integer)
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("User", back_populates="reviews")
    service = relationship("Service", back_populates="reviews")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200))
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class AILog(Base):
    __tablename__ = "ai_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action_type = Column(String(100))
    input_summary = Column(Text)
    output_summary = Column(Text)
    flagged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class StudentRating(Base):
    __tablename__ = "student_ratings"
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), unique=True, nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tutor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)