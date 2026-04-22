# CSMMS Project Structure - Comprehensive Exploration

## 1. Current Service Model & Data Structure

### Backend Service Model (models.py)
Located in: [backend/models.py](backend/models.py)

**Service Fields:**
```python
- id: Integer (primary key)
- title: String(200) - Service name
- description: Text - Full description
- category: Enum (tutoring, printing, lab_assistance, equipment_sharing, other)
- priority: Enum (high, medium, low)
- price_per_hour: Float - Hourly rate
- max_capacity_per_day: Integer - Daily booking limit (default: 5)
- image_url: String(500) - Service image
- is_active: Boolean - Active/inactive status

# Location Fields (Feature: Map Discovery)
- latitude: Float - Service location latitude
- longitude: Float - Service location longitude
- location_name: String(300) - Named location (e.g., "Library Room 201")

# Statistics
- total_students_helped: Integer
- average_rating: Float
- completion_rate: Float

# Relationships
- provider_id: Foreign key to User (service provider)
- created_at: DateTime timestamp
- updated_at: DateTime timestamp
- Relationships: provider, slots, bookings, blocked_dates, reviews
```

### Pydantic Schemas (schemas.py)
Located in: [backend/schemas.py](backend/schemas.py)

**ServiceCreate/ServiceUpdate:**
```python
- title, description, category, priority
- price_per_hour, max_capacity_per_day
- image_url
- latitude, longitude, location_name  # Location fields supported
```

**ServiceOut (Response Schema):**
Returns all service details including location fields, provider info, and stats.

---

## 2. Frontend Pages & Components Structure

### Main Pages
Located in: [frontend/src/pages/](frontend/src/pages/)

| Page | Purpose | Key Features |
|------|---------|--------------|
| **DashboardPage** | Main dashboard | Overview, quick actions |
| **ServicesPage** | Service listing & discovery | Search, filter by category, distance calculation, booking interface |
| **MapDiscoveryPage** | Map-based service discovery | Leaflet map, geolocation, radius search (1-10km), category filter |
| **MarketplacePage** | Buy/sell items on campus | Item listing, filtering by price range |
| **BookingsPage** | View bookings | Filter by status, reschedule |
| **MyServicesPage** | Provider view | Services managed by provider, edit/delete |
| **MyItemsPage** | Student marketplace items | Items listed by user |
| **AnalyticsPage** | Provider analytics | Booking history, earnings, efficiency metrics |
| **AIModulePage** | AI assistance | Content moderation, policy checking |
| **AdminPage** | Admin controls | System-wide administration |
| **NotificationsPage** | System notifications | Real-time alerts |
| **PendingServiceRequestsPage** | Provider pending requests | Requests awaiting provider approval |
| **LoginPage** | Authentication | User login |
| **RegisterPage** | User registration | Sign up |

### Frontend Components
Located in: [frontend/src/components/](frontend/src/components/)

| Component | Usage |
|-----------|-------|
| **BookingModal.jsx** | Modal for booking a service with slot selection |
| **ServiceCard.jsx** | Reusable card displaying service details |
| **ServiceForm.jsx** | Form to create/edit services |
| **ServiceBookingInterface.jsx** | Complete student UI for booking |
| **SlotPicker.jsx** | Date/time slot picker |
| **SlotManager.jsx** | Basic provider slot management |
| **SlotManagerAdvanced.jsx** | Enhanced slot/date blocking management |
| **Navbar.jsx** | Navigation bar with user menu |
| **Layout.jsx** | Main layout wrapper |

### Context & State Management
Located in: [frontend/src/context/](frontend/src/context/)

- **AuthContext.jsx** - User authentication state, role management

### API Client
Located in: [frontend/src/api/client.js](frontend/src/api/client.js)

Exported API functions:
```javascript
servicesApi.list(), servicesApi.get(), servicesApi.create()
servicesApi.update(), servicesApi.delete()
servicesApi.nearby()  // Location-based search

slotsApi.listByService(), slotsApi.create()
slotsApi.block(), slotsApi.delete()

bookingsApi.create(), bookingsApi.list(), bookingsApi.get()
bookingsApi.updateStatus(), bookingsApi.reschedule()

usersApi.register(), usersApi.get()
```

---

## 3. Backend API Endpoints

### Services Router
Located in: [backend/routers/services.py](backend/routers/services.py)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/services/` | GET | List all active services (supports category, keyword filtering) |
| `/services/` | POST | Create new service (requires location fields support) |
| `/services/my` | GET | Get provider's own services |
| `/services/tutors` | GET | List available tutors (for provider selection) |
| `/services/{id}/priority` | PUT | Update service priority |
| `/services/{id}/slots` | GET | Get slots for a service |
| `/services/{id}/slots` | POST | Add time slot |
| `/services/{id}/slots/{slot_id}/block` | PUT | Block a slot |
| `/services/{id}/reviews` | GET | Get service reviews |
| `/services/{id}/reviews` | POST | Add review |
| `/services/analytics/provider` | GET | Provider analytics summary |
| `/services/analytics/report` | GET | Detailed provider report |

### Slots Router
Located in: [backend/routers/slots.py](backend/routers/slots.py)

- Manages service time slots
- Supports bulk slot creation
- Date blocking functionality
- Capacity management

### Bookings Router
Located in: [backend/routers/bookings_enhanced.py](backend/routers/bookings_enhanced.py)

- Create bookings with validation
- Conflict detection
- Capacity enforcement
- Reschedule functionality
- Status management (pending, approved, completed, cancelled)

---

## 4. Database Schema for Services

### Services Table
```sql
CREATE TABLE services (
    id INTEGER PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category ENUM (tutoring, printing, lab_assistance, equipment_sharing, other),
    priority ENUM (high, medium, low),
    price_per_hour FLOAT NOT NULL,
    max_capacity_per_day INTEGER,
    image_url VARCHAR(500),
    is_active BOOLEAN,
    
    -- Location fields
    latitude FLOAT,
    longitude FLOAT,
    location_name VARCHAR(300),
    
    -- Stats
    total_students_helped INTEGER,
    average_rating FLOAT,
    completion_rate FLOAT,
    
    -- Foreign keys
    provider_id INTEGER FOREIGN KEY,
    
    -- Timestamps
    created_at DATETIME DEFAULT now(),
    updated_at DATETIME
);
```

### Service_slots Table (Enhanced)
```sql
CREATE TABLE service_slots (
    id INTEGER PRIMARY KEY,
    service_id INTEGER FOREIGN KEY,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_blocked BOOLEAN,
    current_bookings INTEGER,
    max_bookings INTEGER,
    created_at DATETIME,
    updated_at DATETIME
);
```

### Blocked_dates Table
```sql
CREATE TABLE blocked_dates (
    id INTEGER PRIMARY KEY,
    service_id INTEGER FOREIGN KEY,
    blocked_date DATE NOT NULL,
    reason VARCHAR(500),
    created_at DATETIME
);
```

### Bookings Table
```sql
CREATE TABLE bookings (
    id INTEGER PRIMARY KEY,
    student_id INTEGER FOREIGN KEY,
    service_id INTEGER FOREIGN KEY,
    slot_id INTEGER FOREIGN KEY,
    status ENUM (pending, approved, rescheduled, completed, cancelled),
    notes TEXT,
    reschedule_count INTEGER,
    created_at DATETIME,
    updated_at DATETIME
);
```

### Reviews Table
```sql
CREATE TABLE reviews (
    id INTEGER PRIMARY KEY,
    booking_id INTEGER FOREIGN KEY (unique),
    rating INTEGER (1-5),
    comment TEXT,
    created_at DATETIME
);
```

---

## 5. Frontend Dependencies

Located in: [frontend/package.json](frontend/package.json)

### Production Dependencies
```json
{
  "react": "^18.3.1",              // UI framework
  "react-dom": "^18.3.1",          // React DOM rendering
  "react-router-dom": "^6.27.0",   // Client-side routing
  "axios": "^1.7.7",               // HTTP client
  "react-hot-toast": "^2.4.1",     // Toast notifications
  "lucide-react": "^0.460.0",      // Icon library
  "@googlemaps/js-api-loader": "^1.16.8"  // Google Maps API (for future use)
}
```

### Development Dependencies
```json
{
  "@vitejs/plugin-react": "^4.3.2",
  "vite": "^5.4.9",                // Build tool
  "tailwindcss": "^3.4.14",        // CSS framework
  "autoprefixer": "^10.4.20",      // PostCSS plugin
  "postcss": "^8.4.47"             // CSS transformation
}
```

### Build Scripts
```json
{
  "dev": "vite",                   // Dev server
  "build": "vite build",           // Production build
  "preview": "vite preview"        // Preview built version
}
```

---

## 6. User/Student Model

Located in: [backend/models.py](backend/models.py) / [backend/app_models.py](backend/app_models.py)

### User Fields
```python
- id: Integer (primary key)
- name: String(100)
- email: String(150) - unique
- password_hash: String(256)
- role: Enum (student, provider, admin)
- avatar_url: String(500) - optional
- created_at: DateTime

# Ratings (for student providers)
- student_rating: Float (default: 0.0)
- ratings_received: Integer (default: 0)

# Status
- is_active: Boolean (default: True)
```

### Important Note on Student Location
**Current Status: NO student location fields exist in User model**

- Users do NOT have location_address, latitude, or longitude fields
- Students provide their location via browser geolocation API on the client side
- Location is transient (used only for real-time searches, not stored)
- MapDiscoveryPage uses `navigator.geolocation.getCurrentPosition()` to get student coordinates

### User Relationships
```python
- services: Services provided by this user
- bookings_as_student: Bookings made by this user
- items: Marketplace items owned by this user
- reviews: Reviews written by this user
- notifications: Notifications for this user
```

---

## 7. Existing Location-Related Features

### Backend Implementation

#### A. Service Location Storage
**Already exists in Service model:**
- `latitude` (Float, nullable)
- `longitude` (Float, nullable)
- `location_name` (String(300), nullable)

**Example from seed data:**
```python
Service(
    title="Mathematics Tutoring",
    location_name="Library Room 201",
    location_lat=23.8103,
    location_lng=90.4125,
    ...
)
```

#### B. Schemas Support Location
**ServiceCreate/ServiceUpdate schemas** already support:
```python
latitude: Optional[float] = None
longitude: Optional[float] = None
location_name: Optional[str] = None
```

#### C. API Endpoints for Location
From API client [frontend/src/api/client.js](frontend/src/api/client.js):
```javascript
servicesApi.nearby(params)  // Endpoint: GET /services/nearby
// params: { latitude, longitude, radius_km, category? }
```

**However:** The backend services.py router does NOT have a `/nearby` endpoint implemented - only the API client references it!

### Frontend Implementation

#### A. MapDiscoveryPage [frontend/src/pages/MapDiscoveryPage.jsx](frontend/src/pages/MapDiscoveryPage.jsx)
**Features:**
- Leaflet.js map integration (not installed in package.json - issue!)
- Geolocation: "Use My Location" button via `navigator.geolocation`
- Search radius: 1km, 2km, 5km, 10km options
- Category filtering
- Default center: BRAC University (23.7808, 90.4192)
- Real-time marker display for services
- Sidebar showing filtered results

**Components:**
- FlyToUser: Auto-centers map on user location
- Custom markers: Red for user, blue for services
- Distance calculation using Haversine formula

#### B. ServicesPage [frontend/src/pages/ServicesPage.jsx](frontend/src/pages/ServicesPage.jsx)
**Features:**
- Current location enable button
- Distance calculation to each service
- Shows `distance_km` badge on service cards
- Searches all services, then filters by distance client-side

#### C. Service Card Component
Displays location info:
```jsx
{service.location_name && (
  <span className="flex items-center gap-1">
    <MapPin size={12} /> {service.location_name}
  </span>
)}
```

#### D. Geolocation Implementation Pattern
```javascript
navigator.geolocation.getCurrentPosition(
  (pos) => {
    const coords = [pos.coords.latitude, pos.coords.longitude]
    setUserLocation(coords)
  },
  () => toast.error('Could not get your location')
)
```

---

## 8. Current Feature Gaps & Implementation Status

### ✅ Implemented
- Service location data model (latitude, longitude, location_name)
- Frontend geolocation API usage
- Map display with Leaflet
- Distance calculation (Haversine formula)
- Radius-based search UI (1-10km)
- Category filtering
- Service cards showing location

### ⚠️ Partially Implemented
- API schemas support location fields, but backend doesn't validate them
- Bookings system implemented (slots, blocking, capacity)
- Provider slot management UI created

### ❌ Missing/Not Implemented
- **Backend `/services/nearby` endpoint** - Frontend calls it but backend doesn't have this route!
- Student location fields in User model (would require migration)
- Address/campus location mapping
- Google Maps integration (library installed but not used)
- Geocoding for address → coordinates conversion
- Distance-based sorting/ranking
- Favorites/saved locations for students

---

## 9. Frontend Component Organization

```
src/
├── pages/
│   ├── DashboardPage.jsx
│   ├── ServicesPage.jsx           # Service listing with distance
│   ├── MapDiscoveryPage.jsx       # Map-based discovery
│   ├── MarketplacePage.jsx        # Item marketplace
│   ├── BookingsPage.jsx           # Booking management
│   ├── MyServicesPage.jsx         # Provider services
│   ├── MyItemsPage.jsx            # User's items
│   ├── AnalyticsPage.jsx          # Provider analytics
│   ├── AIModulePage.jsx           # AI features
│   ├── AdminPage.jsx              # Admin panel
│   ├── NotificationsPage.jsx      # Notifications
│   ├── PendingServiceRequestsPage.jsx
│   ├── LoginPage.jsx
│   └── RegisterPage.jsx
├── components/
│   ├── ServiceCard.jsx            # Reusable service display
│   ├── ServiceForm.jsx            # Service creation/edit
│   ├── ServiceBookingInterface.jsx # Complete booking flow
│   ├── BookingModal.jsx           # Booking modal
│   ├── SlotPicker.jsx             # Time slot selection
│   ├── SlotManager.jsx            # Basic slot management
│   ├── SlotManagerAdvanced.jsx    # Advanced slot/date blocking
│   ├── Navbar.jsx                 # Navigation
│   └── Layout.jsx                 # Main layout
├── context/
│   └── AuthContext.jsx            # Auth state management
└── api/
    ├── client.js                  # API client functions
    └── ../api.js                  # Axios instance setup
```

---

## 10. Key Architectural Decisions

### Backend Architecture
- **Framework:** FastAPI
- **Database:** PostgreSQL (SQLite incompatible due to ALTER TABLE IF NOT EXISTS)
- **ORM:** SQLAlchemy
- **Schemas:** Pydantic for validation
- **Authentication:** Custom JWT-based (auth.py)

### Frontend Architecture
- **Framework:** React 18 with hooks
- **Routing:** React Router v6
- **HTTP Client:** Axios
- **Styling:** Tailwind CSS
- **Build Tool:** Vite
- **Icons:** Lucide React
- **Notifications:** React Hot Toast
- **Maps:** Leaflet (configured but missing from package.json!)

### Database Architecture
- **Services:** Central service listings with location data
- **ServiceSlots:** Time-based availability (enhanced with blocking)
- **BlockedDates:** Date-level blocking for providers
- **Bookings:** Reservation tracking with status workflow
- **Reviews:** Service ratings and feedback
- **Users:** Role-based (student, provider, admin)

---

## 11. Working Backend Endpoints Summary

```
GET  /api/auth/me                    - Current user info
POST /api/auth/login                 - User login
POST /api/auth/register              - User registration

GET  /api/services/                  - List all services
POST /api/services/                  - Create service
GET  /api/services/my                - User's services
GET  /api/services/tutors            - Available tutors
GET  /api/services/{id}              - Service details
PUT  /api/services/{id}              - Update service
PUT  /api/services/{id}/priority     - Update priority
GET  /api/services/{id}/slots        - Get slots
POST /api/services/{id}/slots        - Add slot
GET  /api/services/{id}/reviews      - Get reviews
POST /api/services/{id}/reviews      - Add review

GET  /api/bookings/                  - List bookings
POST /api/bookings/                  - Create booking
GET  /api/bookings/{id}              - Booking details
PATCH /api/bookings/{id}/status      - Update status
PATCH /api/bookings/{id}/reschedule  - Reschedule

GET  /api/items/                     - List marketplace items
POST /api/items/                     - Create listing

(More routes exist in admin, notifications, ai_module, users)
```

---

## Summary: What Exists vs. What's Missing

### Location Feature Status
| Feature | Status | Details |
|---------|--------|---------|
| Service location storage | ✅ Done | Database has lat/lng/name fields |
| Service location schema | ✅ Done | Pydantic supports location fields |
| Create service with location | ✅ Done | Form accepts location data |
| Student geolocation API | ✅ Done | Frontend uses navigator.geolocation |
| Map display | ✅ Done | MapDiscoveryPage with Leaflet |
| Distance calculation | ✅ Done | Haversine formula implemented |
| Nearby search backend endpoint | ❌ Missing | API called but not implemented |
| Student location persistence | ❌ Not planned | Uses transient geolocation only |
| Address geocoding | ❌ Not implemented | Google Maps API installed but unused |
| Distance-based sorting | ❌ Not implemented | Would enhance search results |

---

## 10. Complete Entity Relationships

```
User (student, provider, admin)
├── has many Services (as provider)
├── has many Items (marketplace)
├── has many Bookings (as student)
└── has many Reviews (as author)
    └── has many Notifications

Service
├── belongs to User (provider)
├── has many ServiceSlots
├── has many Bookings
├── has many Reviews
├── has many BlockedDates
└── contains: latitude, longitude, location_name

ServiceSlot
├── belongs to Service
├── has many Bookings
└── contains: date, start_time, end_time, is_blocked, capacity

Booking
├── belongs to User (student)
├── belongs to Service
├── belongs to ServiceSlot
├── has one Review
└── status: pending → approved → completed/cancelled

Review
├── belongs to User (author)
├── belongs to Service
└── rating + comment
```

---

## Recommendations for Location Enhancement

Based on the exploration, here's what to focus on:

1. **Implement backend `/services/nearby` endpoint** - The frontend expects it!
2. **Distance-based sorting** - Sort results by proximity to user
3. **Student location profile** - Optional: Add address fields to User model
4. **Address geocoding** - Use Google Maps API (already installed) to convert addresses
5. **Favorites system** - Let students save favorite service locations
6. **Location-based notifications** - Notify students of new services in their area
7. **Provider availability radius** - Let providers set service availability radius
8. **Route optimization** - Show travel time/directions to service location
