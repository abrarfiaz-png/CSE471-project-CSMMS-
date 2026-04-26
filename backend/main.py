from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, items, services, slots
from database import create_tables

app = FastAPI(title="Campus Service & Marketplace Management System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(items.router, prefix="/api/items", tags=["Marketplace Items"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(slots.router)

@app.on_event("startup")
def startup_db():
    try:
        create_tables()
    except Exception as e:
        print(f"Startup error: {e}")

@app.get("/")
def root():
    return {"message": "CSMMS API is running", "docs": "/docs"}