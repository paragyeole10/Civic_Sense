import math
import re
import random
from typing import Optional
from sqlalchemy.orm import Session
import models

# Department mapping
DEPARTMENT_ROUTING = {
    "Pothole": "PWD",
    "Road Damage": "PWD",
    "Garbage": "Sanitation",
    "Overflowing Dustbin": "Sanitation",
    "Broken Streetlight": "Electrical",
    "Water Leakage": "Water Department",
    "Open Manhole": "Water Department",
}

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate geodesic distance between two coordinates in meters."""
    R = 6371000.0  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    
    return R * c

def text_similarity(text1: str, text2: str) -> float:
    """Simulated CLIP/Sentence-Transformer text similarity using word set overlap."""
    words1 = set(re.findall(r'\w+', text1.lower()))
    words2 = set(re.findall(r'\w+', text2.lower()))
    if not words1 or not words2:
        return 0.0
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    return len(intersection) / len(union)

def run_ai_analysis(
    description: str, 
    image_filename: Optional[str], 
    lat: float, 
    lng: float, 
    db: Session
):
    """
    Simulates the full AI pipeline:
    1. YOLOv11 for issue classification
    2. DistilBERT NLP for text/location understanding
    3. XGBoost for Severity prediction
    4. CLIP for Duplicate detection
    5. Smart Routing for Department allocation
    """
    
    # --- 1. YOLOv11 Issue Detection ---
    # Try to identify issue from image name first, then text content
    detected_issue = "Pothole"  # Default fallback
    confidence = round(random.uniform(0.85, 0.99), 2)
    
    img_name_lower = (image_filename or "").lower()
    text_lower = description.lower()
    
    # Class mapping based on keywords
    classes = {
        "pothole": "Pothole",
        "cracks": "Road Damage",
        "road": "Road Damage",
        "garbage": "Garbage",
        "trash": "Garbage",
        "waste": "Garbage",
        "dustbin": "Overflowing Dustbin",
        "bin": "Overflowing Dustbin",
        "streetlight": "Broken Streetlight",
        "dark": "Broken Streetlight",
        "lamp": "Broken Streetlight",
        "leak": "Water Leakage",
        "water": "Water Leakage",
        "pipe": "Water Leakage",
        "manhole": "Open Manhole",
        "drain": "Open Manhole"
    }
    
    # Check image name first (stronger signal)
    found_issue = False
    for kw, cls in classes.items():
        if kw in img_name_lower:
            detected_issue = cls
            found_issue = True
            break
            
    # Check description text if not found in image
    if not found_issue:
        for kw, cls in classes.items():
            if kw in text_lower:
                detected_issue = cls
                break

    # --- 2. DistilBERT NLP Information Extraction ---
    # Extract location keywords (e.g., "near X", "at Y", "opposite Z")
    location_match = re.search(r'(?:near|at|opposite|in front of|beside)\s+([a-zA-Z0-9\s,]+)(?:\.|\b)', description, re.IGNORECASE)
    extracted_location = location_match.group(1).strip() if location_match else "Unspecified Location"
    
    # --- 3. XGBoost Severity Prediction ---
    # Base severity score depending on the issue class threat level
    threat_levels = {
        "Open Manhole": 45,
        "Water Leakage": 30,
        "Pothole": 25,
        "Road Damage": 20,
        "Broken Streetlight": 15,
        "Overflowing Dustbin": 10,
        "Garbage": 10,
    }
    
    severity_score = threat_levels.get(detected_issue, 10)
    
    # Add score for high-priority keywords
    critical_keywords = ["accident", "injury", "fell", "broken bone", "damage", "flooding", "danger", "hazard", "collision", "night", "darkness", "risk", "severe", "critical", "urgent", "skid"]
    for kw in critical_keywords:
        if kw in text_lower:
            severity_score += 15
            
    # Cap severity score at 100 and add small randomness
    severity_score = min(100, severity_score + random.randint(0, 10))
    
    # Map score to label
    if severity_score < 35:
        severity = "Low"
    elif severity_score < 60:
        severity = "Medium"
    elif severity_score < 80:
        severity = "High"
    else:
        severity = "Critical"

    # --- 4. Smart Department Routing ---
    department = DEPARTMENT_ROUTING.get(detected_issue, "General Administration")

    # --- 5. CLIP Duplicate Detection (Geospatial & Text Similarity) ---
    is_duplicate = 0
    master_ticket_id = None
    
    # Find active complaints of the same category
    active_complaints = db.query(models.Complaint).filter(
        models.Complaint.issue_type == detected_issue,
        models.Complaint.status != "Resolved",
        models.Complaint.is_duplicate == 0
    ).all()
    
    for comp in active_complaints:
        # Distance check (within 150 meters)
        dist = haversine_distance(lat, lng, comp.latitude, comp.longitude)
        if dist <= 150.0:
            # Semantic text check
            similarity = text_similarity(description, comp.description)
            # If close in distance and text similarity is reasonably high, flag as duplicate
            if similarity >= 0.4:
                is_duplicate = 1
                master_ticket_id = comp.id
                break

    return {
        "issue_type": detected_issue,
        "confidence": confidence,
        "extracted_location": extracted_location,
        "severity": severity,
        "severity_score": severity_score,
        "department": department,
        "is_duplicate": is_duplicate,
        "master_ticket_id": master_ticket_id
    }
