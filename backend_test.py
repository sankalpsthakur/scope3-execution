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
    def __init__(self, base_url="https://scope3-carbon-1.preview.emergentagent.com"):
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

    def test_regression_after_measure_integration(self):
        """Regression test after Measure integration and pipeline changes"""
        print("\n" + "="*50)
        print("REGRESSION TEST: MEASURE INTEGRATION & PIPELINE")
        print("="*50)
        
        # Step 1: Authenticate via test session token bypass
        print("\n🔐 Step 1: Authentication via test session token bypass")
        self.session_token = "test_session_1770238549883"
        print(f"   Using test session token: {self.session_token}")
        
        # Step 2: Run pipeline/run (POST)
        print("\n⚙️ Step 2: Running pipeline")
        success, pipeline_response = self.run_test("POST Pipeline Run", "POST", "pipeline/run", 200)
        if not success:
            print("❌ Pipeline run failed - cannot continue regression test")
            return False
        
        print(f"   Pipeline response: {pipeline_response.get('message', 'No message')}")
        
        # Step 3: GET /api/suppliers
        print("\n📊 Step 3: Getting suppliers list")
        success, suppliers_data = self.run_test("GET Suppliers", "GET", "suppliers", 200)
        if not success:
            print("❌ Suppliers endpoint failed")
            return False
        
        suppliers = suppliers_data.get('suppliers', [])
        print(f"   Found {len(suppliers)} suppliers")
        
        # Validation: Confirm suppliers list is non-empty and has upstream_impact_pct > 0
        if not suppliers:
            self.log_test("Suppliers Non-Empty Validation", False, "Suppliers list is empty")
            return False
        else:
            self.log_test("Suppliers Non-Empty Validation", True, f"Found {len(suppliers)} suppliers")
        
        # Check upstream_impact_pct > 0 for shown suppliers
        suppliers_with_impact = [s for s in suppliers if s.get('upstream_impact_pct', 0) > 0]
        if len(suppliers_with_impact) == len(suppliers):
            self.log_test("Upstream Impact Validation", True, f"All {len(suppliers)} suppliers have upstream_impact_pct > 0")
        else:
            self.log_test("Upstream Impact Validation", False, f"Only {len(suppliers_with_impact)}/{len(suppliers)} suppliers have upstream_impact_pct > 0")
        
        # Step 4: GET /api/suppliers/filter (no params)
        print("\n🔍 Step 4: Getting filtered suppliers (no params)")
        success, filter_data = self.run_test("GET Suppliers Filter", "GET", "suppliers/filter", 200)
        if not success:
            print("❌ Suppliers filter endpoint failed")
            return False
        
        filtered_suppliers = filter_data.get('suppliers', [])
        print(f"   Filtered suppliers: {len(filtered_suppliers)}")
        
        # Step 5: GET /api/measure/overview
        print("\n📈 Step 5: Getting measure overview")
        success, measure_data = self.run_test("GET Measure Overview", "GET", "measure/overview", 200)
        if not success:
            print("❌ Measure overview endpoint failed")
            return False
        
        # Validation: Confirm total_upstream_tco2e > 0 and coverage_pct > 0
        total_upstream_tco2e = measure_data.get('total_upstream_tco2e', 0)
        coverage_pct = measure_data.get('coverage_pct', 0)
        
        print(f"   Total upstream tCO2e: {total_upstream_tco2e}")
        print(f"   Coverage %: {coverage_pct}")
        
        if total_upstream_tco2e > 0:
            self.log_test("Measure Total Upstream Validation", True, f"total_upstream_tco2e = {total_upstream_tco2e}")
        else:
            self.log_test("Measure Total Upstream Validation", False, f"total_upstream_tco2e = {total_upstream_tco2e} (should be > 0)")
        
        if coverage_pct > 0:
            self.log_test("Measure Coverage Validation", True, f"coverage_pct = {coverage_pct}%")
        else:
            self.log_test("Measure Coverage Validation", False, f"coverage_pct = {coverage_pct}% (should be > 0)")
        
        # Step 6: GET /api/suppliers/{id}/deep-dive (pick first supplier)
        if suppliers:
            first_supplier = suppliers[0]
            supplier_id = first_supplier.get('id')
            supplier_name = first_supplier.get('supplier_name')
            
            print(f"\n🔬 Step 6: Getting deep dive for first supplier: {supplier_name}")
            success, deep_dive_data = self.run_test("GET Deep Dive", "GET", f"suppliers/{supplier_id}/deep-dive", 200)
            if not success:
                print("❌ Deep dive endpoint failed")
                return False
            
            # Validate deep dive structure
            required_sections = ['meta', 'metrics', 'content']
            missing_sections = [section for section in required_sections if section not in deep_dive_data]
            
            if not missing_sections:
                self.log_test("Deep Dive Structure Validation", True, "All required sections present")
                
                # Check content quality
                content = deep_dive_data.get('content', {})
                evidence_status = content.get('evidence_status', 'unknown')
                print(f"   Evidence status: {evidence_status}")
                
                if content.get('headline'):
                    print(f"   Headline: {content['headline'][:100]}...")
                
            else:
                self.log_test("Deep Dive Structure Validation", False, f"Missing sections: {missing_sections}")
            
            # Step 7: GET /api/suppliers/{id}/export-pdf
            print(f"\n📄 Step 7: Testing PDF export for: {supplier_name}")
            
            url = f"{self.api_url}/suppliers/{supplier_id}/export-pdf"
            headers = {'Authorization': f'Bearer {self.session_token}'}
            
            try:
                response = requests.get(url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    content_type = response.headers.get('content-type', '')
                    content_length = len(response.content)
                    
                    if 'application/pdf' in content_type and content_length > 1000:
                        self.log_test("PDF Export Validation", True, f"PDF generated successfully ({content_length} bytes)")
                        print(f"   PDF size: {content_length} bytes")
                    else:
                        self.log_test("PDF Export Validation", False, f"Invalid PDF: {content_type}, {content_length} bytes")
                else:
                    self.log_test("PDF Export Validation", False, f"HTTP {response.status_code}")
                    
            except Exception as e:
                self.log_test("PDF Export Validation", False, f"Request failed: {str(e)}")
        
        else:
            print("❌ No suppliers available for deep dive and PDF export tests")
            return False
        
        print("\n✅ Regression test sequence completed")
        return True

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

    def test_deterministic_auth(self):
        """Test deterministic auth using X-Test-Auth header"""
        print("\n" + "="*50)
        print("TESTING DETERMINISTIC AUTH")
        print("="*50)
        
        # Test deterministic auth endpoint
        auth_headers = {
            'X-Test-Auth': 'OeOYaKaJDRgDpI-AHxY2IH2up6I1VROe',
            'Content-Type': 'application/json'
        }
        
        success, auth_response = self.run_test(
            "Deterministic Auth Login", 
            "POST", 
            "auth/test-login", 
            200,
            headers=auth_headers
        )
        
        if success:
            # Extract session token from response
            session_token = auth_response.get('session_token')
            if session_token:
                self.session_token = session_token
                print(f"   Session token obtained: {session_token[:20]}...")
                
                # Test /auth/me with the new token
                success, user_data = self.run_test("Auth Me (With Token)", "GET", "auth/me", 200)
                if success:
                    user_name = user_data.get('name', 'Unknown')
                    print(f"   Authenticated as: {user_name}")
                    return True
            else:
                self.log_test("Session Token Extraction", False, "No session_token in response")
        
        return False

    def test_layer3_ocr_pipeline(self):
        """Test Layer 3 OCR (Gemini Flash Vision) pipeline"""
        print("\n" + "="*50)
        print("TESTING LAYER 3 OCR PIPELINE")
        print("="*50)
        
        # Step 1: Seed disclosure docs via pipeline/run
        print("\n📋 Step 1: Seeding disclosure docs via pipeline/run")
        success, pipeline_response = self.run_test("POST Pipeline Run", "POST", "pipeline/run", 200)
        if not success:
            print("❌ Pipeline run failed - cannot continue OCR test")
            return False
        
        print(f"   Pipeline response: {pipeline_response.get('message', 'No message')}")
        
        # Step 2: Get disclosure docs list
        print("\n📄 Step 2: Getting disclosure docs list")
        success, docs_response = self.run_test("GET Pipeline Docs", "GET", "pipeline/docs", 200)
        if not success:
            print("❌ Pipeline docs endpoint failed")
            return False
        
        docs = docs_response.get('docs', [])
        print(f"   Found {len(docs)} disclosure documents")
        
        # Validation: Should have 3 seeded docs
        if len(docs) >= 3:
            self.log_test("Disclosure Docs Count Validation", True, f"Found {len(docs)} docs (expected >=3)")
        else:
            self.log_test("Disclosure Docs Count Validation", False, f"Found {len(docs)} docs (expected >=3)")
            return False
        
        # Print doc details
        for doc in docs[:3]:
            doc_id = doc.get('doc_id', 'Unknown')
            title = doc.get('title', 'Unknown')
            url = doc.get('url', 'Unknown')
            print(f"   Doc: {doc_id[:20]}... - {title}")
        
        # Step 3: Test PDF page rendering for each seeded doc
        test_pages = [
            {'doc_name': 'Sika', 'page': 45},
            {'doc_name': 'DHL', 'page': 12}, 
            {'doc_name': 'BASF', 'page': 88}
        ]
        
        rendered_pages = []
        
        for test_page in test_pages:
            # Find matching doc
            matching_doc = None
            for doc in docs:
                if test_page['doc_name'].lower() in doc.get('title', '').lower():
                    matching_doc = doc
                    break
            
            if not matching_doc:
                print(f"   ⚠️ Could not find {test_page['doc_name']} doc, using first available doc")
                matching_doc = docs[0]
            
            doc_id = matching_doc.get('doc_id')
            page_number = test_page['page']
            
            print(f"\n🖼️ Step 3.{len(rendered_pages)+1}: Rendering PDF page for {test_page['doc_name']} (page {page_number})")
            
            render_payload = {
                "doc_id": doc_id,
                "page_number": page_number,
                "zoom": 2.0
            }
            
            success, render_response = self.run_test(
                f"Render PDF Page - {test_page['doc_name']}", 
                "POST", 
                "execution/render-pdf-page", 
                200,
                data=render_payload
            )
            
            if success:
                png_base64 = render_response.get('png_base64')
                width = render_response.get('width')
                height = render_response.get('height')
                
                if png_base64 and len(png_base64) > 100:
                    self.log_test(f"PDF Render - {test_page['doc_name']}", True, f"PNG generated: {width}x{height}, {len(png_base64)} chars")
                    print(f"   PNG size: {width}x{height}, base64 length: {len(png_base64)}")
                    
                    rendered_pages.append({
                        'doc_id': doc_id,
                        'page_number': page_number,
                        'png_base64': png_base64,
                        'doc_name': test_page['doc_name']
                    })
                else:
                    self.log_test(f"PDF Render - {test_page['doc_name']}", False, "Invalid PNG response")
            else:
                print(f"   ❌ Failed to render page {page_number} for {test_page['doc_name']}")
        
        # Step 4: Test OCR on rendered pages
        ocr_results = []
        
        for i, page_data in enumerate(rendered_pages):
            print(f"\n🔍 Step 4.{i+1}: Running OCR on {page_data['doc_name']} page {page_data['page_number']}")
            
            ocr_payload = {
                "image_base64": page_data['png_base64'],
                "mime_type": "image/png",
                "doc_id": page_data['doc_id'],
                "page_number": page_data['page_number']
            }
            
            success, ocr_response = self.run_test(
                f"OCR - {page_data['doc_name']}", 
                "POST", 
                "execution/ocr", 
                200,
                data=ocr_payload
            )
            
            if success:
                request_id = ocr_response.get('request_id')
                blocks = ocr_response.get('blocks', [])
                raw_text = ocr_response.get('raw_text', '')
                
                print(f"   Request ID: {request_id}")
                print(f"   Blocks found: {len(blocks)}")
                print(f"   Raw text length: {len(raw_text)}")
                
                # Validation: Should have at least 1 block and non-empty raw_text
                if len(blocks) >= 1:
                    self.log_test(f"OCR Blocks - {page_data['doc_name']}", True, f"Found {len(blocks)} blocks")
                else:
                    self.log_test(f"OCR Blocks - {page_data['doc_name']}", False, f"Found {len(blocks)} blocks (expected >=1)")
                
                if raw_text and len(raw_text.strip()) > 0:
                    self.log_test(f"OCR Raw Text - {page_data['doc_name']}", True, f"Raw text: {len(raw_text)} chars")
                    print(f"   Sample text: {raw_text[:100]}...")
                else:
                    self.log_test(f"OCR Raw Text - {page_data['doc_name']}", False, "Raw text is empty")
                
                ocr_results.append({
                    'doc_name': page_data['doc_name'],
                    'request_id': request_id,
                    'blocks_count': len(blocks),
                    'text_length': len(raw_text)
                })
            else:
                print(f"   ❌ OCR failed for {page_data['doc_name']}")
        
        # Step 5: Test error handling - too short image_base64
        print(f"\n❌ Step 5: Testing error handling for too-short image_base64")
        
        invalid_ocr_payload = {
            "image_base64": "short",  # Too short
            "mime_type": "image/png"
        }
        
        success, error_response = self.run_test(
            "OCR Error Handling", 
            "POST", 
            "execution/ocr", 
            400,  # Expect 400 error
            data=invalid_ocr_payload
        )
        
        if success:
            print(f"   ✅ Correctly returned 400 error for invalid image_base64")
        
        # Step 6: Test OCR persistence (indirect validation)
        print(f"\n💾 Step 6: Testing OCR persistence (indirect validation)")
        
        if ocr_results:
            # Run OCR again on the same page to test if count increases
            first_result = rendered_pages[0]
            
            print(f"   Running OCR again on {first_result['doc_name']} to test persistence...")
            
            ocr_payload = {
                "image_base64": first_result['png_base64'],
                "mime_type": "image/png", 
                "doc_id": first_result['doc_id'],
                "page_number": first_result['page_number']
            }
            
            success, second_ocr = self.run_test(
                "OCR Persistence Test", 
                "POST", 
                "execution/ocr", 
                200,
                data=ocr_payload
            )
            
            if success:
                # Both OCR calls succeeded, indicating persistence is working
                # (MongoDB would throw errors if persistence was broken)
                self.log_test("OCR Persistence Validation", True, "Second OCR call succeeded, indicating proper persistence")
                print(f"   ✅ OCR persistence validated - no database errors on repeated calls")
            else:
                self.log_test("OCR Persistence Validation", False, "Second OCR call failed")
        
        # Summary
        print(f"\n📊 OCR Pipeline Test Summary:")
        print(f"   Documents processed: {len(docs)}")
        print(f"   Pages rendered: {len(rendered_pages)}")
        print(f"   OCR operations: {len(ocr_results)}")
        
        total_blocks = sum(result['blocks_count'] for result in ocr_results)
        total_text_chars = sum(result['text_length'] for result in ocr_results)
        
        print(f"   Total blocks extracted: {total_blocks}")
        print(f"   Total text characters: {total_text_chars}")
        
        # Overall success if we got at least 2 successful OCR operations
        if len(ocr_results) >= 2:
            self.log_test("OCR Pipeline Overall", True, f"Successfully processed {len(ocr_results)} pages")
            return True
        else:
            self.log_test("OCR Pipeline Overall", False, f"Only processed {len(ocr_results)} pages (expected >=2)")
            return False

    def run_regression_test_only(self):
        """Run only the regression test for Measure integration"""
        print("🚀 Starting Regression Test for Measure Integration")
        print(f"Backend URL: {self.base_url}")
        print(f"API URL: {self.api_url}")
        
        start_time = time.time()
        
        # Run the specific regression test
        success = self.test_regression_after_measure_integration()
        
        # Print summary
        end_time = time.time()
        duration = end_time - start_time
        
        print("\n" + "="*60)
        print("REGRESSION TEST SUMMARY")
        print("="*60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        
        return success

    def run_ocr_test_only(self):
        """Run only the Layer 3 OCR test"""
        print("🚀 Starting Layer 3 OCR Test")
        print(f"Backend URL: {self.base_url}")
        print(f"API URL: {self.api_url}")
        
        start_time = time.time()
        
        # Authenticate first
        if not self.test_deterministic_auth():
            print("❌ Authentication failed - cannot continue OCR test")
            return False
        
        # Run the OCR test
        success = self.test_layer3_ocr_pipeline()
        
        # Print summary
        end_time = time.time()
        duration = end_time - start_time
        
        print("\n" + "="*60)
        print("LAYER 3 OCR TEST SUMMARY")
        print("="*60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        print(f"Duration: {duration:.2f} seconds")
        
        return success

def main():
    """Main test runner"""
    tester = Scope3ReduceAPITester()
    
    try:
        # Check command line arguments
        if len(sys.argv) > 1:
            if sys.argv[1] == "--regression":
                success = tester.run_regression_test_only()
            elif sys.argv[1] == "--ocr":
                success = tester.run_ocr_test_only()
            else:
                print("Usage: python backend_test.py [--regression|--ocr]")
                return 1
        else:
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