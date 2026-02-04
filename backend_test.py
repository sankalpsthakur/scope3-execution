#!/usr/bin/env python3
"""
Backend API Testing for Scope 3 Reduce Platform
Tests all endpoints including auth, suppliers, and deep-dive recommendations
"""

import requests
import sys
import json
from datetime import datetime
import time

class Scope3ReduceAPITester:
    def __init__(self, base_url="https://scope3-tracker.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Request failed: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        # Test root endpoint
        self.run_test("Root Endpoint", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_seed_data(self):
        """Test seeding mock data"""
        print("\n" + "="*50)
        print("TESTING DATA SEEDING")
        print("="*50)
        
        success, response = self.run_test("Seed Mock Data", "POST", "seed-data", 200)
        if success:
            print(f"   Seeded {response.get('count', 0)} suppliers")
        return success

    def create_test_session(self):
        """Create a test session for authenticated endpoints"""
        print("\n" + "="*50)
        print("CREATING TEST SESSION")
        print("="*50)
        
        # Use the session token created in MongoDB
        self.session_token = "test_session_1770232854297"
        
        print(f"   Using MongoDB session token: {self.session_token}")
        return True

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTH ENDPOINTS")
        print("="*50)
        
        # Test /auth/me without token (should fail)
        old_token = self.session_token
        self.session_token = None
        self.run_test("Auth Me (No Token)", "GET", "auth/me", 401)
        
        # Test /auth/me with invalid token (should fail)
        self.session_token = "invalid_token"
        self.run_test("Auth Me (Invalid Token)", "GET", "auth/me", 401)
        
        # Restore test token
        self.session_token = old_token
        
        # Test logout
        self.run_test("Logout", "POST", "auth/logout", 200)

    def test_supplier_endpoints(self):
        """Test supplier-related endpoints"""
        print("\n" + "="*50)
        print("TESTING SUPPLIER ENDPOINTS")
        print("="*50)
        
        # Test get suppliers (should fail without auth)
        old_token = self.session_token
        self.session_token = None
        self.run_test("Get Suppliers (No Auth)", "GET", "suppliers", 401)
        
        # Restore token and test with auth
        self.session_token = old_token
        success, suppliers_data = self.run_test("Get Suppliers (With Auth)", "GET", "suppliers", 200)
        
        if success and suppliers_data.get('suppliers'):
            suppliers = suppliers_data['suppliers']
            print(f"   Found {len(suppliers)} suppliers")
            
            # Test deep dive for first supplier
            if suppliers:
                first_supplier = suppliers[0]
                supplier_id = first_supplier.get('id')
                if supplier_id:
                    print(f"   Testing deep dive for: {first_supplier.get('supplier_name')}")
                    success, deep_dive = self.run_test(
                        "Get Deep Dive", 
                        "GET", 
                        f"suppliers/{supplier_id}/deep-dive", 
                        200
                    )
                    
                    if success:
                        # Verify deep dive structure
                        required_keys = ['meta', 'metrics', 'content']
                        missing_keys = [key for key in required_keys if key not in deep_dive]
                        
                        if not missing_keys:
                            self.log_test("Deep Dive Structure", True)
                            
                            # Check if AI content is generated
                            content = deep_dive.get('content', {})
                            if content.get('headline') and content.get('action_plan'):
                                self.log_test("AI Content Generation", True)
                                print(f"   AI Headline: {content['headline'][:100]}...")
                            else:
                                self.log_test("AI Content Generation", False, "Missing headline or action_plan")
                        else:
                            self.log_test("Deep Dive Structure", False, f"Missing keys: {missing_keys}")
                
                # Test heatmap data
                self.run_test("Get Heatmap Data", "GET", "suppliers/heatmap", 200)
        
        # Test invalid supplier ID
        self.run_test("Get Deep Dive (Invalid ID)", "GET", "suppliers/invalid-id/deep-dive", 404)

    def test_filtering_endpoints(self):
        """Test NEW filtering functionality"""
        print("\n" + "="*50)
        print("TESTING NEW FILTERING ENDPOINTS")
        print("="*50)
        
        # Test basic filter endpoint
        success, filter_data = self.run_test("Get Filtered Suppliers (No Filters)", "GET", "suppliers/filter", 200)
        
        if success:
            suppliers = filter_data.get('suppliers', [])
            print(f"   Found {len(suppliers)} suppliers without filters")
            
            # Test category filter - should show only Transport & Distribution (3 suppliers)
            success, transport_data = self.run_test(
                "Filter by Category (Transport)", 
                "GET", 
                "suppliers/filter?category=Transport & Distribution", 
                200
            )
            if success:
                transport_suppliers = transport_data.get('suppliers', [])
                print(f"   Transport & Distribution suppliers: {len(transport_suppliers)}")
                if len(transport_suppliers) == 3:
                    self.log_test("Category Filter Validation", True, "Correct count for Transport & Distribution")
                else:
                    self.log_test("Category Filter Validation", False, f"Expected 3, got {len(transport_suppliers)}")
            
            # Test rating filter - C-rated suppliers
            success, c_rated_data = self.run_test(
                "Filter by Rating (C)", 
                "GET", 
                "suppliers/filter?rating=C", 
                200
            )
            if success:
                c_suppliers = c_rated_data.get('suppliers', [])
                print(f"   C-rated suppliers: {len(c_suppliers)}")
                # Verify all returned suppliers have C rating
                all_c_rated = all(s.get('cee_rating', '').startswith('C') for s in c_suppliers)
                if all_c_rated:
                    self.log_test("Rating Filter Validation", True, f"All {len(c_suppliers)} suppliers are C-rated")
                else:
                    self.log_test("Rating Filter Validation", False, "Some suppliers don't have C rating")
            
            # Test min impact filter - high impact suppliers (>= 3%)
            success, high_impact_data = self.run_test(
                "Filter by Min Impact (3%)", 
                "GET", 
                "suppliers/filter?min_impact=3.0", 
                200
            )
            if success:
                high_impact_suppliers = high_impact_data.get('suppliers', [])
                print(f"   High impact suppliers (>=3%): {len(high_impact_suppliers)}")
                # Verify all have impact >= 3%
                all_high_impact = all(s.get('upstream_impact_pct', 0) >= 3.0 for s in high_impact_suppliers)
                if all_high_impact:
                    self.log_test("Min Impact Filter Validation", True, f"All {len(high_impact_suppliers)} suppliers have >=3% impact")
                else:
                    self.log_test("Min Impact Filter Validation", False, "Some suppliers have <3% impact")
            
            # Test min reduction filter
            success, high_reduction_data = self.run_test(
                "Filter by Min Reduction (25%)", 
                "GET", 
                "suppliers/filter?min_reduction=25.0", 
                200
            )
            if success:
                high_reduction_suppliers = high_reduction_data.get('suppliers', [])
                print(f"   High reduction potential suppliers (>=25%): {len(high_reduction_suppliers)}")
            
            # Test combined filters
            success, combined_data = self.run_test(
                "Combined Filters", 
                "GET", 
                "suppliers/filter?category=Purchased Goods & Services&rating=C&min_impact=2.0", 
                200
            )
            if success:
                combined_suppliers = combined_data.get('suppliers', [])
                print(f"   Combined filter results: {len(combined_suppliers)} suppliers")

    def test_engagement_endpoints(self):
        """Test NEW engagement tracking functionality"""
        print("\n" + "="*50)
        print("TESTING NEW ENGAGEMENT ENDPOINTS")
        print("="*50)
        
        # Test get all engagements
        success, engagements_data = self.run_test("Get All Engagements", "GET", "engagements", 200)
        
        if success:
            engagements = engagements_data.get('engagements', [])
            print(f"   Found {len(engagements)} existing engagements")
        
        # Get a supplier ID for testing
        success, suppliers_data = self.run_test("Get Suppliers for Engagement Test", "GET", "suppliers", 200)
        
        if success and suppliers_data.get('suppliers'):
            test_supplier_id = suppliers_data['suppliers'][0]['id']
            supplier_name = suppliers_data['suppliers'][0]['supplier_name']
            
            print(f"   Testing engagement for: {supplier_name}")
            
            # Test get specific engagement (should return default if not exists)
            success, engagement_data = self.run_test(
                "Get Specific Engagement", 
                "GET", 
                f"engagements/{test_supplier_id}", 
                200
            )
            
            if success:
                status = engagement_data.get('status', 'not_started')
                print(f"   Current status: {status}")
            
            # Test update engagement status
            update_data = {
                "status": "in_progress",
                "notes": "Started initial outreach via email",
                "next_action_date": "2025-01-15"
            }
            
            success, updated_engagement = self.run_test(
                "Update Engagement Status", 
                "PUT", 
                f"engagements/{test_supplier_id}", 
                200,
                data=update_data
            )
            
            if success:
                new_status = updated_engagement.get('status')
                notes = updated_engagement.get('notes')
                if new_status == "in_progress":
                    self.log_test("Engagement Status Update", True, f"Status updated to {new_status}")
                    print(f"   Notes: {notes}")
                else:
                    self.log_test("Engagement Status Update", False, f"Expected in_progress, got {new_status}")
            
            # Test different status values
            statuses_to_test = ["pending_response", "completed", "on_hold", "not_started"]
            
            for status in statuses_to_test:
                update_data = {"status": status, "notes": f"Testing {status} status"}
                success, _ = self.run_test(
                    f"Update to {status}", 
                    "PUT", 
                    f"engagements/{test_supplier_id}", 
                    200,
                    data=update_data
                )

    def test_pdf_export_endpoints(self):
        """Test NEW PDF export functionality"""
        print("\n" + "="*50)
        print("TESTING NEW PDF EXPORT ENDPOINTS")
        print("="*50)
        
        # Get a supplier ID for testing
        success, suppliers_data = self.run_test("Get Suppliers for PDF Test", "GET", "suppliers", 200)
        
        if success and suppliers_data.get('suppliers'):
            test_supplier_id = suppliers_data['suppliers'][0]['id']
            supplier_name = suppliers_data['suppliers'][0]['supplier_name']
            
            print(f"   Testing PDF export for: {supplier_name}")
            
            # Test PDF export endpoint
            url = f"{self.api_url}/suppliers/{test_supplier_id}/export-pdf"
            headers = {'Authorization': f'Bearer {self.session_token}'}
            
            try:
                print(f"   Requesting PDF from: {url}")
                response = requests.get(url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    # Check if response is actually a PDF
                    content_type = response.headers.get('content-type', '')
                    content_length = len(response.content)
                    
                    if 'application/pdf' in content_type and content_length > 1000:
                        self.log_test("PDF Export", True, f"PDF generated successfully ({content_length} bytes)")
                        print(f"   PDF size: {content_length} bytes")
                        print(f"   Content-Type: {content_type}")
                    else:
                        self.log_test("PDF Export", False, f"Invalid PDF response: {content_type}, {content_length} bytes")
                else:
                    self.log_test("PDF Export", False, f"HTTP {response.status_code}: {response.text[:200]}")
                    
            except Exception as e:
                self.log_test("PDF Export", False, f"Request failed: {str(e)}")
            
            # Test PDF export with invalid supplier ID
            self.run_test("PDF Export (Invalid ID)", "GET", "suppliers/invalid-id/export-pdf", 404)

    def test_ai_integration(self):
        """Test AI integration specifically"""
        print("\n" + "="*50)
        print("TESTING AI INTEGRATION")
        print("="*50)
        
        # Get suppliers first
        success, suppliers_data = self.run_test("Get Suppliers for AI Test", "GET", "suppliers", 200)
        
        if success and suppliers_data.get('suppliers'):
            suppliers = suppliers_data['suppliers']
            
            # Test AI generation with multiple suppliers
            ai_tests_passed = 0
            ai_tests_total = min(3, len(suppliers))  # Test up to 3 suppliers
            
            for i in range(ai_tests_total):
                supplier = suppliers[i]
                supplier_id = supplier.get('id')
                supplier_name = supplier.get('supplier_name')
                
                print(f"\n   Testing AI for: {supplier_name}")
                
                # Add delay for AI processing
                time.sleep(2)
                
                success, deep_dive = self.run_test(
                    f"AI Generation - {supplier_name}", 
                    "GET", 
                    f"suppliers/{supplier_id}/deep-dive", 
                    200
                )
                
                if success:
                    content = deep_dive.get('content', {})
                    
                    # Check AI-generated content quality
                    checks = {
                        'headline': bool(content.get('headline')),
                        'action_plan': bool(content.get('action_plan')),
                        'case_study': bool(content.get('case_study_summary')),
                        'contract_clause': bool(content.get('contract_clause')),
                        'timeline': bool(content.get('feasibility_timeline'))
                    }
                    
                    passed_checks = sum(checks.values())
                    if passed_checks >= 4:  # At least 4 out of 5 fields
                        ai_tests_passed += 1
                        print(f"   ✅ AI content quality: {passed_checks}/5 fields")
                    else:
                        print(f"   ❌ AI content quality: {passed_checks}/5 fields")
                        print(f"   Missing: {[k for k, v in checks.items() if not v]}")
            
            # Log overall AI performance
            ai_success_rate = (ai_tests_passed / ai_tests_total) * 100
            if ai_success_rate >= 70:
                self.log_test("AI Integration Overall", True, f"{ai_success_rate:.1f}% success rate")
            else:
                self.log_test("AI Integration Overall", False, f"Only {ai_success_rate:.1f}% success rate")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Scope 3 Reduce API Testing")
        print(f"Backend URL: {self.base_url}")
        print(f"API URL: {self.api_url}")
        
        start_time = time.time()
        
        # Run test suites
        self.test_health_endpoints()
        
        # Seed data first
        if self.test_seed_data():
            self.create_test_session()
            self.test_auth_endpoints()
            self.test_supplier_endpoints()
            
            # NEW FEATURE TESTS
            self.test_filtering_endpoints()
            self.test_engagement_endpoints()
            self.test_pdf_export_endpoints()
            
            self.test_ai_integration()
        else:
            print("❌ Failed to seed data, skipping authenticated tests")
        
        # Print summary
        end_time = time.time()
        duration = end_time - start_time
        
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        
        # Return success if > 80% pass rate
        return (self.tests_passed / self.tests_run) >= 0.8

def main():
    """Main test runner"""
    tester = Scope3ReduceAPITester()
    
    try:
        success = tester.run_all_tests()
        
        # Save test results
        with open('/app/test_results.json', 'w') as f:
            json.dump({
                'summary': {
                    'tests_run': tester.tests_run,
                    'tests_passed': tester.tests_passed,
                    'success_rate': (tester.tests_passed/tester.tests_run)*100,
                    'timestamp': datetime.now().isoformat()
                },
                'results': tester.test_results
            }, f, indent=2)
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Test runner failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())