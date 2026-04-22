"""
Quick API Testing Script for Service Booking System
Run this to verify all endpoints are working correctly
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://127.0.0.1:8000"
SERVICE_ID = 1  # Update with your service ID
PROVIDER_ID = 1  # Update with your provider ID
STUDENT_ID = 2  # Update with student ID

def test_slot_endpoints():
    """Test all slot management endpoints"""
    print("\n" + "="*60)
    print("TESTING SLOT MANAGEMENT ENDPOINTS")
    print("="*60)

    # 1. Get all slots for a service
    print("\n1. GET /api/slots/service/{service_id}")
    response = requests.get(f"{BASE_URL}/api/slots/service/{SERVICE_ID}")
    print(f"   Status: {response.status_code}")
    print(f"   Slots found: {len(response.json())}")

    # 2. Create single slot
    print("\n2. POST /api/slots/ (Create single slot)")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    slot_data = {
        "service_id": SERVICE_ID,
        "slot_date": tomorrow,
        "start_time": "09:00",
        "end_time": "10:00",
        "max_bookings": 2
    }
    response = requests.post(f"{BASE_URL}/api/slots/", json=slot_data)
    print(f"   Status: {response.status_code}")
    if response.status_code == 201:
        slot_id = response.json()["id"]
        print(f"   Slot created: ID={slot_id}")
    else:
        print(f"   Error: {response.json()}")

    # 3. Create bulk slots
    print("\n3. POST /api/slots/bulk/ (Create recurring slots)")
    start_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
    end_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
    params = {
        "service_id": SERVICE_ID,
        "start_date": start_date,
        "end_date": end_date,
        "start_time": "14:00",
        "end_time": "15:00",
        "max_bookings": 1
    }
    response = requests.post(f"{BASE_URL}/api/slots/bulk/", params=params)
    print(f"   Status: {response.status_code}")
    if response.status_code == 201:
        print(f"   Slots created: {len(response.json())}")

    # 4. Get capacity info
    print(f"\n4. GET /api/slots/capacity/{{service_id}}/{{date}}")
    response = requests.get(f"{BASE_URL}/api/slots/capacity/{SERVICE_ID}/{tomorrow}")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        cap = response.json()
        print(f"   Max capacity: {cap['max_capacity']}")
        print(f"   Current bookings: {cap['current_bookings']}")
        print(f"   Available slots: {cap['available_slots']}")

    # 5. Block date range
    print("\n5. POST /api/slots/blocked-dates/ (Block dates)")
    block_start = (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%d")
    block_end = (datetime.now() + timedelta(days=22)).strftime("%Y-%m-%d")
    params = {
        "service_id": SERVICE_ID,
        "start_date": block_start,
        "end_date": block_end,
        "reason": "Maintenance"
    }
    response = requests.post(f"{BASE_URL}/api/slots/blocked-dates/", params=params)
    print(f"   Status: {response.status_code}")
    if response.status_code == 201:
        print(f"   Dates blocked: {len(response.json())}")

    # 6. Get blocked dates
    print(f"\n6. GET /api/slots/blocked-dates/{{service_id}}")
    response = requests.get(f"{BASE_URL}/api/slots/blocked-dates/{SERVICE_ID}")
    print(f"   Status: {response.status_code}")
    print(f"   Blocked dates: {len(response.json())}")


def test_booking_endpoints():
    """Test all booking management endpoints"""
    print("\n" + "="*60)
    print("TESTING BOOKING MANAGEMENT ENDPOINTS")
    print("="*60)

    # 1. Get available slots
    print("\n1. GET /api/bookings/available/{{service_id}}")
    start_date = datetime.now().strftime("%Y-%m-%d")
    end_date = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
    params = {
        "from_date": start_date,
        "to_date": end_date
    }
    response = requests.get(f"{BASE_URL}/api/bookings/available/{SERVICE_ID}", params=params)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        slots = response.json()
        print(f"   Available slots: {len(slots)}")
        if slots:
            print(f"   First slot: {slots[0]['slot_date']} {slots[0]['start_time']}-{slots[0]['end_time']}")

    # 2. Check slot availability
    if slots:
        slot_id = slots[0]["id"]
        print(f"\n2. GET /api/bookings/availability/{{service_id}}/{{slot_id}}")
        response = requests.get(f"{BASE_URL}/api/bookings/availability/{SERVICE_ID}/{slot_id}")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            avail = response.json()
            print(f"   Is available: {avail['is_available']}")
            print(f"   Reason: {avail.get('reason', 'N/A')}")

        # 3. Create booking
        print(f"\n3. POST /api/bookings/ (Create booking)")
        booking_data = {
            "student_id": STUDENT_ID,
            "service_id": SERVICE_ID,
            "slot_id": slot_id,
            "notes": "Test booking"
        }
        response = requests.post(f"{BASE_URL}/api/bookings/", json=booking_data)
        print(f"   Status: {response.status_code}")
        if response.status_code == 201:
            booking_id = response.json()["id"]
            print(f"   Booking created: ID={booking_id}")

            # 4. Get my bookings
            print(f"\n4. GET /api/bookings/my")
            params = {"student_id": STUDENT_ID}
            response = requests.get(f"{BASE_URL}/api/bookings/my", params=params)
            print(f"   Status: {response.status_code}")
            print(f"   Bookings found: {len(response.json())}")

            # 5. Update booking status
            print(f"\n5. PUT /api/bookings/{{booking_id}}/status")
            status_data = {"status": "approved"}
            response = requests.put(f"{BASE_URL}/api/bookings/{booking_id}/status", json=status_data)
            print(f"   Status: {response.status_code}")

            # 6. Get provider bookings
            print(f"\n6. GET /api/bookings/provider/{{provider_id}}")
            params = {"service_id": SERVICE_ID}
            response = requests.get(f"{BASE_URL}/api/bookings/provider/{PROVIDER_ID}", params=params)
            print(f"   Status: {response.status_code}")
            print(f"   Provider bookings: {len(response.json())}")


def test_conflict_scenarios():
    """Test conflict detection scenarios"""
    print("\n" + "="*60)
    print("TESTING CONFLICT SCENARIOS")
    print("="*60)

    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    # Test 1: Time conflict
    print("\n1. TIME CONFLICT - Create overlapping slots")
    slot1_data = {
        "service_id": SERVICE_ID,
        "slot_date": tomorrow,
        "start_time": "11:00",
        "end_time": "12:00",
        "max_bookings": 1
    }
    slot2_data = {
        "service_id": SERVICE_ID,
        "slot_date": tomorrow,
        "start_time": "11:30",
        "end_time": "12:30",
        "max_bookings": 1
    }
    
    response1 = requests.post(f"{BASE_URL}/api/slots/", json=slot1_data)
    print(f"   First slot: Status {response1.status_code}")
    
    response2 = requests.post(f"{BASE_URL}/api/slots/", json=slot2_data)
    print(f"   Overlapping slot: Status {response2.status_code}")
    if response2.status_code != 201:
        print(f"   ✓ Conflict detected: {response2.json()['detail']}")


def test_capacity_scenarios():
    """Test capacity enforcement"""
    print("\n" + "="*60)
    print("TESTING CAPACITY SCENARIOS")
    print("="*60)

    tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")

    print("\n1. CAPACITY LIMIT - Fill a slot")
    
    # Create slot with max 1 booking
    slot_data = {
        "service_id": SERVICE_ID,
        "slot_date": tomorrow,
        "start_time": "16:00",
        "end_time": "17:00",
        "max_bookings": 1
    }
    response = requests.post(f"{BASE_URL}/api/slots/", json=slot_data)
    if response.status_code == 201:
        slot_id = response.json()["id"]
        print(f"   Slot created: ID={slot_id}")
        
        # Check availability
        response = requests.get(f"{BASE_URL}/api/bookings/available/{SERVICE_ID}",
                               params={"from_date": tomorrow, "to_date": tomorrow})
        if response.json():
            print(f"   ✓ Slot available before booking")
        
        # Get available slots should show it
        print(f"   Available slots on {tomorrow}: {len(response.json())}")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("SERVICE BOOKING SYSTEM - API TEST SUITE")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"Service ID: {SERVICE_ID}")
    print(f"Provider ID: {PROVIDER_ID}")
    print(f"Student ID: {STUDENT_ID}")

    try:
        # Run tests
        test_slot_endpoints()
        test_booking_endpoints()
        test_conflict_scenarios()
        test_capacity_scenarios()

        print("\n" + "="*60)
        print("✓ ALL TESTS COMPLETED")
        print("="*60 + "\n")

    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to API at", BASE_URL)
        print("   Make sure backend is running:")
        print("   cd backend && ..\\..\\.venv\\Scripts\\python.exe -m uvicorn main:app --reload")
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
