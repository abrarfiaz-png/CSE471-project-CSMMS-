from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, items, services, bookings, admin, ai_module, notifications
from database import create_tables, apply_runtime_schema_updates

app = FastAPI(title="Campus Service & Marketplace Management System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(items.router, prefix="/api/items", tags=["Marketplace Items"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings Management"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(ai_module.router, prefix="/api/ai", tags=["AI Module"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])


@app.on_event("startup")
def startup_db():
    create_tables()
    apply_runtime_schema_updates()

@app.get("/")
def root():
    return {"message": "CSMMS API is running", "docs": "/docs"}
