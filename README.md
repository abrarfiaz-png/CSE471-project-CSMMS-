# 🎓 CSMMS — Campus Service & Marketplace Management System

> **CSE471 Group 01 | Spring 2026 | BRAC University**

A full-stack web platform for buying/selling campus items and booking services (tutoring, printing, lab assistance).

---

## 🚀 Quick Start (VS Code)

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

---

### 1. Clone / Open in VS Code
Open the `csmms/` folder in VS Code.

---

### 2. Set Up the Database
```sql
-- In psql or pgAdmin:
CREATE DATABASE csmms;
```

---

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy env file and configure
cp .env.example .env
# Edit .env: set your DATABASE_URL, and optionally API keys

# Seed demo data
python seed.py

# Start the server
uvicorn main:app --reload --port 8000
```

**API Docs:** http://localhost:8000/docs  
**Backend runs on:** http://localhost:8000

---

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**App runs on:** http://localhost:5173

---

## 🔐 Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| 🎓 Student | student@demo.com | demo1234 |
| 🔧 Provider | provider@demo.com | demo1234 |
| 🛡 Admin | admin@demo.com | demo1234 |

---

## ⚙️ Environment Variables (backend/.env)

```env
# Required
DATABASE_URL=postgresql://postgres:password@localhost:5432/csmms
SECRET_KEY=your-super-secret-key

# Optional (AI features work in demo mode without these)
OPENAI_API_KEY=sk-...          # For real AI analysis & chatbot
AWS_ACCESS_KEY_ID=...           # For S3 image uploads
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=csmms-bucket
GMAIL_USER=your@gmail.com       # For email notifications
GMAIL_APP_PASSWORD=...
```

> **All features work without API keys** — the system uses demo/fallback responses.

---

## 📋 Features

### 🎓 Student
- Register/login with role selection
- Browse & search marketplace (by keyword, category, price)
- List items for sale with image upload (S3)
- Browse & book campus services
- View/cancel bookings with status tracking
- AI marksheet analysis (upload PDF/image → get weakness report)
- AI chatbot for platform help
- Real-time notifications

### 🔧 Service Provider
- Create and manage services with priority levels (High/Medium/Low)
- Add time slots with overbooking prevention
- Block unavailable dates
- Set cancellation/reschedule policies
- AI policy validation (OpenAI flags inappropriate policies)
- Analytics dashboard: earnings, bookings, cancellation ratio
- Approve/reject/complete bookings
- Location-based service display (Google Maps link)

### 🛡 Admin
- Dashboard overview (users, services, bookings, items)
- User management (activate/deactivate)
- Review & override flagged policies
- AI activity logs monitoring
- Overbooking capacity monitor

---

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| Frontend | React.js + Vite |
| Styling | TailwindCSS |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Auth | JWT (python-jose) |
| Images | Amazon S3 + CloudFront |
| Maps | Google Maps API (link) |
| AI | OpenAI GPT-4o |
| Email | Gmail SMTP |
| Version Control | GitHub |

---

## 📁 Project Structure

```
csmms/
├── backend/
│   ├── main.py              # FastAPI app entry
│   ├── database.py          # DB connection
│   ├── auth.py              # JWT auth utilities
│   ├── seed.py              # Demo data seeder
│   ├── requirements.txt
│   ├── .env.example
│   ├── models/
│   │   └── models.py        # SQLAlchemy models
│   └── routers/
│       ├── auth.py          # Register / Login / Me
│       ├── items.py         # Marketplace CRUD
│       ├── services.py      # Services + slots + reviews + analytics
│       ├── bookings.py      # Bookings + reschedule
│       ├── ai_module.py     # Marksheet analysis + chatbot + policy validation
│       ├── admin.py         # Admin panel APIs
│       └── notifications.py # Notification system
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js           # Axios client
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── components/
    │   │   └── Layout.jsx   # Sidebar + navigation
    │   └── pages/
    │       ├── LoginPage.jsx
    │       ├── RegisterPage.jsx
    │       ├── DashboardPage.jsx
    │       ├── MarketplacePage.jsx
    │       ├── ServicesPage.jsx
    │       ├── BookingsPage.jsx
    │       ├── MyItemsPage.jsx
    │       ├── MyServicesPage.jsx
    │       ├── AIModulePage.jsx
    │       ├── AnalyticsPage.jsx
    │       ├── NotificationsPage.jsx
    │       └── AdminPage.jsx
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```
