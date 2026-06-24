# 🚀 CivicAI: How to Run the Project (Quick Guide)

This guide provides simple, step-by-step instructions to run the **CivicAI** (AI-Powered Civic Issue Reporting and Municipal Dashboard) platform. 

---

## ⚡ Option 1: One-Click Startup (Recommended)

The easiest way to start both the backend and frontend simultaneously is using the built-in startup batch script.

1. Navigate to the project root:
   ```bash
   cd d:\Civic_Sense_Project
   ```
2. Double-click the **`run.bat`** file in your file explorer, or run it directly from your terminal:
   ```cmd
   .\run.bat
   ```

**What this script does:**
* Starts the FastAPI backend service in a new terminal window on `http://127.0.0.1:8000`.
* Seeds the SQLite database (`civic_sense.db`) with default users and mock complaints.
* Automatically opens your default web browser to display the application.

---

## 💻 Option 2: Manual CLI Startup (Separate Terminals)

If you prefer to run the components manually, open two terminal windows inside `d:\Civic_Sense_Project`.

### 🖥️ 1. Start the Backend Server (Terminal 1)
Run these commands to navigate to the backend directory and launch the FastAPI server using the project's virtual environment:
```powershell
cd backend
..\venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
* **Status Page:** Once started, verify it by visiting `http://127.0.0.1:8000/docs` in your browser to view the interactive API swagger documentation.

---

### 🎨 2. Start the Frontend App (Terminal 2)
Run these commands to navigate to the frontend directory and serve the static files:
```powershell
cd frontend
..\venv\Scripts\python -m http.server 8080
```
* **Dashboard Page:** Open your browser and navigate to:
  ```text
  http://127.0.0.1:8080/index.html
  ```
  *(The frontend automatically connects to the backend API running at port `8000` to fetch maps, charts, and complaints data).*

---

## 🧪 3. Run Automated API Tests (Optional)
To verify database seeding, YOLO/CLIP simulations, status routing, upvoting, and chatbot functionality, execute the automated integration test suite:
```powershell
# Run from the project root directory (ensure backend server on port 8000 is closed)
.\venv\Scripts\python backend/test_api.py
```
If successful, the terminal will print `[SUCCESS] ALL VERIFICATION TESTS PASSED SUCCESSFULLY!`.
