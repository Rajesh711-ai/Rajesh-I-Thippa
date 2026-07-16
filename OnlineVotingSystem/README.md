# Online Voting System (Python Flask + SQLite)

A secure, professional, and full-featured digital voting portal engineered for Computer Science students to study, run, and present.

## Technical Architecture
* **Frontend:** HTML5, CSS3, Bootstrap 5, Javascript
* **Backend:** Python 3, Flask Web Framework
* **Database:** SQLite (file-backed SQL database, automated schema initialization)
* **Template Engine:** Jinja2 (server-side rendering)
* **Security:** PBKDF2 Password Hashing (`werkzeug.security`), Session management, custom form controls, and SQL injection prevention.

## Directory Structure
When you execute the self-scaffolding launcher script, it automatically creates the entire project layout:
```text
OnlineVotingSystem/
│
├── app.py                     # Main Flask Application & Router
├── database.py                # Database Connection & Schema Config
├── requirements.txt           # Python Dependency Listing
├── README.md                  # System Documentation (This File)
│
├── instance/
│   └── voting.db              # SQLite Database File
│
├── static/
│   ├── css/
│   │   ├── style.css          # Landing Page & Theme Layouts
│   │   ├── dashboard.css      # User Dashboard Layout
│   │   └── admin.css          # Sidebar Admin Console Layout
│   └── js/
│       ├── validation.js      # Client-side form validations
│       └── chart.js           # Dynamic election results chart rendering
│
└── templates/
    ├── layout.html            # Core Base layout (Navbar, CSS/JS inclusions)
    ├── index.html             # Landing Page
    ├── register.html          # Registration form (duplicates checker)
    ├── login.html             # Voter login
    ├── dashboard.html         # User Dashboard (polls countdown/status)
    ├── vote.html              # Candidate cards with manifestos
    ├── success.html           # Confirmation splash screen
    ├── admin_login.html       # Hardcoded Admin gate
    ├── admin_dashboard.html   # Sidebar Admin Control Panel
    ├── users.html             # Searchable User management table
    ├── candidates.html        # Candidates list (add/edit modal triggers)
    ├── result.html            # Election tally reports
    └── settings.html          # System resets & Database backups
```

## How to Run Locally

### Prerequisites
1. Install Python 3.8 or higher on your machine.
2. Open your terminal or command prompt in this directory.

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Run the Application
Execute the self-scaffolding app launcher:
```bash
python app.py
```

The script will automatically detect if the files do not exist, create the entire `templates`, `static`, and `instance` folder structure, build the SQLite database, seed default candidates, and boot the development server on `http://127.0.0.1:5000`.

## Key Security Features Implemented
1. **Password Protection:** Plaintext passwords are never stored. The system employs PBKDF2 with SHA-256 salts.
2. **Double Vote Guards:** An automated database transaction verifies if `has_voted = True` for the session-bound voter, stopping duplicate submissions.
3. **Prepared Statements:** The SQLite database uses parameterized queries (`cursor.execute(query, params)`) to guard against SQL Injection exploits.
4. **Session Isolation:** Secure cookie checks ensure voters cannot inject voter IDs or access admin dashboards without active verification keys.
