from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app_models import Base
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/csmms")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    Base.metadata.create_all(bind=engine)


def apply_runtime_schema_updates():
    """Apply additive schema updates needed for local development runtime."""
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_rating FLOAT DEFAULT 0.0"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS ratings_received INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE services ADD COLUMN IF NOT EXISTS tutor_id INTEGER"))
        conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS awaiting_tutor_approval BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_by_provider BOOLEAN DEFAULT FALSE"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS blocked_dates (id SERIAL PRIMARY KEY, service_id INTEGER REFERENCES services(id), date VARCHAR(20) NOT NULL, reason VARCHAR(255), created_at TIMESTAMP DEFAULT NOW())"))
    Base.metadata.create_all(bind=engine)
