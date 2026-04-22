"""
Location-Based Service Discovery Testing Script
Tests the new /services/nearby endpoint with various scenarios
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000/api"

# Test coordinates (BRAC University area)
BRAC_CENTER = {"lat": 23.7808, "lng": 90.4192}
LOCATION_A = {"lat": 23.7850, "lng": 90.4200, "name": "Tutoring Center A"}
LOCATION_B = {"lat": 23.7850, "lng": 90.4300, "name": "Lab Assistance B"}
LOCATION_C = {"lat": 23.7700, "lng": 90.4100, "name": "Equipment Sharing C"}

def print_test_header(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def print_result(test_name, status, details=""):
    emoji = "✅" if status else "❌"
    print(f"{emoji} {test_name}")
    if details:
        print(f"   {details}")

def test_nearby_endpoint():
    """Test the /services/nearby endpoint"""
    print_test_header("TEST 1: /services/nearby Endpoint")
    
    # Test 1.1: Search nearby from BRAC center with 5km radius
    print("\n1.1 Search nearby services (5km radius from BRAC center)")
    params = {
        "latitude": BRAC_CENTER["lat"],
        "longitude": BRAC_CENTER["lng"],
        "radius_km": 5
    }
    try:
        response = requests.get(f"{BASE_URL}/services/nearby", params=params)
        if response.status_code == 200:
            services = response.json()
            print_result("Endpoint responds", True, f"Found {len(services)} services")
            
            # Verify response structure
            for svc in services[:1]:  # Check first service
                required_fields = ["id", "title", "distance_km", "location_lat", "location_lng", "price_per_hour"]
                has_all = all(field in svc for field in required_fields)
                print_result("Response has required fields", has_all)
                if svc.get("distance_km"):
                    print(f"   Sample: {svc['title']} - {svc['distance_km']}km away")
        else:
            print_result("Endpoint responds", False, f"Status {response.status_code}")
    except Exception as e:
        print_result("Endpoint responds", False, str(e))
    
    # Test 1.2: Test with category filter
    print("\n1.2 Search by category (Tutoring)")
    params = {
        "latitude": BRAC_CENTER["lat"],
        "longitude": BRAC_CENTER["lng"],
        "radius_km": 5,
        "category": "Tutoring"
    }
    try:
        response = requests.get(f"{BASE_URL}/services/nearby", params=params)
        if response.status_code == 200:
            services = response.json()
            all_tutoring = all(s.get("category") == "Tutoring" for s in services)
            print_result("Category filter works", all_tutoring, f"Found {len(services)} tutoring services")
        else:
            print_result("Category filter works", False)
    except Exception as e:
        print_result("Category filter works", False, str(e))
    
    # Test 1.3: Test distance calculation accuracy
    print("\n1.3 Distance calculation accuracy")
    params = {
        "latitude": BRAC_CENTER["lat"],
        "longitude": BRAC_CENTER["lng"],
        "radius_km": 100  # Large radius to get multiple services
    }
    try:
        response = requests.get(f"{BASE_URL}/services/nearby", params=params)
        if response.status_code == 200:
            services = response.json()
            if len(services) > 1:
                # Verify sorting by distance
                distances = [s.get("distance_km", 0) for s in services]
                is_sorted = all(distances[i] <= distances[i+1] for i in range(len(distances)-1))
                print_result("Services sorted by distance", is_sorted)
                
                if len(services) >= 3:
                    print(f"   1st service: {services[0]['title']} - {services[0]['distance_km']}km")
                    print(f"   2nd service: {services[1]['title']} - {services[1]['distance_km']}km")
                    print(f"   3rd service: {services[2]['title']} - {services[2]['distance_km']}km")
            else:
                print_result("Services sorted by distance", len(services) >= 1, "Need multiple services to verify sorting")
    except Exception as e:
        print_result("Distance calculation accuracy", False, str(e))
    
    # Test 1.4: Test radius filtering
    print("\n1.4 Radius filtering")
    radius_tests = [1, 5, 10]
    for radius in radius_tests:
        params = {
            "latitude": BRAC_CENTER["lat"],
            "longitude": BRAC_CENTER["lng"],
            "radius_km": radius
        }
        try:
            response = requests.get(f"{BASE_URL}/services/nearby", params=params)
            if response.status_code == 200:
                services = response.json()
                all_within_radius = all(s.get("distance_km", 0) <= radius for s in services)
                print_result(f"  {radius}km radius filter", all_within_radius, f"{len(services)} services found")
            else:
                print_result(f"  {radius}km radius filter", False)
        except Exception as e:
            print_result(f"  {radius}km radius filter", False, str(e))


def test_service_location_data():
    """Test that services have proper location data"""
    print_test_header("TEST 2: Service Location Data")
    
    print("\n2.1 Verify services have location coordinates")
    try:
        response = requests.get(f"{BASE_URL}/services")
        if response.status_code == 200:
            services = response.json()
            services_with_location = [s for s in services if s.get("location_lat") and s.get("location_lng")]
            location_coverage = (len(services_with_location) / len(services) * 100) if services else 0
            
            print_result("Services have location data", len(services_with_location) > 0, 
                        f"{len(services_with_location)}/{len(services)} services have coordinates ({location_coverage:.0f}%)")
            
            if services_with_location:
                sample = services_with_location[0]
                print(f"   Sample: {sample['title']}")
                print(f"   Location: ({sample['location_lat']}, {sample['location_lng']})")
                print(f"   Name: {sample.get('location_name', 'Not specified')}")
    except Exception as e:
        print_result("Services have location data", False, str(e))
    
    print("\n2.2 Verify location_name field")
    try:
        response = requests.get(f"{BASE_URL}/services")
        if response.status_code == 200:
            services = response.json()
            services_with_name = [s for s in services if s.get("location_name")]
            print_result("Services have location_name field", len(services_with_name) > 0,
                        f"{len(services_with_name)} services have location names")
    except Exception as e:
        print_result("Services have location_name field", False, str(e))


def test_map_discovery_integration():
    """Test integration with map discovery features"""
    print_test_header("TEST 3: Map Discovery Integration")
    
    print("\n3.1 Test geolocation parameter validation")
    invalid_params = [
        {"latitude": "invalid", "longitude": 90.4192, "radius_km": 5},
        {"latitude": 23.7808, "longitude": "invalid", "radius_km": 5},
        {"latitude": 23.7808, "longitude": 90.4192, "radius_km": -1},
    ]
    
    for i, params in enumerate(invalid_params, 1):
        try:
            response = requests.get(f"{BASE_URL}/services/nearby", params=params)
            status = response.status_code in [200, 422]  # 200 ok or 422 validation error
            print_result(f"  Invalid param set {i} handled", status)
        except Exception as e:
            print_result(f"  Invalid param set {i} handled", False, str(e))
    
    print("\n3.2 Test response includes booking-relevant data")
    params = {
        "latitude": BRAC_CENTER["lat"],
        "longitude": BRAC_CENTER["lng"],
        "radius_km": 10
    }
    try:
        response = requests.get(f"{BASE_URL}/services/nearby", params=params)
        if response.status_code == 200:
            services = response.json()
            if services:
                sample = services[0]
                required_for_booking = ["id", "title", "price_per_hour", "provider_name", "average_rating"]
                has_all = all(field in sample for field in required_for_booking)
                print_result("Response includes booking-relevant data", has_all)
            else:
                print_result("Response includes booking-relevant data", True, "No services to check")
        else:
            print_result("Response includes booking-relevant data", False)
    except Exception as e:
        print_result("Response includes booking-relevant data", False, str(e))


def test_performance():
    """Test performance of nearby endpoint"""
    print_test_header("TEST 4: Performance")
    
    import time
    
    print("\n4.1 Test endpoint response time")
    params = {
        "latitude": BRAC_CENTER["lat"],
        "longitude": BRAC_CENTER["lng"],
        "radius_km": 5
    }
    
    try:
        start = time.time()
        response = requests.get(f"{BASE_URL}/services/nearby", params=params)
        elapsed = time.time() - start
        
        is_fast = elapsed < 1.0  # Should respond in less than 1 second
        print_result("Response time < 1 second", is_fast, f"Actual: {elapsed:.3f}s")
    except Exception as e:
        print_result("Response time < 1 second", False, str(e))


if __name__ == "__main__":
    print("\n" + "="*70)
    print("  LOCATION-BASED SERVICE DISCOVERY TEST SUITE")
    print("="*70)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Center: BRAC University ({BRAC_CENTER['lat']}, {BRAC_CENTER['lng']})")
    
    try:
        # Run all tests
        test_nearby_endpoint()
        test_service_location_data()
        test_map_discovery_integration()
        test_performance()
        
        print("\n" + "="*70)
        print("  ✓ ALL TESTS COMPLETED")
        print("="*70 + "\n")
        
    except KeyboardInterrupt:
        print("\n\n⚠ Tests interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {str(e)}")
