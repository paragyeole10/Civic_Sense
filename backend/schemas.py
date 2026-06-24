from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: Optional[str] = "citizen"

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(UserBase):
    id: int

    class Config:
        orm_mode = True
        from_attributes = True

class ComplaintImageOut(BaseModel):
    id: int
    image_url: str

    class Config:
        orm_mode = True
        from_attributes = True

class ResolutionLogOut(BaseModel):
    id: int
    updated_by: str
    status: str
    timestamp: datetime
    comments: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

class ComplaintOut(BaseModel):
    id: int
    user_id: int
    issue_type: str
    description: str
    latitude: float
    longitude: float
    severity: str
    severity_score: int
    status: str
    department: Optional[str] = None
    upvotes: int
    created_at: datetime
    is_duplicate: int
    master_ticket_id: Optional[int] = None
    images: List[ComplaintImageOut] = []
    logs: List[ResolutionLogOut] = []

    class Config:
        orm_mode = True
        from_attributes = True

class StatusUpdate(BaseModel):
    status: str
    department: Optional[str] = None
    comments: Optional[str] = None

class UpvoteRequest(BaseModel):
    complaint_id: int
