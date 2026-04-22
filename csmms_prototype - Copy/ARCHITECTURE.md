# Service Booking System - Architecture & Data Flow

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Frontend Application                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────┐    ┌────────────────────────────────┐  │
│  │ SlotManagerAdvanced     │    │ ServiceBookingInterface        │  │
│  │ (Provider UI)           │    │ (Student UI)                   │  │
│  │                         │    │                                │  │
│  │ • Create Slots          │    │ • Search Slots                 │  │
│  │ • Bulk Create           │    │ • View Availability            │  │
│  │ • Block Dates           │    │ • Book Service                 │  │
│  │ • View Capacity         │    │ • Cancel Booking               │  │
│  │ • Manage Slots          │    │ • Reschedule                   │  │
│  └─────────────────────────┘    └────────────────────────────────┘  │
│            │                              │                           │
└────────────┼──────────────────────────────┼───────────────────────────┘
             │ HTTP Requests                │
             ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (main.py)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ Slots Router (slots.py)      │  │ Bookings Router (bookings_   │  │
│  │                              │  │ enhanced.py)                 │  │
│  │ POST   /api/slots/           │  │ POST   /api/bookings/        │  │
│  │ POST   /api/slots/bulk/      │  │ GET    /api/bookings/my      │  │
│  │ PATCH  /api/slots/{id}       │  │ GET    /api/bookings/        │  │
│  │ PATCH  /api/slots/{id}/block │  │ PUT    /api/bookings/{id}    │  │
│  │ DELETE /api/slots/{id}       │  │ DELETE /api/bookings/{id}    │  │
│  │ POST   /api/slots/blocked-   │  │ GET    /api/bookings/        │  │
│  │        dates/                │  │        available/            │  │
│  │ GET    /api/slots/blocked-   │  │ GET    /api/bookings/        │  │
│  │        dates/{id}            │  │        availability/         │  │
│  │ GET    /api/slots/capacity/  │  │ PUT    /api/bookings/        │  │
│  │                              │  │        reschedule            │  │
│  └─────────────────────────────┘  └──────────────────────────────┘  │
│            │                              │                           │
└────────────┼──────────────────────────────┼───────────────────────────┘
             │ Database Queries             │
             ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (models.py)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ services     │  │ service_     │  │ blocked_dates (NEW)      │   │
│  │              │  │ slots        │  │                          │   │
│  │ • id         │  │              │  │ • id                     │   │
│  │ • title      │  │ • id         │  │ • service_id (FK)        │   │
│  │ • category   │  │ • service_id │  │ • blocked_date           │   │
│  │ • price/hour │  │ • slot_date  │  │ • reason                 │   │
│  │ • max_       │  │ • start_time │  │ • created_at             │   │
│  │   capacity_  │  │ • end_time   │  │                          │   │
│  │   per_day    │  │ • is_blocked │  │ Indexes:                 │   │
│  │ • provider   │  │ • max_       │  │ • service_id             │   │
│  │   _id        │  │   bookings   │  │ • blocked_date           │   │
│  └──────────────┘  │ • current_   │  └──────────────────────────┘   │
│                    │   bookings   │                                   │
│  ┌──────────────┐  │ • created_   │                                   │
│  │ bookings     │  │   at (NEW)   │                                   │
│  │              │  │ • updated_   │                                   │
│  │ • id         │  │   at (NEW)   │                                   │
│  │ • student_id │  │              │                                   │
│  │ • service_id │  │ Indexes:     │                                   │
│  │ • slot_id    │  │ • service_id │                                   │
│  │ • status     │  │ • slot_date  │                                   │
│  │ • notes      │  │ • is_blocked │                                   │
│  │ • reschedule │  └──────────────┘                                   │
│  │   _count     │                                                     │
│  └──────────────┘                                                     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Provider Creating Slots

```
Provider Opens Slot Manager
           │
           ▼
┌─────────────────────────────┐
│ SlotManagerAdvanced         │
│ - Show service info         │
│ - Display existing slots    │
│ - Show blocked dates        │
└─────────────────────────────┘
           │
           ├──── Select Date & Time ────┐
           │                             │
           ▼                             ▼
      ┌─────────────┐         ┌──────────────────┐
      │ Single Slot │         │ Bulk Slots       │
      │ Form        │         │ (Date Range)     │
      └─────────────┘         └──────────────────┘
           │                             │
           │ POST /api/slots/            │ POST /api/slots/bulk/
           ▼                             ▼
    ┌──────────────────────────────────────────────┐
    │ Validation Layer                             │
    │                                              │
    │ 1. Service exists?                           │
    │ 2. Date valid?                               │
    │ 3. Time conflict?  ──NO──> ERROR (409)       │
    │ 4. Date blocked?   ──YES─> ERROR (400)       │
    │ 5. Capacity ok?    ──NO──> ERROR (400)       │
    │                                              │
    └──────────────────────────────────────────────┘
                    │ PASS
                    ▼
    ┌──────────────────────────────────────────────┐
    │ Save to Database                             │
    │                                              │
    │ INSERT INTO service_slots (...)              │
    │ • slot_date                                  │
    │ • start_time                                 │
    │ • end_time                                   │
    │ • max_bookings                               │
    │ • current_bookings = 0                       │
    │ • created_at = NOW()                         │
    │                                              │
    └──────────────────────────────────────────────┘
                    │
                    ▼
              ✅ Success
              Response: SlotOut
              Toast: "Slot created!"
              Refresh UI
```

### Student Booking Slot

```
Student Browses Services
           │
           ▼
    ┌──────────────────────────┐
    │ ServiceBookingInterface  │
    │ - Select Date Range      │
    │ - Click "Search"         │
    └──────────────────────────┘
           │
           │ GET /api/bookings/available/{service_id}
           │     ?from_date=X&to_date=Y
           ▼
┌─────────────────────────────────────────────┐
│ Query Available Slots                       │
│                                             │
│ SELECT FROM service_slots WHERE:            │
│ 1. service_id = ?                           │
│ 2. slot_date BETWEEN from_date AND to_date │
│ 3. is_blocked = false                       │
│ 4. current_bookings < max_bookings          │
│ 5. NOT IN blocked_dates                     │
│ 6. daily_bookings < max_capacity_per_day    │
│                                             │
└─────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│ Display Slots Grid                           │
│ - Show date, time, capacity                 │
│ - Color code: Available/Full/Blocked         │
└──────────────────────────────────────────────┘
           │
           ├── Student Clicks Slot ─────┐
           │                              │
           ▼                              ▼
    ┌──────────────────┐      ┌──────────────────────┐
    │ Availability     │      │ Slot Details Modal   │
    │ Check            │      │ - Date, Time         │
    │                  │      │ - Capacity           │
    │ GET /api/        │      │ - Add Notes          │
    │ bookings/        │      │ - Confirm Button     │
    │ availability/    │      └──────────────────────┘
    │ {service}/{slot} │              │
    └──────────────────┘              │ Student clicks "Confirm"
            │                          │
            ▼                          ▼
    ┌─────────────────────────────────────────┐
    │ Book Slot                               │
    │                                         │
    │ POST /api/bookings/                     │
    │ {                                       │
    │   student_id: X,                        │
    │   service_id: Y,                        │
    │   slot_id: Z,                           │
    │   notes: "..."                          │
    │ }                                       │
    └─────────────────────────────────────────┘
            │
            ▼
    ┌────────────────────────────────────────────────┐
    │ Multi-Layer Validation                         │
    │                                                │
    │ 1. Service exists?                             │
    │ 2. Slot exists & belongs to service?           │
    │ 3. Slot not blocked?                           │
    │ 4. Slot has capacity?                          │
    │ 5. Date not blocked?                           │
    │ 6. No duplicate booking?  ──YES──> ERROR (400) │
    │ 7. Daily capacity ok?     ──NO──> ERROR (400)  │
    │ 8. Student exists?                             │
    │                                                │
    └────────────────────────────────────────────────┘
                    │ PASS
                    ▼
    ┌────────────────────────────────────────────────┐
    │ Create Booking & Update Capacity               │
    │                                                │
    │ BEGIN TRANSACTION                              │
    │   INSERT INTO bookings (...)                    │
    │   UPDATE service_slots SET                      │
    │     current_bookings = current_bookings + 1    │
    │   COMMIT                                        │
    │                                                │
    └────────────────────────────────────────────────┘
                    │
                    ▼
              ✅ Success
              Response: BookingOut
              Toast: "Booking created!"
              Show confirmation
```

---

## Conflict Detection Flow

```
┌──────────────────────────────────────────────────────────────┐
│ BOOKING ATTEMPT                                              │
│                                                              │
│ Input: student_id, service_id, slot_id, notes               │
└──────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│ VALIDATION CHECKS                                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. RESOURCE CHECKS                                      │ │
│ │    ├─ Service exists?                                   │ │
│ │    ├─ Slot exists?                                      │ │
│ │    └─ Slot belongs to service?                          │ │
│ │                                                         │ │
│ │    ❌ FAIL → HTTP 404 "Not Found"                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 2. SLOT STATUS CHECKS                                  │ │
│ │    ├─ Slot not blocked?                                │ │
│ │    └─ Slot has capacity?                               │ │
│ │       (current_bookings < max_bookings)                │ │
│ │                                                         │ │
│ │    ❌ FAIL → HTTP 400 "Slot unavailable"               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 3. DUPLICATE BOOKING CHECK                             │ │
│ │    Query: SELECT * FROM bookings WHERE                 │ │
│ │      student_id = X AND                                │ │
│ │      slot_id = Y AND                                   │ │
│ │      status IN (pending, approved)                     │ │
│ │                                                         │ │
│ │    ❌ FAIL → HTTP 400 "Already booked"                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 4. DATE BLOCKING CHECK                                 │ │
│ │    Query: SELECT * FROM blocked_dates WHERE            │ │
│ │      service_id = X AND                                │ │
│ │      blocked_date = slot_date                          │ │
│ │                                                         │ │
│ │    ❌ FAIL → HTTP 400 "Date blocked"                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 5. DAILY CAPACITY CHECK                                │ │
│ │    Query: SELECT SUM(current_bookings) FROM            │ │
│ │      service_slots WHERE                               │ │
│ │      service_id = X AND slot_date = Y                  │ │
│ │                                                         │ │
│ │    ❌ FAIL → HTTP 400 "Daily limit exceeded"           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                    │
                    ✅ ALL PASS
                    │
                    ▼
┌──────────────────────────────────────────────────────────────┐
│ ATOMIC TRANSACTION                                           │
│                                                              │
│ BEGIN;                                                       │
│   INSERT INTO bookings (...)                                │
│   UPDATE service_slots SET current_bookings += 1             │
│ COMMIT;                                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                    │
                    ▼
         ✅ HTTP 201 Created
            Response: BookingOut
            Booking confirmed
```

---

## Capacity Management

```
Service: Math Tutoring
max_capacity_per_day: 5 students

Date: 2024-12-25

Time Slots:
┌─────────┬──────────────┬────────────┬─────────────┐
│ Slot ID │ Time         │ Max/Current│ Availability│
├─────────┼──────────────┼────────────┼─────────────┤
│ 101     │ 09:00-10:00  │ 2/1        │ ✅ 1 slot   │
│ 102     │ 10:00-11:00  │ 2/2        │ ❌ Full     │
│ 103     │ 14:00-15:00  │ 1/1        │ ❌ Full     │
│ 104     │ 15:00-16:00  │ 2/0        │ ✅ 2 slots  │
└─────────┴──────────────┴────────────┴─────────────┘

Daily Totals:
Total Bookings: 1 + 2 + 1 + 0 = 4/5
Available Slots: 1 + 0 + 0 + 2 = 3 slots

Status: ✅ Can accept 1 more booking

Capacity Info Response:
{
  "service_id": 1,
  "slot_date": "2024-12-25",
  "max_capacity": 5,
  "current_bookings": 4,
  "available_slots": 1,
  "is_full": false,
  "is_date_blocked": false
}
```

---

## Time Conflict Detection

```
Service: Lab Assistance
Date: 2024-12-25

Attempting to create slot: 10:00-11:00

Existing slots:
┌────────┬──────────────┐
│ Slot 1 │ 09:00-10:00  │ ✅ No conflict (ends when new starts)
│ Slot 2 │ 10:00-11:00  │ ❌ EXACT MATCH - Conflict!
│ Slot 3 │ 09:30-10:30  │ ❌ OVERLAP - Conflict! (10:00 inside)
│ Slot 4 │ 10:30-11:30  │ ❌ OVERLAP - Conflict! (10:00 inside)
│ Slot 5 │ 11:00-12:00  │ ✅ No conflict (starts when new ends)
└────────┴──────────────┘

Conflict Detection Algorithm:
new_start < existing_end AND new_end > existing_start = CONFLICT

For 10:00-11:00:
- vs 09:00-10:00: 10:00 < 10:00? NO → ✅ OK
- vs 10:00-11:00: 10:00 < 11:00? YES, 11:00 > 10:00? YES → ❌ CONFLICT
- vs 09:30-10:30: 10:00 < 10:30? YES, 11:00 > 09:30? YES → ❌ CONFLICT
- vs 10:30-11:30: 10:00 < 11:30? YES, 11:00 > 10:30? YES → ❌ CONFLICT
- vs 11:00-12:00: 10:00 < 12:00? YES, 11:00 > 11:00? NO → ✅ OK

Result: CONFLICT DETECTED
Response: HTTP 409
{
  "detail": "Time conflict with existing slot 10:00–11:00"
}
```

---

## Status Transitions

```
Booking Lifecycle:

┌──────────────────────────────────────────────────────────────┐
│                        PENDING                               │
│                  (Student booked)                            │
├──────────────────────────────────────────────────────────────┤
│   Valid Transitions:                                         │
│   ├─→ APPROVED (Provider accepts)                            │
│   └─→ CANCELLED (Student or Provider cancels)               │
└──────────────────────────────────────────────────────────────┘
       │                                 │
       │ approve()                       │ cancel()
       │                                 │
       ▼                                 ▼
┌──────────────────────────────────┐   ❌ CANCELLED
│        APPROVED                  │   (Slot freed)
│  (Provider accepted)             │
├──────────────────────────────────┤
│   Valid Transitions:             │
│   ├─→ COMPLETED                  │
│   ├─→ RESCHEDULED                │
│   └─→ CANCELLED                  │
└──────────────────────────────────┘
       │         │          │
       │ done()  │          │ cancel()
       │         │reschedule()
       │         │          │
       ▼         ▼          ▼
   ✅ COMPLETED RESCHEDULED ❌
   (Finished)    │        (Slot freed)
                 │
                 │ re_approve()
                 ▼
            RESCHEDULED
            (Awaiting new slot)
```

---

## Security & Validation Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: API Route Validation                               │
│ ├─ HTTP method check                                         │
│ ├─ Route parameter validation                                │
│ └─ Content-Type validation                                   │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Schema Validation (Pydantic)                       │
│ ├─ Field type checking                                       │
│ ├─ Field constraint validation                               │
│ ├─ Custom validators                                         │
│ └─ Serialization rules                                       │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Business Logic Validation                          │
│ ├─ Resource existence checks                                 │
│ ├─ Conflict detection (time, capacity)                       │
│ ├─ Permission checks                                         │
│ ├─ State transition validation                               │
│ └─ Constraint enforcement                                    │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Database Constraints                               │
│ ├─ Foreign key constraints                                   │
│ ├─ Unique constraints                                        │
│ ├─ Check constraints                                         │
│ └─ NOT NULL constraints                                      │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
      Database Commit
```

---

## Summary

This architecture provides:

✅ **Clear Separation of Concerns** - UI, API, and Database layers
✅ **Multi-Layer Validation** - Errors caught at multiple levels
✅ **Atomic Transactions** - Database consistency guaranteed
✅ **Real-Time Status** - Capacity and availability updates
✅ **Comprehensive Conflict Detection** - Time and resource conflicts
✅ **Scalable Design** - Can handle growing number of slots/bookings

The system is designed to be:
- **Reliable** - Multiple validation layers prevent errors
- **Performant** - Proper indexing for fast queries
- **Maintainable** - Clear separation of concerns
- **Extensible** - Easy to add new features
