# Service Booking System - Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Copy Files to Your Project
```bash
# Backend files already in place:
# - backend/models.py (enhanced)
# - backend/schemas.py (enhanced)
# - backend/routers/slots.py (complete)
# - backend/routers/bookings_enhanced.py (new)
# - backend/main.py (updated)

# Frontend files to copy:
cp frontend/src/components/SlotManagerAdvanced.jsx /your/project/
cp frontend/src/components/ServiceBookingInterface.jsx /your/project/
```

### 2. Integrate Components
```javascript
// In MyServicesPage.jsx - Add for providers
import SlotManagerAdvanced from '../components/SlotManagerAdvanced'
<SlotManagerAdvanced serviceId={123} serviceName="Math" maxCapacity={5} />

// In ServicesPage.jsx - Add for students
import ServiceBookingInterface from '../components/ServiceBookingInterface'
<ServiceBookingInterface serviceId={123} serviceName="Math" maxCapacity={5} providerName="Dr. Smith" />
```

### 3. Start Backend & Frontend
```bash
# Terminal 1 - Backend
cd backend && ..\..\.venv\Scripts\python.exe -m uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend && npm run dev -- --host
```

### 4. Test
```bash
# Test API
python test_booking_api.py
```

Done! ✅

---

## 📚 Documentation Map

| Document | Purpose |
|----------|---------|
| **[BOOKING_SYSTEM_GUIDE.md](BOOKING_SYSTEM_GUIDE.md)** | Complete technical guide with all API endpoints |
| **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** | What was implemented |
| **[INTEGRATION_CHECKLIST.md](INTEGRATION_CHECKLIST.md)** | Step-by-step integration tasks |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System design and data flows |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** | This file |

---

## 🎯 Common Tasks

### Provider: Create Time Slots

**UI**: Click "Single Slot" in SlotManagerAdvanced
```
Date: 2024-12-25
Start: 09:00
End: 10:00
Max Bookings: 2
→ Click Create
```

**API**:
```bash
POST http://localhost:8000/api/slots/
{
  "service_id": 1,
  "slot_date": "2024-12-25",
  "start_time": "09:00",
  "end_time": "10:00",
  "max_bookings": 2
}
```

### Provider: Create Recurring Slots

**UI**: Click "Bulk Slots"
```
Start Date: 2024-12-25
End Date: 2025-01-31
Time: 09:00 - 10:00
Max Bookings: 1
→ Click Create All
```

**API**:
```bash
POST http://localhost:8000/api/slots/bulk/
?service_id=1
&start_date=2024-12-25
&end_date=2025-01-31
&start_time=09:00
&end_time=10:00
&max_bookings=1
```

### Provider: Block Vacation Dates

**UI**: Click "Block Dates"
```
Start: 2024-12-20
End: 2024-12-22
Reason: Holiday break
→ Click Block
```

**API**:
```bash
POST http://localhost:8000/api/slots/blocked-dates/
?service_id=1
&start_date=2024-12-20
&end_date=2024-12-22
&reason=Holiday%20break
```

### Student: Book Service

**UI**: Use ServiceBookingInterface
```
From Date: Today
To Date: +30 days
→ Click Search
→ Click Slot
→ Add Notes (optional)
→ Click Confirm Booking
```

**API**:
```bash
POST http://localhost:8000/api/bookings/
{
  "student_id": 2,
  "service_id": 1,
  "slot_id": 101,
  "notes": "Needs extra help with calculus"
}
```

### Student: Reschedule Booking

**UI**: BookingsPage → Click Reschedule
```
Select new slot from available slots
→ Click Confirm
```

**API**:
```bash
PUT http://localhost:8000/api/bookings/5/reschedule
?new_slot_id=102
```

### Provider: Approve Booking

**UI**: BookingsPage → Click Approve
```
→ Click Approve
```

**API**:
```bash
PUT http://localhost:8000/api/bookings/5/status
{
  "status": "approved"
}
```

---

## 🔍 Key Validation Rules

### Slot Creation
```
✅ Service must exist
✅ Start time < end time
✅ No time conflicts
✅ Date not blocked
✅ Daily capacity not exceeded
```

### Booking Creation
```
✅ Service & slot exist
✅ Slot not blocked
✅ Slot has capacity
✅ No duplicate booking
✅ Date not blocked
✅ Daily capacity ok
```

### Date Blocking
```
✅ Start date ≤ end date
✅ No active bookings
✅ Date not already blocked
```

---

## ⚠️ Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Time conflict with existing slot` | Overlapping slots | Change time or date |
| `Cannot book on blocked date` | Date blocked by provider | Select different date |
| `Slot is full` | No capacity remaining | Try different slot |
| `Already booked this slot` | Duplicate booking | Check your bookings |
| `Daily capacity reached` | Too many bookings for day | Book different day |
| `Cannot block slot with bookings` | Slot has bookings | Cancel bookings first |
| `Service not found` | Invalid service ID | Verify service exists |

---

## 🧪 Testing Scenarios

### Scenario 1: Time Conflict
```
1. Create slot 09:00-10:00
2. Try to create slot 09:30-10:30
3. ❌ Error: "Time conflict"
```

### Scenario 2: Capacity Limit
```
1. Create slot with max_bookings=1
2. Book slot (1/1 full)
3. Try to book again
4. ❌ Error: "Slot is full"
```

### Scenario 3: Blocked Date
```
1. Block date 2024-12-25
2. Try to create slot on 2024-12-25
3. ❌ Error: "Date blocked"
4. Try to book on 2024-12-25
5. ❌ Error: "Cannot book"
```

### Scenario 4: Successful Booking
```
1. Provider creates slots for Dec 25-31
2. Provider blocks Dec 25-26 (holiday)
3. Provider sets capacity=5 per day
4. Student searches Dec 27-31
5. Student books Dec 27, 09:00-10:00
6. ✅ Booking created
```

---

## 📊 API Response Examples

### Create Slot Response
```json
{
  "id": 101,
  "service_id": 1,
  "slot_date": "2024-12-25",
  "start_time": "09:00",
  "end_time": "10:00",
  "max_bookings": 2,
  "is_blocked": false,
  "current_bookings": 0,
  "created_at": "2024-04-21T10:30:00",
  "updated_at": "2024-04-21T10:30:00"
}
```

### Create Booking Response
```json
{
  "id": 501,
  "student_id": 2,
  "service_id": 1,
  "slot_id": 101,
  "status": "pending",
  "notes": "Needs help",
  "reschedule_count": 0,
  "created_at": "2024-04-21T11:00:00"
}
```

### Capacity Info Response
```json
{
  "service_id": 1,
  "slot_date": "2024-12-25",
  "max_capacity": 5,
  "current_bookings": 3,
  "available_slots": 2,
  "is_full": false,
  "is_date_blocked": false
}
```

### Availability Status Response
```json
{
  "is_available": true,
  "reason": null,
  "available_slots": 1,
  "max_slots": 2
}
```

---

## 🎨 Component Props Reference

### SlotManagerAdvanced
```javascript
<SlotManagerAdvanced
  serviceId={number}        // Required: Service ID
  serviceName={string}      // Required: Display name
  maxCapacity={number}      // Required: Daily capacity
/>
```

### ServiceBookingInterface
```javascript
<ServiceBookingInterface
  serviceId={number}        // Required: Service ID
  serviceName={string}      // Required: Display name
  maxCapacity={number}      // Required: Daily capacity
  providerName={string}     // Required: Provider name
/>
```

---

## 🚨 Troubleshooting

### API returns 404
```
Check:
- Service ID is correct
- Slot belongs to service
- Booking exists
- Date exists
```

### API returns 400
```
Check:
- Time slot conflict?
- Capacity exceeded?
- Date blocked?
- Duplicate booking?
- Invalid date/time format?
```

### Components not loading
```
Check:
- Import path correct?
- Lucide icons installed?
- API base URL correct?
- Network requests visible in DevTools?
```

### Slots not appearing
```
Check:
- Date range includes slots?
- Slots not blocked?
- Have capacity?
- Date not blocked?
```

---

## 📞 Support Resources

**API Documentation**: http://localhost:8000/docs (Swagger UI)

**Database**: PostgreSQL required
- Development: Local PostgreSQL instance
- Production: Managed PostgreSQL

**Frontend**: React 18+
- Node.js 16+
- npm or yarn

---

## ✅ Pre-Deployment Checklist

- [ ] All components integrated
- [ ] API endpoints tested
- [ ] Database migrations applied
- [ ] Error handling verified
- [ ] UI responsive on mobile
- [ ] Performance acceptable
- [ ] Security reviewed
- [ ] Documentation complete

---

## 🎓 Learning Path

1. **Read** IMPLEMENTATION_SUMMARY.md (10 min)
2. **Review** ARCHITECTURE.md (15 min)
3. **Check** INTEGRATION_CHECKLIST.md (5 min)
4. **Integrate** Components (30 min)
5. **Test** Using test_booking_api.py (10 min)
6. **Deploy** To staging (varies)

---

**Need more help?** See [BOOKING_SYSTEM_GUIDE.md](BOOKING_SYSTEM_GUIDE.md) for complete documentation.

**Version**: 1.0
**Status**: Production Ready ✅
**Last Updated**: April 21, 2026
