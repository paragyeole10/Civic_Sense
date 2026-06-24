# 💻 CivicAI CLI Run Guide

This guide explains how to manage, run, test, and interact with the **CivicAI** platform using the Command Line Interface (CLI).

---

## 📌 Table of Contents
1. [Prerequisites](#-prerequisites)
2. [Environment Setup](#-environment-setup)
3. [Running the Backend Server](#-running-the-backend-server)
4. [Running the Automated Test Suite](#-running-the-automated-test-suite)
5. [REST API CLI Interaction (cURL Examples)](#-rest-api-cli-interaction-curl-examples)
6. [Database Inspection via SQLite CLI](#-database-inspection-via-sqlite-cli)
7. [Troubleshooting](#-troubleshooting)

---

## 🛠️ Prerequisites
Before running CLI commands, ensure you have the following installed:
* **Python 3.10+** (verify with `python --version`)
* **cURL** (built-in on Windows 10+ and Unix systems) or a REST client
* **SQLite3 CLI** (optional, for direct database querying)

---

## ⚙️ Environment Setup

First, navigate to the project root directory:
```bash
cd d:\Civic_Sense_Project
```

### 1. Create the Virtual Environment (if not already created)
```bash
python -m venv venv
```

### 2. Activate the Virtual Environment
* **Windows (PowerShell):**
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
* **Windows (Command Prompt / CMD):**
  ```cmd
  .\venv\Scripts\activate.bat
  ```
* **Linux / macOS:**
  ```bash
  source venv/bin/activate
  ```

### 3. Install Dependencies
Ensure you have the virtual environment activated, then run:
```bash
pip install -r backend/requirements.txt
```

---

## 🚀 Running the Backend Server
Instead of using the double-click `run.bat` helper, you can start the FastAPI backend service directly from the terminal.

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Run the Uvicorn ASGI server:
   ```bash
   python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```
   * `--host 127.0.0.1`: Binds the server to localhost.
   * `--port 8000`: Sets the port to `8000`.
   * `--reload`: Enables auto-reloads when backend source files change (ideal for development).

---

## 🧪 Running the Automated Test Suite
CivicAI includes an automated API verification suite that tests DB seeding, registration, login, complaint submission, CLIP duplication detection, upvoting, status updates, analytics, and chat interactions.

To run it, make sure the backend server is **not running** on port 8000 (or it will clash during database setup), and run:
```bash
# Run from the project root directory
.\venv\Scripts\python backend/test_api.py
```

---

## 📡 REST API CLI Interaction (cURL Examples)
When the backend service is running on `http://127.0.0.1:8000`, you can interact with it using `curl` from a separate command window.

### 1. Citizen Registration
Creates a new citizen profile.
```bash
curl -X POST "http://127.0.0.1:8000/register" \
     -H "Content-Type: application/json" \
     -d "{\"name\": \"CLI User\", \"email\": \"cli_user@gmail.com\", \"phone\": \"9876543210\", \"role\": \"citizen\", \"password\": \"secure123\"}"
```

### 2. User Login
Logs in a user and returns an authentication token and user information.
```bash
curl -X POST "http://127.0.0.1:8000/login" \
     -H "Content-Type: application/json" \
     -d "{\"email\": \"cli_user@gmail.com\", \"password\": \"secure123\"}"
```

### 3. Submit a Complaint
Submits a civic issue using multipart form-data.
```bash
curl -X POST "http://127.0.0.1:8000/complaints" \
     -F "description=Large pothole on sector road causing slow traffic" \
     -F "latitude=28.4595" \
     -F "longitude=77.0266" \
     -F "user_id=1"
```
*(Optional: append `-F "image=@/path/to/image.jpg"` to upload an issue photo)*

### 4. Upvote a Complaint
Increases the upvote count for a complaint by ID (e.g. ID `1`) and triggers AI severity recalculation.
```bash
curl -X POST "http://127.0.0.1:8000/complaints/1/upvote"
```

### 5. Update Complaint Status (Officer Command)
Updates the resolution lifecycle stage and department route of a ticket.
```bash
curl -X PUT "http://127.0.0.1:8000/complaints/1/status" \
     -H "Content-Type: application/json" \
     -d "{\"status\": \"In Progress\", \"department\": \"PWD\", \"comments\": \"Work order generated. Crew scheduled for tomorrow.\"}"
```

### 6. Get Analytics Metrics
Fetches current platform KPIs (total/active tickets, resolution times, department distribution).
```bash
curl -X GET "http://127.0.0.1:8000/analytics"
```

### 7. Chat with CivicAI Assistant
Queries the AI policy and status assistant.
```bash
curl -X POST "http://127.0.0.1:8000/chat" \
     -H "Content-Type: application/json" \
     -d "{\"message\": \"status\", \"user_id\": 1}"
```

---

## 🗄️ Database Inspection via SQLite CLI
Since the backend uses a local SQLite database (`civic_sense.db`), you can inspect the data directly using command-line queries.

1. Open the database file using the SQLite command-line tool:
   ```bash
   sqlite3 civic_sense.db
   ```
2. Common inspection queries:
   * **List all tables:**
     ```sql
     .tables
     ```
   * **Display column headers and format output:**
     ```sql
     .headers on
     .mode column
     ```
   * **Query users:**
     ```sql
     SELECT id, name, email, role FROM users;
     ```
   * **Query active complaints:**
     ```sql
     SELECT id, issue_type, severity, status, department FROM complaints;
     ```
   * **Query resolution audit logs:**
     ```sql
     SELECT * FROM resolution_logs;
     ```
3. To exit the SQLite CLI:
   ```sql
   .exit
   ```

---

## 🔍 Troubleshooting

* **Address already in use error:**
  If you get an error that port `8000` is already in use, find and kill the process:
  * **Windows (PowerShell):**
    ```powershell
    Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
    ```
  * **Linux / macOS:**
    ```bash
    kill -9 $(lsof -t -i:8000)
    ```
* **Virtual Environment activation disabled error (Windows):**
  If Windows PowerShell blocks activation with an execution policy warning, run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
  ```
  Then try activating again.
