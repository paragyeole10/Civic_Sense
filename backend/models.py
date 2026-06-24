import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    role = Column(String, default="citizen") # citizen, officer, field_worker
    hashed_password = Column(String, nullable=False)

    complaints = relationship("Complaint", back_populates="creator")

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issue_type = Column(String, index=True, nullable=False) # Pothole, Garbage, etc.
    description = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    severity = Column(String, default="Low") # Low, Medium, High, Critical
    severity_score = Column(Integer, default=0) # 0 to 100
    status = Column(String, default="Submitted") # Submitted, Verified, Assigned, In Progress, Resolved
    department = Column(String, nullable=True) # PWD, Sanitation, Electrical, Water
    upvotes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # For duplicate checking
    is_duplicate = Column(Integer, default=0) # 0 = false, 1 = true
    master_ticket_id = Column(Integer, ForeignKey("complaints.id"), nullable=True)

    creator = relationship("User", back_populates="complaints")
    images = relationship("ComplaintImage", back_populates="complaint", cascade="all, delete-orphan")
    logs = relationship("ResolutionLog", back_populates="complaint", cascade="all, delete-orphan")

class ComplaintImage(Base):
    __tablename__ = "complaint_images"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    image_url = Column(String, nullable=False)

    complaint = relationship("Complaint", back_populates="images")

class ResolutionLog(Base):
    __tablename__ = "resolution_logs"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    updated_by = Column(String, nullable=False) # User name or system
    status = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    comments = Column(String, nullable=True)

    complaint = relationship("Complaint", back_populates="logs")
