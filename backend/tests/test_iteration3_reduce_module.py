#!/usr/bin/env python3
"""
Backend API Testing for Iteration 3 - Scope 3 Reduce Module
Tests specific endpoints as requested in the review:
1. Health endpoint
2. Authentication requirement behavior
3. Authenticated endpoints (if possible)
4. Tech spec compliance for v1 endpoints
"""

import requests
import sys
import json
from datetime import datetime
import time

class Iteration3ReduceModuleTester:
    def __init__(self, base_url):
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
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def test_health_endpoint(self):
        """Test /api/health works"""
        print("\n" + "="*50)
        print("1. TESTING HEALTH ENDPOINT")
        print("="*50)
        
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    self.log_test("Health endpoint returns healthy status", True)
                    print(f"   Response: {data}")
                else:
                    self.log_test("Health endpoint returns healthy status", False, f"Unexpected response: {data}")
            else:
                self.log_test("Health endpoint returns healthy status", False, f"HTTP {response.status_code}")
        except Exception as e:
            self.log_test("Health endpoint returns healthy status", False, f"Request failed: {e}")

    def test_authentication_requirements(self):
        """Test authentication requirement behavior"""
        print("\n" + "="*50)
        print("2. TESTING AUTHENTICATION REQUIREMENTS")
        print("="*50)
        
        # Test unauthenticated call to /api/suppliers should return 401
        try:
            response = requests.get(f"{self.api_url}/suppliers", timeout=10)
            if response.status_code == 401:
                self.log_test("Unauthenticated /api/suppliers returns 401", True)
                print(f"   Response: {response.json()}")
            else:
                self.log_test("Unauthenticated /api/suppliers returns 401", False, 
                            f"Expected 401, got {response.status_code}")
        except Exception as e:
            self.log_test("Unauthenticated /api/suppliers returns 401", False, f"Request failed: {e}")

        # Test other protected endpoints
        protected_endpoints = [
            "suppliers/filter",
            "suppliers/heatmap", 
            "engagements",
            "pipeline/run"
        ]
        
        for endpoint in protected_endpoints:
            try:
                response = requests.get(f"{self.api_url}/{endpoint}", timeout=10)
                if response.status_code == 401:
                    self.log_test(f"Unauthenticated /{endpoint} returns 401", True)
                else:
                    self.log_test(f"Unauthenticated /{endpoint} returns 401", False, 
                                f"Expected 401, got {response.status_code}")
            except Exception as e:
                self.log_test(f"Unauthenticated /{endpoint} returns 401", False, f"Request failed: {e}")

    def attempt_authentication(self):
        """Attempt to get authenticated session"""
        print("\n" + "="*50)
        print("3. ATTEMPTING AUTHENTICATION")
        print("="*50)
        
        # Try using the test session token from the existing test
        self.session_token = "test_session_1770232854297"
        
        try:
            headers = {'Authorization': f'Bearer {self.session_token}'}
            response = requests.get(f"{self.api_url}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                user_data = response.json()
                self.log_test("Authentication with test session", True)
                print(f"   Authenticated as: {user_data.get('name', 'Unknown')}")
                return True
            else:
                self.log_test("Authentication with test session", False, 
                            f"HTTP {response.status_code}: {response.text}")
                self.session_token = None
                return False
        except Exception as e:
            self.log_test("Authentication with test session", False, f"Request failed: {e}")
            self.session_token = None
            return False

    def test_authenticated_endpoints(self):
        """Test authenticated endpoints if authentication successful"""
        if not self.session_token:
            print("\n❌ Skipping authenticated tests - no valid session")
            return
            
        print("\n" + "="*50)
        print("4. TESTING AUTHENTICATED ENDPOINTS")
        print("="*50)
        
        headers = {'Authorization': f'Bearer {self.session_token}'}
        
        # Test POST /api/pipeline/run (or /api/seed-data) seeds data
        try:
            response = requests.post(f"{self.api_url}/seed-data", headers=headers, timeout=30)
            if response.status_code == 200:
                data = response.json()
                self.log_test("POST /api/seed-data seeds data", True)
                print(f"   Seeded {data.get('count', 0)} suppliers")
            else:
                self.log_test("POST /api/seed-data seeds data", False, 
                            f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("POST /api/seed-data seeds data", False, f"Request failed: {e}")

        # Test GET /api/suppliers returns filtered suppliers
        try:
            response = requests.get(f"{self.api_url}/suppliers", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                suppliers = data.get('suppliers', [])
                
                # Verify filtering: only non-leader + upstream_impact_pct>0 suppliers
                valid_suppliers = []
                for supplier in suppliers:
                    upstream_impact = supplier.get('upstream_impact_pct', 0)
                    supplier_intensity = supplier.get('supplier_intensity', 0)
                    peer_intensity = supplier.get('peer_intensity', 0)
                    
                    if upstream_impact > 0 and supplier_intensity > peer_intensity:
                        valid_suppliers.append(supplier)
                
                if len(valid_suppliers) == len(suppliers):
                    self.log_test("GET /api/suppliers returns correctly filtered suppliers", True)
                    print(f"   Found {len(suppliers)} valid suppliers (non-leader, impact>0)")
                else:
                    self.log_test("GET /api/suppliers returns correctly filtered suppliers", False,
                                f"Found {len(valid_suppliers)}/{len(suppliers)} valid suppliers")
                    
                # Check if sorted by upstream_impact_pct desc
                if len(suppliers) > 1:
                    is_sorted = all(suppliers[i].get('upstream_impact_pct', 0) >= 
                                  suppliers[i+1].get('upstream_impact_pct', 0) 
                                  for i in range(len(suppliers)-1))
                    self.log_test("Suppliers sorted by upstream_impact_pct desc", is_sorted)
                
            else:
                self.log_test("GET /api/suppliers returns correctly filtered suppliers", False,
                            f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("GET /api/suppliers returns correctly filtered suppliers", False, f"Request failed: {e}")

        # Test GET /api/suppliers/filter with parameters
        filter_params = {
            "category": "Purchased Goods & Services",
            "rating": "C",
            "min_impact": "2.0",
            "min_reduction": "10.0"
        }
        
        try:
            response = requests.get(f"{self.api_url}/suppliers/filter", 
                                  headers=headers, params=filter_params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                suppliers = data.get('suppliers', [])
                filters = data.get('filters', {})
                
                self.log_test("GET /api/suppliers/filter with params works", True)
                print(f"   Filtered results: {len(suppliers)} suppliers")
                print(f"   Available categories: {len(filters.get('categories', []))}")
                print(f"   Available ratings: {filters.get('ratings', [])}")
            else:
                self.log_test("GET /api/suppliers/filter with params works", False,
                            f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("GET /api/suppliers/filter with params works", False, f"Request failed: {e}")

    def test_deep_dive_endpoints(self):
        """Test deep dive endpoints"""
        if not self.session_token:
            return
            
        print("\n" + "="*50)
        print("5. TESTING DEEP DIVE ENDPOINTS")
        print("="*50)
        
        headers = {'Authorization': f'Bearer {self.session_token}'}
        
        # Get a supplier ID first
        try:
            response = requests.get(f"{self.api_url}/suppliers", headers=headers, timeout=10)
            if response.status_code == 200:
                suppliers = response.json().get('suppliers', [])
                if suppliers:
                    supplier_id = suppliers[0]['id']
                    supplier_name = suppliers[0]['supplier_name']
                    print(f"   Testing with supplier: {supplier_name}")
                    
                    # Test legacy deep-dive endpoint
                    response = requests.get(f"{self.api_url}/suppliers/{supplier_id}/deep-dive", 
                                          headers=headers, timeout=15)
                    if response.status_code == 200:
                        data = response.json()
                        required_keys = ['meta', 'metrics', 'content']
                        has_all_keys = all(key in data for key in required_keys)
                        
                        if has_all_keys:
                            content = data['content']
                            has_evidence_status = 'evidence_status' in content
                            has_source_docs = 'source_docs' in content
                            has_source_citations = 'source_citations' in content
                            
                            if has_evidence_status and has_source_docs and has_source_citations:
                                self.log_test("Legacy deep-dive returns complete structure", True)
                                print(f"   Evidence status: {content.get('evidence_status')}")
                                print(f"   Source docs: {len(content.get('source_docs', []))}")
                                print(f"   Source citations: {len(content.get('source_citations', []))}")
                            else:
                                self.log_test("Legacy deep-dive returns complete structure", False,
                                            "Missing evidence_status, source_docs, or source_citations")
                        else:
                            self.log_test("Legacy deep-dive returns complete structure", False,
                                        f"Missing keys: {[k for k in required_keys if k not in data]}")
                    else:
                        self.log_test("Legacy deep-dive returns complete structure", False,
                                    f"HTTP {response.status_code}: {response.text}")
                    
                    # Test v1 tech spec endpoint
                    response = requests.get(f"{self.api_url}/v1/recommendations/supplier/{supplier_id}/deep-dive", 
                                          headers=headers, timeout=15)
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Check tech spec JSON contract compliance
                        required_v1_keys = ['meta', 'metrics', 'content']
                        has_v1_structure = all(key in data for key in required_v1_keys)
                        
                        if has_v1_structure:
                            meta = data['meta']
                            metrics = data['metrics'] 
                            content = data['content']
                            
                            # Check meta fields
                            meta_fields = ['supplier_name', 'peer_name', 'comparison_year']
                            has_meta = all(field in meta for field in meta_fields)
                            
                            # Check metrics fields
                            metrics_fields = ['current_intensity', 'target_intensity', 'reduction_potential_percentage']
                            has_metrics = all(field in metrics for field in metrics_fields)
                            
                            # Check content fields
                            content_fields = ['headline', 'action_plan', 'contract_clause', 'source_docs']
                            has_content = all(field in content for field in content_fields)
                            
                            if has_meta and has_metrics and has_content:
                                self.log_test("v1 deep-dive matches tech spec JSON contract", True)
                                print(f"   Meta: ✅ All required fields present")
                                print(f"   Metrics: ✅ All required fields present") 
                                print(f"   Content: ✅ All required fields present")
                            else:
                                missing = []
                                if not has_meta: missing.append("meta fields")
                                if not has_metrics: missing.append("metrics fields")
                                if not has_content: missing.append("content fields")
                                self.log_test("v1 deep-dive matches tech spec JSON contract", False,
                                            f"Missing: {', '.join(missing)}")
                        else:
                            self.log_test("v1 deep-dive matches tech spec JSON contract", False,
                                        f"Missing top-level keys: {[k for k in required_v1_keys if k not in data]}")
                    else:
                        self.log_test("v1 deep-dive matches tech spec JSON contract", False,
                                    f"HTTP {response.status_code}: {response.text}")
                        
        except Exception as e:
            self.log_test("Deep dive endpoint testing", False, f"Request failed: {e}")

    def test_engagement_and_export(self):
        """Test engagement updates and PDF export"""
        if not self.session_token:
            return
            
        print("\n" + "="*50)
        print("6. TESTING ENGAGEMENT & EXPORT")
        print("="*50)
        
        headers = {'Authorization': f'Bearer {self.session_token}'}
        
        # Get a supplier ID first
        try:
            response = requests.get(f"{self.api_url}/suppliers", headers=headers, timeout=10)
            if response.status_code == 200:
                suppliers = response.json().get('suppliers', [])
                if suppliers:
                    supplier_id = suppliers[0]['id']
                    supplier_name = suppliers[0]['supplier_name']
                    
                    # Test PUT /api/engagements/{supplier_id}
                    engagement_data = {
                        "status": "in_progress",
                        "notes": "Testing engagement update via API",
                        "next_action_date": "2025-02-15"
                    }
                    
                    response = requests.put(f"{self.api_url}/engagements/{supplier_id}", 
                                          headers=headers, json=engagement_data, timeout=10)
                    if response.status_code == 200:
                        data = response.json()
                        if (data.get('status') == 'in_progress' and 
                            data.get('notes') == engagement_data['notes']):
                            self.log_test("PUT /api/engagements creates/updates engagement", True)
                            print(f"   Updated engagement for: {supplier_name}")
                            print(f"   Status: {data.get('status')}")
                            print(f"   Notes: {data.get('notes')}")
                        else:
                            self.log_test("PUT /api/engagements creates/updates engagement", False,
                                        "Engagement data not properly saved")
                    else:
                        self.log_test("PUT /api/engagements creates/updates engagement", False,
                                    f"HTTP {response.status_code}: {response.text}")
                    
                    # Test GET /api/suppliers/{id}/export-pdf
                    response = requests.get(f"{self.api_url}/suppliers/{supplier_id}/export-pdf", 
                                          headers=headers, timeout=30)
                    if response.status_code == 200:
                        content_type = response.headers.get('content-type', '')
                        content_length = len(response.content)
                        
                        if 'application/pdf' in content_type and content_length > 1000:
                            self.log_test("GET /api/suppliers/{id}/export-pdf returns PDF", True)
                            print(f"   PDF generated: {content_length} bytes")
                            print(f"   Content-Type: {content_type}")
                        else:
                            self.log_test("GET /api/suppliers/{id}/export-pdf returns PDF", False,
                                        f"Invalid PDF: {content_type}, {content_length} bytes")
                    else:
                        self.log_test("GET /api/suppliers/{id}/export-pdf returns PDF", False,
                                    f"HTTP {response.status_code}: {response.text}")
                        
        except Exception as e:
            self.log_test("Engagement and export testing", False, f"Request failed: {e}")

    def run_all_tests(self):
        """Run all iteration 3 tests"""
        print("🚀 Starting Iteration 3 Reduce Module API Testing")
        print(f"Backend URL: {self.base_url}")
        print(f"API URL: {self.api_url}")
        
        start_time = time.time()
        
        # Run test suites in order
        self.test_health_endpoint()
        self.test_authentication_requirements()
        
        if self.attempt_authentication():
            self.test_authenticated_endpoints()
            self.test_deep_dive_endpoints()
            self.test_engagement_and_export()
        else:
            print("\n❌ Authentication failed - skipping authenticated endpoint tests")
            print("   Manual authentication via Emergent OAuth would be required for full testing")
        
        # Print summary
        end_time = time.time()
        duration = end_time - start_time
        
        print("\n" + "="*60)
        print("ITERATION 3 TEST SUMMARY")
        print("="*60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        
        if self.tests_run > 0:
            return (self.tests_passed / self.tests_run) >= 0.8
        return False

def main():
    """Main test runner"""
    tester = Iteration3ReduceModuleTester()
    
    try:
        success = tester.run_all_tests()
        
        # Save test results
        results_file = '/app/backend/tests/iteration3_test_results.json'
        with open(results_file, 'w') as f:
            json.dump({
                'summary': {
                    'tests_run': tester.tests_run,
                    'tests_passed': tester.tests_passed,
                    'success_rate': (tester.tests_passed/tester.tests_run)*100 if tester.tests_run > 0 else 0,
                    'timestamp': datetime.now().isoformat()
                },
                'results': tester.test_results
            }, f, indent=2)
        
        print(f"\n📄 Test results saved to: {results_file}")
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Test runner failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())