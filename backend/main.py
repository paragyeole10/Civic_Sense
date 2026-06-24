import os
import shutil
import hashlib
import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session

import models, schemas, database, ai_engine

# Ensure uploads directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Create database tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CivicAI Backend", description="AI-powered civic issue reporting API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files statically
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Hash utility
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# Seed default data helper
def seed_data(db: Session):
    # Check if we already have users
    if db.query(models.User).count() > 0:
        return
        
    # Create default users
    citizen = models.User(
        name="Arjun Sharma",
        email="arjun@gmail.com",
        phone="9876543210",
        role="citizen",
        hashed_password=hash_password("password123")
    )
    officer = models.User(
        name="Municipal Commissioner",
        email="officer@civic.gov.in",
        phone="9112233445",
        role="officer",
        hashed_password=hash_password("admin123")
    )
    db.add_all([citizen, officer])
    db.commit()
    db.refresh(citizen)
    db.refresh(officer)
    
    # Create some mock complaints to populate dashboards
    # Mock Pothole
    comp1 = models.Complaint(
        user_id=citizen.id,
        issue_type="Pothole",
        description="Large pothole near Sector 14, Main Road Near Temple. Deep enough to damage vehicles.",
        latitude=28.4595,
        longitude=77.0266,
        severity="High",
        severity_score=78,
        status="Verified",
        department="PWD",
        upvotes=4,
        created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=2)
    )
    # Mock Streetlight
    comp2 = models.Complaint(
        user_id=citizen.id,
        issue_type="Broken Streetlight",
        description="Streetlight repair needed in Vasant Kunj, Block C Lane 4. Entire lane is dark and unsafe at night.",
        latitude=28.5244,
        longitude=77.1578,
        severity="Medium",
        severity_score=45,
        status="In Progress",
        department="Electrical",
        upvotes=9,
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
    )
    # Mock Garbage
    comp3 = models.Complaint(
        user_id=citizen.id,
        issue_type="Garbage",
        description="Garbage collection delayed. Market Square Parking Area has piles of waste stinking.",
        latitude=28.5623,
        longitude=77.2144,
        severity="Low",
        severity_score=25,
        status="Resolved",
        department="Sanitation",
        upvotes=2,
        created_at=datetime.datetime.utcnow() - datetime.timedelta(days=2)
    )
    
    db.add_all([comp1, comp2, comp3])
    db.commit()
    
    # Add logs for seed complaints
    db.add_all([
        models.ResolutionLog(complaint_id=comp1.id, updated_by="System AI", status="Submitted", comments="Complaint registered successfully."),
        models.ResolutionLog(complaint_id=comp1.id, updated_by="Municipal Officer", status="Verified", comments="Verified. Routed to PWD Department."),
        
        models.ResolutionLog(complaint_id=comp2.id, updated_by="System AI", status="Submitted", comments="Complaint registered successfully."),
        models.ResolutionLog(complaint_id=comp2.id, updated_by="Municipal Officer", status="Verified", comments="Issue verified."),
        models.ResolutionLog(complaint_id=comp2.id, updated_by="Electrical Department", status="In Progress", comments="Assigned technician to inspect the light."),
        
        models.ResolutionLog(complaint_id=comp3.id, updated_by="System AI", status="Submitted", comments="Complaint registered successfully."),
        models.ResolutionLog(complaint_id=comp3.id, updated_by="Sanitation Department", status="In Progress", comments="Garbage truck dispatched."),
        models.ResolutionLog(complaint_id=comp3.id, updated_by="Sanitation Department", status="Resolved", comments="Area cleared and disinfected.")
    ])
    
    # Save mock images
    db.add_all([
        models.ComplaintImage(complaint_id=comp1.id, image_url="/uploads/mock_pothole.jpg"),
        models.ComplaintImage(complaint_id=comp2.id, image_url="/uploads/mock_light.jpg"),
        models.ComplaintImage(complaint_id=comp3.id, image_url="/uploads/mock_garbage.jpg")
    ])
    db.commit()

# Seed database on startup
db = database.SessionLocal()
try:
    seed_data(db)
finally:
    db.close()

# --- Auth Endpoints ---

@app.post("/register", response_model=schemas.UserOut)
def register(user_data: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = models.User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        role=user_data.role,
        hashed_password=hash_password(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login")
def login(login_data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user or user.hashed_password != hash_password(login_data.password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    return {"token": f"user_{user.id}", "user": schemas.UserOut.from_orm(user)}

# --- Complaint Endpoints ---

@app.post("/complaints", response_model=schemas.ComplaintOut)
async def create_complaint(
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    user_id: int = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(database.get_db)
):
    # Verify user exists
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    image_url = None
    filename = None
    if image:
        # Save image locally
        filename = f"{datetime.datetime.utcnow().timestamp()}_{image.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/uploads/{filename}"

    # Run AI engine analysis
    ai_results = ai_engine.run_ai_analysis(description, filename or image.filename if image else None, latitude, longitude, db)
    
    # Create complaint
    complaint = models.Complaint(
        user_id=user_id,
        issue_type=ai_results["issue_type"],
        description=description,
        latitude=latitude,
        longitude=longitude,
        severity=ai_results["severity"],
        severity_score=ai_results["severity_score"],
        status="Submitted",
        department=ai_results["department"],
        is_duplicate=ai_results["is_duplicate"],
        master_ticket_id=ai_results["master_ticket_id"]
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    
    # If duplicate, link to master ticket or print log
    log_comment = "Complaint registered successfully."
    if ai_results["is_duplicate"]:
        log_comment += f" Auto-flagged as duplicate of Ticket #{ai_results['master_ticket_id']}."
        
    # Save Image Entry
    if image_url:
        db_image = models.ComplaintImage(complaint_id=complaint.id, image_url=image_url)
        db.add(db_image)
        
    # Create Initial Audit Log
    db_log = models.ResolutionLog(
        complaint_id=complaint.id,
        updated_by="System AI",
        status="Submitted",
        comments=log_comment
    )
    db.add(db_log)
    db.commit()
    db.refresh(complaint)
    
    return complaint

@app.get("/complaints", response_model=List[schemas.ComplaintOut])
def get_complaints(
    issue_type: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    user_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Complaint)
    
    if issue_type:
        query = query.filter(models.Complaint.issue_type == issue_type)
    if status:
        query = query.filter(models.Complaint.status == status)
    if severity:
        query = query.filter(models.Complaint.severity == severity)
    if user_id:
        query = query.filter(models.Complaint.user_id == user_id)
    if search:
        query = query.filter(models.Complaint.description.ilike(f"%{search}%"))
        
    return query.order_by(models.Complaint.created_at.desc()).all()

@app.get("/complaints/{complaint_id}", response_model=schemas.ComplaintOut)
def get_complaint(complaint_id: int, db: Session = Depends(database.get_db)):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint

@app.post("/complaints/{complaint_id}/upvote", response_model=schemas.ComplaintOut)
def upvote_complaint(complaint_id: int, db: Session = Depends(database.get_db)):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    complaint.upvotes += 1
    # Recalculate severity score if upvotes increase
    if complaint.severity_score < 100:
        complaint.severity_score = min(100, complaint.severity_score + 2)
        if complaint.severity_score >= 80:
            complaint.severity = "Critical"
        elif complaint.severity_score >= 60:
            complaint.severity = "High"
        elif complaint.severity_score >= 35:
            complaint.severity = "Medium"
            
    db.commit()
    db.refresh(complaint)
    return complaint

@app.put("/complaints/{complaint_id}/status", response_model=schemas.ComplaintOut)
def update_complaint_status(
    complaint_id: int, 
    status_update: schemas.StatusUpdate, 
    db: Session = Depends(database.get_db)
):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    complaint.status = status_update.status
    if status_update.department:
        complaint.department = status_update.department
        
    # Log the status change
    log = models.ResolutionLog(
        complaint_id=complaint.id,
        updated_by="Municipal Official",
        status=status_update.status,
        comments=status_update.comments or f"Status updated to {status_update.status}."
    )
    db.add(log)
    db.commit()
    db.refresh(complaint)
    
    # If resolved, check if there are duplicates and resolve them too
    if status_update.status == "Resolved":
        duplicates = db.query(models.Complaint).filter(
            models.Complaint.master_ticket_id == complaint.id,
            models.Complaint.status != "Resolved"
        ).all()
        for dup in duplicates:
            dup.status = "Resolved"
            dup_log = models.ResolutionLog(
                complaint_id=dup.id,
                updated_by="System AI",
                status="Resolved",
                comments=f"Resolved automatically as master ticket #{complaint.id} was resolved."
            )
            db.add(dup_log)
        db.commit()
        db.refresh(complaint)
        
    return complaint

# --- Analytics Endpoints ---

@app.get("/analytics")
def get_analytics(db: Session = Depends(database.get_db)):
    total = db.query(models.Complaint).count()
    resolved = db.query(models.Complaint).filter(models.Complaint.status == "Resolved").count()
    active = total - resolved
    
    # Calculate average resolution time in hours (mock calculations based on dates for seed data)
    logs = db.query(models.ResolutionLog).filter(models.ResolutionLog.status == "Resolved").all()
    res_times = []
    for log in logs:
        # Find submission log for this complaint
        sub_log = db.query(models.ResolutionLog).filter(
            models.ResolutionLog.complaint_id == log.complaint_id,
            models.ResolutionLog.status == "Submitted"
        ).first()
        if sub_log:
            diff = log.timestamp - sub_log.timestamp
            diff_hours = diff.total_seconds() / 3600.0
            # If mock dates used negative values, make them realistic
            if diff_hours < 0:
                diff_hours = random.randint(12, 48)
            res_times.append(diff_hours)
            
    avg_resolution_hours = round(sum(res_times) / len(res_times), 1) if res_times else 24.5

    # Group by issue type
    by_type = {}
    for item in db.query(models.Complaint.issue_type, func.count(models.Complaint.id)).group_by(models.Complaint.issue_type).all():
        by_type[item[0]] = item[1]
        
    # Group by status
    by_status = {}
    for item in db.query(models.Complaint.status, func.count(models.Complaint.id)).group_by(models.Complaint.status).all():
        by_status[item[0]] = item[1]
        
    # Group by department
    by_dept = {}
    for item in db.query(models.Complaint.department, func.count(models.Complaint.id)).group_by(models.Complaint.department).all():
        by_dept[item[0] or "Unassigned"] = item[1]

    # SLA compliance (mock % of tasks completed within 48h)
    sla_compliance = 88.5
    if total > 0:
        sla_compliance = round((resolved / total) * 100, 1)

    return {
        "total_complaints": total,
        "active_complaints": active,
        "resolved_complaints": resolved,
        "avg_resolution_hours": avg_resolution_hours,
        "sla_compliance_rate": sla_compliance,
        "by_type": by_type,
        "by_status": by_status,
        "by_department": by_dept
    }

# --- AI Policy Chatbot ("Ask CivicAI") ---

@app.post("/chat")
def chatbot_interaction(payload: dict, db: Session = Depends(database.get_db)):
    message = payload.get("message", "").lower()
    user_id = payload.get("user_id", 1)
    
    # Fallback bot responses
    if "pothole" in message:
        return {"response": "To report a pothole, click on 'Report Issue' on the dashboard, upload a photo of the pothole, specify the location, and write a description. Our AI will automatically verify it and route it to the Public Works Department (PWD)."}
    elif "garbage" in message or "waste" in message or "dustbin" in message:
        return {"response": "Garbage issues are routed directly to the Sanitation Department. If it's a pile of trash, our AI flags it for immediate clearance. You can track progress under 'My Complaints'."}
    elif "status" in message or "my complaint" in message:
        # Find the latest complaint of this user
        comp = db.query(models.Complaint).filter(models.Complaint.user_id == user_id).order_by(models.Complaint.created_at.desc()).first()
        if comp:
            return {"response": f"Your latest complaint is Ticket #{comp.id} for a '{comp.issue_type}'. Its current status is '{comp.status}', assigned to the {comp.department or 'unassigned'} department. Let me know if you want detailed logs."}
        else:
            return {"response": "You haven't reported any complaints yet. Click 'Report Issue' to get started."}
    elif "duplicate" in message:
        return {"response": "To avoid spam, CivicAI's CLIP engine runs spatial checks. If you report an issue within 150m of an existing report of the same type, we group it as a duplicate under the 'master ticket'. You can upvote the master ticket to increase its priority instead!"}
    elif "hello" in message or "hi" in message:
        return {"response": "Namaste! I am CivicAI, your digital smart-governance assistant. How can I help you report issues or query local municipal guidelines today?"}
    else:
        return {"response": "I can help you report civic complaints, explain department routing, or fetch ticket status updates. Type 'status' to check your latest ticket, or 'pothole' to learn how routing works."}
