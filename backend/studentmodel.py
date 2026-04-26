from sqlalchemy import Column, Integer, String, Text
from database import Base

class StudentAnalysis(Base):
    __tablename__ = "student_analysis"

    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String)
    marks_data = Column(Text)  # raw marks
    weakness_summary = Column(Text)
    tutor_summary = Column(Text)
    study_plan = Column(Text)
