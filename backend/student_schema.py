from pydantic import BaseModel

class StudentInput(BaseModel):
    student_name: str
    marks_data: str  # Example: "Math:40, Physics:50, CSE:80"

class StudentResponse(BaseModel):
    weakness_summary: str
    tutor_summary: str
    study_plan: str
  
