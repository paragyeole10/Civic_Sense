import sys
import os
from fastapi.testclient import TestClient

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app, hash_password
import database
import models

client = TestClient(app)

def test_api_workflow():
    print("[START] Starting CivicAI API Workflow Verification Tests...")
    
    # Reset database state for clean test run
    print("Resetting database tables...")
    db = database.SessionLocal()
    try:
        db.query(models.ResolutionLog).delete()
        db.query(models.ComplaintImage).delete()
        db.query(models.Complaint).delete()
        db.query(models.User).delete()
        db.commit()
    finally:
        db.close()
        
    # Re-seed default data
    from main import seed_data
    db = database.SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()
    
    # 1. Test Register
    print("Testing citizen registration...")
    reg_response = client.post("/register", json={
        "name": "Test Citizen",
        "email": "test_citizen@gmail.com",
        "phone": "9999999999",
        "role": "citizen",
        "password": "password123"
    })
    # If already registered, it might return 400. That's fine, we proceed.
    if reg_response.status_code == 200:
        print("[SUCCESS] Citizen registered successfully.")
    elif reg_response.status_code == 400 and "already registered" in reg_response.json().get("detail", ""):
        print("[SUCCESS] Citizen already registered (expected cache test success).")
    else:
        print(f"[ERROR] Registration failed: {reg_response.text}")
        assert False

    # 2. Test Login
    print("Testing citizen login...")
    login_response = client.post("/login", json={
        "email": "test_citizen@gmail.com",
        "password": "password123"
    })
    assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    user_data = login_response.json()
    token = user_data["token"]
    user_id = user_data["user"]["id"]
    print(f"[SUCCESS] Login successful. Token: {token}, User ID: {user_id}")

    # 3. Test Complaint Submission & AI Engine
    print("Testing complaint submission (Pothole)...")
    complaint_payload = {
        "description": "Critical danger: severe pothole near Sector 21 causing accidents and injuries.",
        "latitude": 28.6000,
        "longitude": 77.3000,
        "user_id": user_id
    }
    
    # Send request as form-data
    response = client.post("/complaints", data=complaint_payload)
    assert response.status_code == 200, f"Complaint submission failed: {response.text}"
    comp1 = response.json()
    assert comp1["issue_type"] == "Pothole", f"Expected Pothole, got {comp1['issue_type']}"
    assert comp1["severity"] in ["High", "Critical"], f"Expected High/Critical severity, got {comp1['severity']}"
    assert comp1["department"] == "PWD", f"Expected PWD department, got {comp1['department']}"
    print(f"[SUCCESS] Submission successful. Ticket ID: {comp1['id']}, Issue: {comp1['issue_type']}, Severity: {comp1['severity']}, Routed to: {comp1['department']}")

    # 4. Test Duplicate Detection (CLIP)
    print("Testing duplicate complaint detection (nearby same issue category)...")
    # Same location, same category (pothole is inferred from description)
    dup_payload = {
        "description": "pothole near Sector 21: severe danger of accident.",
        "latitude": 28.60005,
        "longitude": 77.30005,
        "user_id": user_id
    }
    response_dup = client.post("/complaints", data=dup_payload)
    assert response_dup.status_code == 200, f"Duplicate submission failed: {response_dup.text}"
    comp2 = response_dup.json()
    assert comp2["is_duplicate"] == 1, f"Expected is_duplicate to be 1, got {comp2['is_duplicate']}"
    assert comp2["master_ticket_id"] == comp1["id"], f"Expected master ticket to be {comp1['id']}, got {comp2['master_ticket_id']}"
    print(f"[SUCCESS] Duplicate detected successfully! Ticket #{comp2['id']} linked to master #{comp2['master_ticket_id']}.")

    # 5. Test Upvoting
    print(f"Testing upvote on ticket #{comp1['id']}...")
    upvote_response = client.post(f"/complaints/{comp1['id']}/upvote")
    assert upvote_response.status_code == 200, f"Upvote failed: {upvote_response.text}"
    assert upvote_response.json()["upvotes"] == 1
    print("[SUCCESS] Upvoting successfully increments count.")

    # 6. Test Status Management & Cascade Duplicate Resolution
    print(f"Updating status of master ticket #{comp1['id']} to In Progress...")
    status_response = client.put(f"/complaints/{comp1['id']}/status", json={
        "status": "In Progress",
        "comments": "PWD crew dispatched to site."
    })
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "In Progress"
    print("[SUCCESS] Status successfully changed to In Progress.")

    print(f"Resolving master ticket #{comp1['id']}...")
    status_response2 = client.put(f"/complaints/{comp1['id']}/status", json={
        "status": "Resolved",
        "comments": "Pothole filled with concrete."
    })
    assert status_response2.status_code == 200
    assert status_response2.json()["status"] == "Resolved"
    
    # Check if duplicate ticket was also resolved
    comp2_check = client.get(f"/complaints/{comp2['id']}").json()
    assert comp2_check["status"] == "Resolved", f"Expected duplicate ticket status to cascade to Resolved, got {comp2_check['status']}"
    print("[SUCCESS] Master ticket resolved, duplicate ticket cascaded to Resolved successfully!")

    # 7. Test Analytics
    print("Testing analytics metrics endpoint...")
    analytics_response = client.get("/analytics")
    assert analytics_response.status_code == 200, f"Analytics failed: {analytics_response.text}"
    metrics = analytics_response.json()
    assert metrics["total_complaints"] >= 5, f"Expected at least 5 complaints, got {metrics['total_complaints']}"
    assert metrics["resolved_complaints"] >= 2, "Expected resolved complaints to be updated"
    print(f"[SUCCESS] Analytics verified. Total complaints in database: {metrics['total_complaints']}")

    # 8. Test Chatbot
    print("Testing Ask CivicAI chatbot...")
    chat_response = client.post("/chat", json={"message": "status", "user_id": user_id})
    assert chat_response.status_code == 200
    print(f"[SUCCESS] Chatbot status response: '{chat_response.json()['response']}'")
    
    print("\n[SUCCESS] ALL VERIFICATION TESTS PASSED SUCCESSFULLY! [SUCCESS]")

if __name__ == "__main__":
    test_api_workflow()
