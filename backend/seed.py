"""
Run this script to seed demo data: python seed.py
Make sure DATABASE_URL is set in .env
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, create_tables
from app_models import User, Item, Service, TimeSlot, Notification, UserRole, ServicePriority
from auth import hash_password
from datetime import datetime

def seed():
    create_tables()
    db = SessionLocal()

    # Check if already seeded
    if db.query(User).count() > 0:
        print("Database already seeded. Skipping.")
        db.close()
        return

    print("Seeding demo data...")

    # Users
    student = User(name="Alex Student", email="student@demo.com", hashed_password=hash_password("demo1234"), role=UserRole.student)
    provider = User(name="Prof. Rahman", email="provider@demo.com", hashed_password=hash_password("demo1234"), role=UserRole.provider)
    admin = User(name="Admin User", email="admin@demo.com", hashed_password=hash_password("demo1234"), role=UserRole.admin)
    db.add_all([student, provider, admin])
    db.commit()
    db.refresh(student); db.refresh(provider); db.refresh(admin)

    # Items
    items = [
        Item(title="Calculus Textbook (9th Ed)", description="Barely used, great condition", price=350, category="Books", owner_id=student.id),
        Item(title="Scientific Calculator", description="Casio fx-991EX, works perfectly", price=800, category="Electronics", owner_id=student.id),
        Item(title="Engineering Drawing Set", description="Full set, compass + protractors", price=250, category="Stationery", owner_id=provider.id),
        Item(title="Physics Lab Coat", description="Size M, used one semester", price=150, category="Clothing", owner_id=student.id),
    ]
    db.add_all(items)
    db.commit()

    # Services
    services = [
        Service(title="Mathematics Tutoring", description="One-on-one tutoring for Calculus, Algebra, and Statistics. Proven track record.", category="Tutoring", price_per_hour=300, priority=ServicePriority.high, max_daily_capacity=4, location_name="Library Room 201", location_lat=23.8103, location_lng=90.4125, cancellation_policy="24-hour notice required for cancellation. No refunds for no-shows.", policy_validated=True, policy_flagged=False, students_helped=45, completion_rate=92.0, provider_id=provider.id),
        Service(title="Physics & Lab Assistance", description="Help with physics problems, lab reports, and experiment guidance.", category="Lab Assistance", price_per_hour=250, priority=ServicePriority.medium, max_daily_capacity=3, location_name="Science Block Lab 3", location_lat=23.8110, location_lng=90.4130, cancellation_policy="Cancel at least 12 hours before session.", policy_validated=True, policy_flagged=False, students_helped=28, completion_rate=88.0, provider_id=provider.id),
        Service(title="Thesis Printing & Binding", description="Professional printing, binding and formatting for thesis and assignments.", category="Printing", price_per_hour=150, priority=ServicePriority.low, max_daily_capacity=10, location_name="Student Center Ground Floor", cancellation_policy="Prepayment required. No cancellation after printing starts.", policy_validated=False, policy_flagged=False, students_helped=120, provider_id=admin.id),
        Service(title="Programming & DSA Coaching", description="Python, Java, C++, Data Structures, Algorithms — from basics to competitive programming.", category="Tutoring", price_per_hour=400, priority=ServicePriority.high, max_daily_capacity=5, location_name="CS Department Room 305", location_lat=23.8098, location_lng=90.4120, cancellation_policy="Students must complete practice problems before sessions.", policy_validated=True, policy_flagged=False, students_helped=67, completion_rate=95.0, provider_id=provider.id),
    ]
    db.add_all(services)
    db.commit()

    # Time slots for first service
    db.refresh(services[0])
    slots = [
        TimeSlot(service_id=services[0].id, date="2026-04-10", start_time="10:00", end_time="11:00"),
        TimeSlot(service_id=services[0].id, date="2026-04-10", start_time="14:00", end_time="15:00"),
        TimeSlot(service_id=services[0].id, date="2026-04-11", start_time="10:00", end_time="11:00"),
        TimeSlot(service_id=services[0].id, date="2026-04-12", start_time="15:00", end_time="16:00"),
    ]
    db.add_all(slots)

    # Notifications
    notifs = [
        Notification(user_id=student.id, title="Welcome to CSMMS!", message="Your account is set up. Browse the marketplace and find campus services."),
        Notification(user_id=provider.id, title="New Booking Request", message="A student has booked your Mathematics Tutoring service."),
        Notification(user_id=admin.id, title="Policy Flagged", message="A service policy has been flagged by the AI validator. Please review."),
    ]
    db.add_all(notifs)
    db.commit()

    print("✅ Seeded demo data successfully!")
    print("   student@demo.com / demo1234  (Student)")
    print("   provider@demo.com / demo1234 (Service Provider)")
    print("   admin@demo.com / demo1234    (Admin)")
    db.close()

if __name__ == "__main__":
    seed()
