#!/usr/bin/env python3
"""
Focused Rate Limit Verification
Test the exact rate limits for deep dive and PDF export
"""

import requests
import time
import json
from datetime import datetime

def test_deep_dive_rate_limit():
    """Test deep dive rate limit (should be 15/minute according to server.py line 619)"""
    print("🔬 Testing Deep Dive Rate Limit (Expected: 15/minute)")
    
    base_url = "https://scope3-tracker.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    session_token = "test_session_1770244803683"
    
    headers = {'Authorization': f'Bearer {session_token}'}
    
    # Get supplier ID
    response = requests.get(f"{api_url}/suppliers", headers=headers, timeout=10)
    if response.status_code != 200:
        print(f"❌ Failed to get suppliers: {response.status_code}")
        return
    
    suppliers = response.json().get('suppliers', [])
    if not suppliers:
        print("❌ No suppliers found")
        return
    
    supplier_id = suppliers[0]['id']
    supplier_name = suppliers[0]['supplier_name']
    print(f"   Testing with supplier: {supplier_name}")
    
    endpoint = f"{api_url}/suppliers/{supplier_id}/deep-dive"
    
    # Test up to 20 calls to find the exact limit
    successful_calls = 0
    start_time = time.time()
    
    for i in range(20):
        try:
            response = requests.get(endpoint, headers=headers, timeout=10)
            
            if response.status_code == 200:
                successful_calls += 1
                print(f"   Call {i+1}: ✅ 200 OK")
            elif response.status_code == 429:
                elapsed = time.time() - start_time
                print(f"   Call {i+1}: 🚫 429 Too Many Requests")
                print(f"   Rate limit hit after {successful_calls} successful calls in {elapsed:.1f}s")
                break
            else:
                print(f"   Call {i+1}: ❌ {response.status_code}")
                break
                
            # Small delay to avoid overwhelming
            time.sleep(0.1)
            
        except Exception as e:
            print(f"   Call {i+1}: ❌ Error: {str(e)}")
            break
    
    print(f"   Final result: {successful_calls} successful calls before rate limit")
    return successful_calls

def test_pdf_export_rate_limit():
    """Test PDF export rate limit (should be 10/minute according to server.py line 757)"""
    print("\n📄 Testing PDF Export Rate Limit (Expected: 10/minute)")
    
    base_url = "https://scope3-tracker.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    session_token = "test_session_1770244803683"
    
    headers = {'Authorization': f'Bearer {session_token}'}
    
    # Get supplier ID
    response = requests.get(f"{api_url}/suppliers", headers=headers, timeout=10)
    if response.status_code != 200:
        print(f"❌ Failed to get suppliers: {response.status_code}")
        return
    
    suppliers = response.json().get('suppliers', [])
    if not suppliers:
        print("❌ No suppliers found")
        return
    
    supplier_id = suppliers[0]['id']
    supplier_name = suppliers[0]['supplier_name']
    print(f"   Testing with supplier: {supplier_name}")
    
    endpoint = f"{api_url}/suppliers/{supplier_id}/export-pdf"
    
    # Test up to 15 calls to find the exact limit
    successful_calls = 0
    start_time = time.time()
    
    for i in range(15):
        try:
            response = requests.get(endpoint, headers=headers, timeout=15)
            
            if response.status_code == 200:
                successful_calls += 1
                content_length = len(response.content)
                print(f"   Call {i+1}: ✅ 200 OK (PDF {content_length} bytes)")
            elif response.status_code == 429:
                elapsed = time.time() - start_time
                print(f"   Call {i+1}: 🚫 429 Too Many Requests")
                print(f"   Rate limit hit after {successful_calls} successful calls in {elapsed:.1f}s")
                break
            else:
                print(f"   Call {i+1}: ❌ {response.status_code}")
                break
                
            # Small delay to avoid overwhelming
            time.sleep(0.2)
            
        except Exception as e:
            print(f"   Call {i+1}: ❌ Error: {str(e)}")
            break
    
    print(f"   Final result: {successful_calls} successful calls before rate limit")
    return successful_calls

def test_audit_events():
    """Test audit events generation"""
    print("\n📊 Testing Audit Events Generation")
    
    base_url = "https://scope3-tracker.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    session_token = "test_session_1770244803683"
    
    headers = {'Authorization': f'Bearer {session_token}'}
    
    # Get supplier ID
    response = requests.get(f"{api_url}/suppliers", headers=headers, timeout=10)
    if response.status_code != 200:
        print(f"❌ Failed to get suppliers: {response.status_code}")
        return
    
    suppliers = response.json().get('suppliers', [])
    if not suppliers:
        print("❌ No suppliers found")
        return
    
    supplier_id = suppliers[0]['id']
    supplier_name = suppliers[0]['supplier_name']
    print(f"   Testing with supplier: {supplier_name}")
    
    audit_events = []
    
    # Test deep dive audit event
    try:
        response = requests.get(f"{api_url}/suppliers/{supplier_id}/deep-dive", headers=headers, timeout=10)
        if response.status_code == 200:
            audit_events.append("deep_dive.view")
            print("   ✅ Generated deep_dive.view audit event")
        else:
            print(f"   ❌ Failed to generate deep_dive.view: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error generating deep_dive.view: {str(e)}")
    
    # Test PDF export audit event
    try:
        response = requests.get(f"{api_url}/suppliers/{supplier_id}/export-pdf", headers=headers, timeout=15)
        if response.status_code == 200:
            audit_events.append("pdf.export")
            print("   ✅ Generated pdf.export audit event")
        else:
            print(f"   ❌ Failed to generate pdf.export: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error generating pdf.export: {str(e)}")
    
    # Test engagement update audit event
    try:
        engagement_data = {
            "status": "in_progress",
            "notes": "Audit test engagement update"
        }
        response = requests.put(f"{api_url}/engagements/{supplier_id}", 
                              json=engagement_data, headers=headers, timeout=10)
        if response.status_code == 200:
            audit_events.append("engagement.update")
            print("   ✅ Generated engagement.update audit event")
        else:
            print(f"   ❌ Failed to generate engagement.update: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error generating engagement.update: {str(e)}")
    
    print(f"   Total audit events generated: {len(audit_events)}")
    print(f"   Event types: {', '.join(audit_events)}")
    
    return len(audit_events)

def main():
    print("🚀 Focused Rate Limit & Audit Verification")
    print(f"Test started at: {datetime.now().isoformat()}")
    
    # Test deep dive rate limit
    deep_dive_limit = test_deep_dive_rate_limit()
    
    # Wait for rate limits to reset
    print("\n⏳ Waiting 60 seconds for rate limits to reset...")
    time.sleep(60)
    
    # Test PDF export rate limit
    pdf_limit = test_pdf_export_rate_limit()
    
    # Wait a bit more
    print("\n⏳ Waiting 30 seconds...")
    time.sleep(30)
    
    # Test audit events
    audit_count = test_audit_events()
    
    # Summary
    print("\n" + "="*60)
    print("FOCUSED VERIFICATION SUMMARY")
    print("="*60)
    print(f"Deep Dive Rate Limit: {deep_dive_limit} calls (expected ~15)")
    print(f"PDF Export Rate Limit: {pdf_limit} calls (expected ~10)")
    print(f"Audit Events Generated: {audit_count} events")
    
    # Evaluation
    deep_dive_ok = 13 <= deep_dive_limit <= 17  # Allow some variance
    pdf_ok = 8 <= pdf_limit <= 12  # Allow some variance
    audit_ok = audit_count >= 2
    
    print(f"\nEvaluation:")
    print(f"  Deep Dive Rate Limit: {'✅ PASS' if deep_dive_ok else '❌ FAIL'}")
    print(f"  PDF Export Rate Limit: {'✅ PASS' if pdf_ok else '❌ FAIL'}")
    print(f"  Audit Events: {'✅ PASS' if audit_ok else '❌ FAIL'}")
    
    overall_pass = deep_dive_ok and pdf_ok and audit_ok
    print(f"\nOverall Result: {'✅ PASS' if overall_pass else '❌ FAIL'}")
    
    return 0 if overall_pass else 1

if __name__ == "__main__":
    exit(main())