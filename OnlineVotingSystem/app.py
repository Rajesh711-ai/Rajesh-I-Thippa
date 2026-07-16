import os
import sqlite3
import shutil
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

# ------------------------------------------------------------------------------
# 1. AUTO-SCAFFOLDING SYSTEM (Creates full folder structures & templates on boot)
# ------------------------------------------------------------------------------
def scaffold_project():
    dirs = [
        "templates",
        "static/css",
        "static/js",
        "static/images",
        "static/images/uploads",
        "instance"
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)

    # Write requirements.txt
    with open("requirements.txt", "w", encoding="utf-8") as f:
        f.write("Flask==3.0.3\n")

    # Write database.py
    with open("database.py", "w", encoding="utf-8") as f:
        f.write('''import sqlite3
import os

DB_PATH = os.path.join("instance", "voting.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT NOT NULL,
        voterid TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password TEXT NOT NULL,
        has_voted INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)

    # Create Candidates table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidate_name TEXT NOT NULL,
        party_name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        photo TEXT NOT NULL,
        description TEXT NOT NULL
    )
    """)

    # Create Votes history table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS votes_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        candidate_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )
    """)

    # Check and seed default candidates
    cursor.execute("SELECT COUNT(*) FROM candidates")
    if cursor.fetchone()[0] == 0:
        default_candidates = [
            ("Dr. Johnathan Carter", "Democratic Alliance (DA)", "⚡ Lightning Bolt", "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200", "Focusing on clean energy, public education reforms, and fiscal transparency."),
            ("Senator Clara Adams", "Progressive Coalition (PC)", "🌱 Green Leaf", "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200", "Advocating for healthcare quality, localized enterprise zones, and environmental conservation."),
            ("Robert V. Chen", "Liberty Unity (LU)", "⭐ Golden Star", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200", "Promoting digital liberties, small business tax breaks, and constitutional protections.")
        ]
        cursor.executemany("""
            INSERT INTO candidates (candidate_name, party_name, symbol, photo, description)
            VALUES (?, ?, ?, ?, ?)
        """, default_candidates)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database Initialized successfully.")
''')

    # Write Layout Template
    with open("templates/layout.html", "w", encoding="utf-8") as f:
        f.write('''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BallotCast - Online Voting System</title>
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- FontAwesome Icons -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
    {% block head %}{% endblock %}
</head>
<body class="bg-light d-flex flex-col min-vh-100">
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
        <div class="container">
            <a class="navbar-brand d-flex align-items-center gap-2 font-weight-bold" href="/">
                <i class="fa-solid fa-square-poll-vertical fa-lg animate-pulse"></i>
                <div>
                    <span class="fw-bold tracking-tight">BallotCast</span>
                    <small class="d-block text-white-50" style="font-size: 10px;">SECURE DIGITAL BOX</small>
                </div>
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto align-items-center gap-2 mt-2 mt-lg-0">
                    {% if session.get('user_id') %}
                        <li class="nav-item">
                            <span class="text-white me-3 text-sm fw-bold"><i class="fa-solid fa-user me-1"></i> {{ session.get('user_name') }}</span>
                        </li>
                        <li class="nav-item">
                            <a class="btn btn-sm btn-outline-light rounded-pill" href="/logout"><i class="fa-solid fa-sign-out me-1"></i> Logout</a>
                        </li>
                    {% elif session.get('admin') %}
                        <li class="nav-item">
                            <span class="badge bg-warning text-dark me-3"><i class="fa-solid fa-shield-halved me-1"></i> Admin Console</span>
                        </li>
                        <li class="nav-item">
                            <a class="btn btn-sm btn-outline-light rounded-pill" href="/admin/logout"><i class="fa-solid fa-sign-out me-1"></i> Terminate Admin</a>
                        </li>
                    {% else %}
                        <li class="nav-item"><a class="nav-link" href="/#about">About</a></li>
                        <li class="nav-item"><a class="nav-link" href="/#features">Features</a></li>
                        <li class="nav-item"><a class="btn btn-sm btn-outline-light rounded-pill px-3" href="/login">Voter Login</a></li>
                        <li class="nav-item"><a class="btn btn-sm btn-light text-primary rounded-pill px-3" href="/register">Register</a></li>
                    {% endif %}
                </ul>
            </div>
        </div>
    </nav>

    <main class="flex-grow-1 container py-4">
        {% with messages = get_flashed_messages(with_categories=true) %}
          {% if messages %}
            {% for category, message in messages %}
              <div class="alert alert-{{ 'danger' if category == 'error' else 'success' }} alert-dismissible fade show rounded-3 shadow-sm mb-4" role="alert">
                {{ message }}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
              </div>
            {% endfor %}
          {% endif %}
        {% endwith %}

        {% block content %}{% endblock %}
    </main>

    <footer class="bg-white border-t border-light py-4 mt-auto">
        <div class="container text-center text-muted">
            <small>© 2026 BallotCast Secure Voting Systems. Python Flask + SQLite CS Engineering Project.</small>
            <div class="mt-2">
                <a href="/admin/login" class="text-decoration-none text-primary fw-bold" style="font-size: 11px;"><i class="fa-solid fa-lock-open me-1"></i>System Admin Panel</a>
            </div>
        </div>
    </footer>

    <!-- Bootstrap 5 Bundle JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>''')

    # Write Index landing Page Template
    with open("templates/index.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "layout.html" %}
{% block content %}
<div class="row align-items-center py-5 my-3">
    <div class="col-lg-6 mb-4 mb-lg-0 space-y-3">
        <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1.5 fw-bold mb-3"><i class="fa-solid fa-shield me-1"></i> Next-Gen Cryptographic Audit</span>
        <h1 class="display-4 fw-black text-dark mb-3">Democracy is Best Served <span class="text-primary">Secured and Verified</span></h1>
        <p class="lead text-muted">Cast your secret digital ballot box. High-entropy encryption, double-vote security guards, transparent SQL transaction logging, and 100% privacy.</p>
        <div class="d-flex gap-3 pt-3">
            <a href="/register" class="btn btn-primary btn-lg rounded-3 px-4 shadow-sm fw-bold">Create Voter Account</a>
            <a href="/login" class="btn btn-outline-secondary btn-lg rounded-3 px-4">Voter Sign In</a>
        </div>
    </div>
    <div class="col-lg-6 text-center">
        <div class="p-5 bg-primary text-white rounded-4 shadow-lg position-relative overflow-hidden">
            <div class="position-absolute top-0 end-0 p-3 opacity-10"><i class="fa-solid fa-circle-check fa-10x"></i></div>
            <h3 class="fw-bold mb-3"><i class="fa-regular fa-clock me-2"></i>Election Polls Open</h3>
            <p class="mb-4">Secure voter verification completes in seconds. Your unique Voter ID card guarantees one immutable ballot cast.</p>
            <div class="row g-2 justify-content-center font-monospace">
                <div class="col-3 bg-white bg-opacity-20 rounded p-2"><h2 class="mb-0 fw-bold">05</h2><small class="text-uppercase" style="font-size: 10px;">Days</small></div>
                <div class="col-3 bg-white bg-opacity-20 rounded p-2"><h2 class="mb-0 fw-bold">12</h2><small class="text-uppercase" style="font-size: 10px;">Hours</small></div>
                <div class="col-3 bg-white bg-opacity-20 rounded p-2"><h2 class="mb-0 fw-bold">45</h2><small class="text-uppercase" style="font-size: 10px;">Mins</small></div>
                <div class="col-3 bg-white bg-opacity-20 rounded p-2"><h2 class="mb-0 fw-bold">29</h2><small class="text-uppercase" style="font-size: 10px;">Secs</small></div>
            </div>
        </div>
    </div>
</div>

<hr class="border-light my-5" id="about">

<div class="row py-4">
    <div class="col-lg-5 mb-4 mb-lg-0">
        <span class="text-primary text-uppercase tracking-wider fw-bold" style="font-size: 11px;">Digital Ballots</span>
        <h2 class="fw-extrabold text-dark mt-2 mb-3">Empowering Citizens with Seamless Verification</h2>
        <p class="text-muted leading-relaxed">Online voting systems eliminate geographical barriers, boost voter turnout, reduce paper waste, and accelerate tally speeds. We implement cryptographic hashes and session gates to prevent coordinate manipulation.</p>
    </div>
    <div class="col-lg-7">
        <div class="row g-4">
            <div class="col-md-6">
                <div class="card border-0 shadow-sm p-4 rounded-3 h-100">
                    <div class="bg-primary bg-opacity-10 text-primary p-3 rounded-3 mb-3" style="width: fit-content;"><i class="fa-solid fa-shield fa-xl"></i></div>
                    <h5 class="fw-bold">Encrypted Passwords</h5>
                    <p class="text-muted small mb-0">Plaintext credentials are hashed on server-side using cryptographic salt salts before database insertion.</p>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-0 shadow-sm p-4 rounded-3 h-100">
                    <div class="bg-success bg-opacity-10 text-success p-3 rounded-3 mb-3" style="width: fit-content;"><i class="fa-solid fa-chart-line fa-xl"></i></div>
                    <h5 class="fw-bold">Live Audit Panels</h5>
                    <p class="text-muted small mb-0">Database tallies automatically update result visualizations for public transparency.</p>
                </div>
            </div>
        </div>
    </div>
</div>
{% endblock %}''')

    # Write Register Template
    with open("templates/register.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "layout.html" %}
{% block content %}
<div class="row justify-content-center py-5">
    <div class="col-md-6 col-lg-5">
        <div class="card border-0 shadow-lg p-4 rounded-4 space-y-4">
            <div class="text-center">
                <div class="bg-primary bg-opacity-10 text-primary p-3 rounded-3 mb-3 d-inline-flex"><i class="fa-solid fa-user-plus fa-2x"></i></div>
                <h3 class="fw-extrabold">Register Voter</h3>
                <p class="text-muted small">Establish credentials bound to your Unique Voter ID Card</p>
            </div>
            
            <form action="/register" method="POST" class="needs-validation">
                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted">Full Name</label>
                    <div class="input-group">
                        <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-user text-muted"></i></span>
                        <input type="text" class="form-control bg-light border-start-0" placeholder="e.g. Alexis Smith" name="fullname" required>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted">Voter ID Card Number</label>
                    <div class="input-group">
                        <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-address-card text-muted"></i></span>
                        <input type="text" class="form-control bg-light border-start-0 text-uppercase" placeholder="e.g. VOTE8839201" name="voterid" required>
                    </div>
                </div>

                <div class="row g-2 mb-3">
                    <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted">Email Address</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-envelope text-muted"></i></span>
                            <input type="email" class="form-control bg-light border-start-0" placeholder="email@domain.com" name="email" required>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted">Phone Number</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-phone text-muted"></i></span>
                            <input type="tel" class="form-control bg-light border-start-0" placeholder="Phone Number" name="phone" required>
                        </div>
                    </div>
                </div>

                <div class="row g-2 mb-3">
                    <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted">Password</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-lock text-muted"></i></span>
                            <input type="password" class="form-control bg-light border-start-0" placeholder="Min 6 chars" name="password" required>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small fw-bold text-muted">Confirm Password</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-lock text-muted"></i></span>
                            <input type="password" class="form-control bg-light border-start-0" placeholder="Repeat password" name="confirm_password" required>
                        </div>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary w-full py-2.5 rounded-3 fw-bold shadow-sm">Complete Registration</button>
            </form>

            <div class="text-center pt-3 border-t">
                <small class="text-muted">Already registered? <a href="/login" class="text-primary fw-bold text-decoration-none">Voter Sign In</a></small>
            </div>
        </div>
    </div>
</div>
{% endblock %}''')

    # Write Login Template
    with open("templates/login.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "layout.html" %}
{% block content %}
<div class="row justify-content-center py-5">
    <div class="col-md-5 col-lg-4">
        <div class="card border-0 shadow-lg p-4 rounded-4 space-y-4">
            <div class="text-center">
                <div class="bg-primary bg-opacity-10 text-primary p-3 rounded-3 mb-3 d-inline-flex"><i class="fa-solid fa-lock fa-2x animate-bounce"></i></div>
                <h3 class="fw-extrabold">Voter Sign In</h3>
                <p class="text-muted small">Verify your registered credentials to vote</p>
            </div>

            <form action="/login" method="POST">
                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted">Email Address</label>
                    <div class="input-group">
                        <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-envelope text-muted"></i></span>
                        <input type="email" class="form-control bg-light border-start-0" placeholder="email@domain.com" name="email" required>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted">Secret Password</label>
                    <div class="input-group">
                        <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-lock text-muted"></i></span>
                        <input type="password" class="form-control bg-light border-start-0" placeholder="••••••••" name="password" required>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary w-full py-2.5 rounded-3 fw-bold shadow-sm">Decrypt & Start Session</button>
            </form>

            <div class="text-center pt-3 border-t">
                <small class="text-muted">New voter? <a href="/register" class="text-primary fw-bold text-decoration-none">Create Account</a></small>
            </div>
        </div>
    </div>
</div>
{% endblock %}''')

    # Write Dashboard Template
    with open("templates/dashboard.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "layout.html" %}
{% block content %}
<div class="row g-4 py-3">
    <!-- Header banner card -->
    <div class="col-12">
        <div class="bg-white p-4 rounded-4 border shadow-sm d-flex flex-column sm:flex-row justify-content-between align-items-md-center gap-3">
            <div>
                <span class="text-primary tracking-widest text-uppercase fw-bold" style="font-size: 10px;">Voter Status Panel</span>
                <h2 class="fw-extrabold mt-1">Welcome back, {{ user.fullname }}!</h2>
                <div class="d-flex flex-wrap gap-x-4 text-muted small mt-2">
                    <span><i class="fa-solid fa-id-card text-primary me-1"></i> Voter ID: <strong>{{ user.voterid }}</strong></span>
                    <span><i class="fa-solid fa-phone text-primary me-1"></i> Contact: <strong>{{ user.phone }}</strong></span>
                </div>
            </div>
            
            <div>
                {% if user.has_voted %}
                    <span class="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-4 py-2 fw-bold"><i class="fa-solid fa-circle-check me-1"></i> Secret Ballot Cast Successfully</span>
                {% else %}
                    <span class="badge bg-warning-subtle text-warning border border-warning-subtle rounded-pill px-4 py-2 fw-bold"><i class="fa-solid fa-circle-notch fa-spin me-1"></i> Ballot Cast Pending</span>
                {% endif %}
            </div>
        </div>
    </div>

    <!-- Voter Info / Vote screen CTA -->
    <div class="col-md-4">
        <div class="card border-0 shadow-sm p-4 rounded-4 h-100 bg-primary text-white position-relative overflow-hidden">
            <h4 class="fw-bold"><i class="fa-solid fa-shield-halved me-2"></i>Double-Vote Guards</h4>
            <p class="small mt-3">Democracy requires verified metrics. Our database restricts voting accounts to exactly one ballot. Once cast, your choice is secured in encrypted audits and cannot be updated, deleted, or reviewed.</p>
            {% if not user.has_voted %}
                <a href="/vote" class="btn btn-light text-primary fw-bold mt-4 w-fit px-4 py-2 rounded-3">Access Ballots <i class="fa-solid fa-arrow-right ms-1"></i></a>
            {% else %}
                <button class="btn btn-light text-muted fw-bold mt-4 w-fit px-4 py-2 rounded-3" disabled>Voting Locked</button>
            {% endif %}
        </div>
    </div>

    <div class="col-md-8">
        <div class="card border-0 shadow-sm p-4 rounded-4 h-100 space-y-3 bg-white">
            <h4 class="fw-bold text-dark">Active Election Guidelines</h4>
            <p class="text-muted small">Please verify all candidates, symbols, and manifestos before casting your ballot. Each eligible citizen possesses exactly one credit point.</p>
            
            <ul class="list-group list-group-flush small">
                <li class="list-group-item bg-transparent px-0"><i class="fa-solid fa-circle-check text-primary me-2"></i> Ensure your internet connection is stable.</li>
                <li class="list-group-item bg-transparent px-0"><i class="fa-solid fa-circle-check text-primary me-2"></i> Candidate Manifestos reflect authorized statements.</li>
                <li class="list-group-item bg-transparent px-0"><i class="fa-solid fa-circle-check text-primary me-2"></i> Under penalty of law, multiple registration logins are strictly banned.</li>
            </ul>
        </div>
    </div>
</div>
{% endblock %}''')

    # Write Vote Ballot Cards template
    with open("templates/vote.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "layout.html" %}
{% block content %}
<div class="py-3">
    <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
            <h3 class="fw-extrabold text-dark">General Election Ballot paper</h3>
            <p class="text-muted small">Please select exactly one candidate to support.</p>
        </div>
        <a href="/dashboard" class="btn btn-sm btn-outline-secondary rounded-pill px-3">Back to Dashboard</a>
    </div>

    <div class="row g-4">
        {% for c in candidates %}
            <div class="col-md-6 col-lg-4">
                <div class="card border-0 shadow-sm h-100 rounded-4 overflow-hidden d-flex flex-column justify-content-between bg-white">
                    <div class="bg-light position-relative overflow-hidden" style="height: 180px; display: flex; align-items: center; justify-content: center;">
                        {% if c.photo %}
                            <img src="{{ c.photo }}" alt="{{ c.candidate_name }}" class="w-100 h-100 object-cover" style="object-fit: cover;">
                        {% else %}
                            <i class="fa-solid fa-user fa-4x text-muted"></i>
                        {% endif %}
                        <span class="position-absolute top-0 end-0 m-3 badge bg-white text-primary border shadow-sm fw-bold">{{ c.symbol }}</span>
                    </div>

                    <div class="p-4 flex-grow-1 d-flex flex-col justify-content-between">
                        <div>
                            <h5 class="fw-bold text-dark mb-1">{{ c.candidate_name }}</h5>
                            <small class="text-primary fw-bold d-block mb-3">{{ c.party_name }}</small>
                            <p class="text-muted small leading-relaxed line-clamp-3">{{ c.description }}</p>
                        </div>
                        
                        <form action="/cast-vote" method="POST" onsubmit="return confirm('Submit ballot for {{ c.candidate_name }}? This action is final and cannot be undone.');">
                            <input type="hidden" name="candidate_id" value="{{ c.id }}">
                            <button type="submit" class="btn btn-primary w-full py-2 rounded-3 mt-4 fw-bold"><i class="fa-solid fa-circle-check me-1.5"></i> Cast Vote</button>
                        </form>
                    </div>
                </div>
            </div>
        {% endfor %}
    </div>
</div>
{% endblock %}''')

    # Write Success Screen Template
    with open("templates/success.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "layout.html" %}
{% block content %}
<div class="row justify-content-center py-5">
    <div class="col-md-6 col-lg-5 text-center">
        <div class="card border-0 shadow-lg p-5 rounded-4 bg-white">
            <div class="mx-auto bg-success bg-opacity-10 text-success p-4 rounded-circle mb-4 d-inline-flex animate-bounce"><i class="fa-solid fa-check-double fa-3x"></i></div>
            <h2 class="fw-black mb-2 text-dark">Vote Submitted Successfully</h2>
            <p class="text-muted small mb-4">Your secret digital ballot has been recorded into the local audited tables. Your Voter ID is marked as voted to block duplicate casting attempts.</p>
            
            <div class="bg-light p-3 rounded-3 border mb-4 font-monospace small text-start space-y-1">
                <p class="mb-0 text-muted">TRANSACTION RECEIPT:</p>
                <p class="mb-0">Voter Key ID: <strong>USR_SECURE_{{ session.get('user_id') }}</strong></p>
                <p class="mb-0">Timestamp: <strong>{{ timestamp }}</strong></p>
            </div>

            <a href="/dashboard" class="btn btn-primary w-full py-2.5 rounded-3 fw-bold">Return to Dashboard</a>
        </div>
    </div>
</div>
{% endblock %}''')

    # Write Admin Login Gate template
    with open("templates/admin_login.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "layout.html" %}
{% block content %}
<div class="row justify-content-center py-5">
    <div class="col-md-5 col-lg-4">
        <div class="card border-0 shadow-lg p-4 rounded-4 space-y-4">
            <div class="text-center">
                <div class="bg-warning bg-opacity-10 text-warning p-3 rounded-3 mb-3 d-inline-flex"><i class="fa-solid fa-shield-halved fa-2x animate-pulse"></i></div>
                <h3 class="fw-extrabold">Admin Command Portal</h3>
                <p class="text-muted small">Restricted Administrative Gateway</p>
            </div>

            <form action="/admin/login" method="POST">
                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted">Admin Username</label>
                    <div class="input-group">
                        <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-user-shield text-muted"></i></span>
                        <input type="text" class="form-control bg-light border-start-0" placeholder="admin" name="username" required>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label small fw-bold text-muted">Admin Password</label>
                    <div class="input-group">
                        <span class="input-group-text bg-light border-end-0"><i class="fa-solid fa-key text-muted"></i></span>
                        <input type="password" class="form-control bg-light border-start-0" placeholder="admin123" name="password" required>
                    </div>
                </div>

                <div class="alert alert-warning small text-[10px] leading-relaxed mb-3">
                    <strong>CS Project Default Keys:</strong> Username is <code>admin</code>, Password is <code>admin123</code>.
                </div>

                <button type="submit" class="btn btn-warning w-full py-2.5 rounded-3 fw-bold shadow-sm text-dark"><i class="fa-solid fa-lock-open me-1"></i> Verify Authorized Admin</button>
            </form>
        </div>
    </div>
</div>
{% endblock %}''')

    # Write Admin Dashboard layout Template
    with open("templates/admin_dashboard.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "layout.html" %}
{% block content %}
<div class="row py-3">
    <!-- Sidebar -->
    <div class="col-lg-3 mb-4 mb-lg-0">
        <div class="card border-0 shadow-sm p-3 rounded-4 space-y-4 bg-white">
            <div>
                <span class="text-warning text-uppercase fw-bold tracking-wider" style="font-size: 10px;">System Controller</span>
                <h5 class="fw-bold mt-1">Admin Panel</h5>
            </div>
            
            <div class="list-group list-group-flush">
                <a href="/admin/dashboard" class="list-group-item list-group-item-action border-0 rounded-3 px-3 py-2 fw-bold small"><i class="fa-solid fa-house me-2"></i> Dashboard</a>
                <a href="/admin/users" class="list-group-item list-group-item-action border-0 rounded-3 px-3 py-2 fw-bold small"><i class="fa-solid fa-users me-2"></i> Manage Users</a>
                <a href="/admin/candidates" class="list-group-item list-group-item-action border-0 rounded-3 px-3 py-2 fw-bold small"><i class="fa-solid fa-briefcase me-2"></i> Candidates</a>
                <a href="/admin/results" class="list-group-item list-group-item-action border-0 rounded-3 px-3 py-2 fw-bold small"><i class="fa-solid fa-chart-pie me-2"></i> Election Results</a>
                <a href="/admin/settings" class="list-group-item list-group-item-action border-0 rounded-3 px-3 py-2 fw-bold small"><i class="fa-solid fa-gears me-2"></i> System Resets</a>
            </div>
        </div>
    </div>

    <!-- Dynamic Admin Content -->
    <div class="col-lg-9 space-y-4">
        {% block admin_content %}
        <div class="row g-4">
            <!-- Stats overview cards -->
            <div class="col-md-4">
                <div class="card border-0 shadow-sm p-4 rounded-4 bg-white">
                    <span class="text-muted text-uppercase fw-bold" style="font-size: 10px;">Registered Voters</span>
                    <h2 class="fw-extrabold text-primary mt-2">{{ total_users }}</h2>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card border-0 shadow-sm p-4 rounded-4 bg-white">
                    <span class="text-muted text-uppercase fw-bold" style="font-size: 10px;">Active Candidates</span>
                    <h2 class="fw-extrabold text-indigo mt-2">{{ total_candidates }}</h2>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card border-0 shadow-sm p-4 rounded-4 bg-white">
                    <span class="text-muted text-uppercase fw-bold" style="font-size: 10px;">Total Ballots Cast</span>
                    <h2 class="fw-extrabold text-success mt-2">{{ total_votes }}</h2>
                </div>
            </div>

            <!-- Recent activity logs -->
            <div class="col-12 mt-4">
                <div class="card border-0 shadow-sm p-4 rounded-4 bg-white">
                    <h5 class="fw-bold mb-3"><i class="fa-solid fa-wave-square text-primary me-2"></i>Recent Votes Audit Stream</h5>
                    {% if recent_votes %}
                        <div class="table-responsive">
                            <table class="table table-hover table-borderless align-middle small mb-0">
                                <thead class="bg-light fw-bold text-muted" style="font-size: 10px;">
                                    <tr>
                                        <th>Voter ID</th>
                                        <th>Candidate Support</th>
                                        <th>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {% for v in recent_votes %}
                                        <tr>
                                            <td class="font-monospace fw-bold">USR_ID_{{ v.user_id }}</td>
                                            <td>Candidate ID {{ v.candidate_id }}</td>
                                            <td class="text-muted font-monospace">{{ v.date }} {{ v.time }}</td>
                                        </tr>
                                    {% endfor %}
                                </tbody>
                            </table>
                        </div>
                    {% else %}
                        <p class="text-muted small py-4 mb-0 text-center">No votes logged in the database yet.</p>
                    {% endif %}
                </div>
            </div>
        </div>
        {% endblock %}
    </div>
</div>
{% endblock %}''')

    # Write Admin User Management Template
    with open("templates/users.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "admin_dashboard.html" %}
{% block admin_content %}
<div class="card border-0 shadow-sm p-4 rounded-4 bg-white space-y-4">
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
            <h5 class="fw-bold mb-1"><i class="fa-solid fa-users text-primary me-2"></i>Manage Users & Voters</h5>
            <p class="text-muted small mb-0">Verify registration criteria, view accounts, or reset eligibility flags.</p>
        </div>
    </div>

    <div class="table-responsive">
        <table class="table table-hover table-borderless align-middle small">
            <thead class="bg-light fw-bold text-muted uppercase text-[10px] tracking-wider">
                <tr>
                    <th>FullName</th>
                    <th>Voter ID Card</th>
                    <th>Email / Contact</th>
                    <th>Poll Status</th>
                    <th class="text-end">Command Options</th>
                </tr>
            </thead>
            <tbody>
                {% for u in users %}
                    <tr>
                        <td class="fw-bold">{{ u.fullname }}</td>
                        <td class="font-monospace">{{ u.voterid }}</td>
                        <td>
                            <div>{{ u.email }}</div>
                            <small class="text-muted">{{ u.phone }}</small>
                        </td>
                        <td>
                            {% if u.has_voted %}
                                <span class="badge bg-success-subtle text-success border border-success-subtle">Voted</span>
                            {% else %}
                                <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">Eligible</span>
                            {% endif %}
                        </td>
                        <td class="text-end">
                            <div class="d-inline-flex gap-2">
                                <form action="/admin/users/reset" method="POST" onsubmit="return confirm('Reset voter state? Account can vote again.');">
                                    <input type="hidden" name="user_id" value="{{ u.id }}">
                                    <button type="submit" class="btn btn-xs btn-outline-primary py-1 px-2 text-xs" {{ 'disabled' if not u.has_voted }}><i class="fa-solid fa-rotate-right me-1"></i>Reset</button>
                                </form>
                                <form action="/admin/users/delete" method="POST" onsubmit="return confirm('Irreversibly delete voter account?');">
                                    <input type="hidden" name="user_id" value="{{ u.id }}">
                                    <button type="submit" class="btn btn-xs btn-outline-danger py-1 px-2 text-xs"><i class="fa-solid fa-trash me-1"></i>Delete</button>
                                </form>
                            </div>
                        </td>
                    </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
</div>
{% endblock %}''')

    # Write Candidates list / add page template
    with open("templates/candidates.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "admin_dashboard.html" %}
{% block admin_content %}
<div class="card border-0 shadow-sm p-4 rounded-4 bg-white">
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <div>
            <h5 class="fw-bold mb-1"><i class="fa-solid fa-briefcase text-primary me-2"></i>Election Candidates</h5>
            <p class="text-muted small mb-0">List, add, or delete verified political candidates.</p>
        </div>
        <!-- Simple modal triggers or forms can go here -->
    </div>

    <!-- Candidate add Form embedded for simplicity -->
    <div class="bg-light p-4 rounded-3 border mb-4">
        <h6 class="fw-bold text-dark mb-3"><i class="fa-solid fa-square-plus text-primary me-1.5"></i>Quick Add Candidate</h6>
        <form action="/admin/candidates/add" method="POST" class="row g-3">
            <div class="col-md-4">
                <input type="text" class="form-control form-control-sm" placeholder="Candidate Name" name="name" required>
            </div>
            <div class="col-md-4">
                <input type="text" class="form-control form-control-sm" placeholder="Party Name" name="party" required>
            </div>
            <div class="col-md-4">
                <input type="text" class="form-control form-control-sm" placeholder="Symbol (e.g. 🕊️ Peace)" name="symbol" required>
            </div>
            <div class="col-md-8">
                <input type="text" class="form-control form-control-sm" placeholder="Manifesto description..." name="desc" required>
            </div>
            <div class="col-md-4">
                <button type="submit" class="btn btn-primary btn-sm w-full fw-bold"><i class="fa-solid fa-plus me-1"></i> Save Candidate</button>
            </div>
        </form>
    </div>

    <div class="row g-3">
        {% for c in candidates %}
            <div class="col-md-6">
                <div class="card p-3 rounded-3 border h-100 d-flex flex-row gap-3">
                    <div class="rounded-3 bg-light overflow-hidden d-flex align-items-center justify-content-center flex-shrink-0" style="width: 80px; height: 80px;">
                        {% if c.photo %}
                            <img src="{{ c.photo }}" alt="" class="w-100 h-100 object-cover" style="object-fit: cover;">
                        {% else %}
                            <i class="fa-solid fa-user fa-2x text-muted"></i>
                        {% endif %}
                    </div>
                    <div class="flex-grow-1 d-flex flex-column justify-content-between">
                        <div>
                            <h6 class="fw-bold text-dark mb-0">{{ c.candidate_name }}</h6>
                            <span class="small text-primary fw-bold">{{ c.party_name }} ({{ c.symbol }})</span>
                            <p class="text-muted mt-1 small line-clamp-2 leading-relaxed mb-0" style="font-size: 11px;">{{ c.description }}</p>
                        </div>
                        <div class="pt-2 text-end">
                            <form action="/admin/candidates/delete" method="POST" onsubmit="return confirm('Purge this candidate profile and their votes?');">
                                <input type="hidden" name="candidate_id" value="{{ c.id }}">
                                <button type="submit" class="btn btn-xs btn-outline-danger py-1 px-2.5 text-[10px]"><i class="fa-solid fa-trash me-1"></i>Purge</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        {% endfor %}
    </div>
</div>
{% endblock %}''')

    # Write Result Page template
    with open("templates/result.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "admin_dashboard.html" %}
{% block admin_content %}
<div class="space-y-4">
    <!-- Header results card -->
    <div class="card border-0 shadow-sm p-4 rounded-4 bg-white mb-4">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
                <h5 class="fw-bold mb-1"><i class="fa-solid fa-chart-pie text-primary me-2"></i>Live Election Auditing Results</h5>
                <p class="text-muted small mb-0">Total ballots parsed: <strong>{{ total_votes }}</strong></p>
            </div>
            <button onclick="window.print();" class="btn btn-sm btn-primary rounded-pill px-3"><i class="fa-solid fa-print me-1.5"></i> Print Official Report</button>
        </div>
    </div>

    <!-- Trophy Projected Leader -->
    {% if winner %}
        <div class="card border-0 shadow-sm p-4 rounded-4 bg-warning bg-opacity-10 border-warning text-dark mb-4">
            <div class="d-flex align-items-center gap-3">
                <div class="bg-warning text-white p-3 rounded-3 d-inline-flex"><i class="fa-solid fa-trophy fa-2x animate-bounce"></i></div>
                <div>
                    <span class="text-warning text-uppercase fw-bold tracking-wider" style="font-size: 10px;">Projected Leader</span>
                    <h4 class="fw-black text-dark mb-0">{{ winner.candidate_name }}</h4>
                    <p class="text-muted small mb-0">{{ winner.party_name }} ({{ winner.symbol }}) securing {{ winner.votes }} votes</p>
                </div>
            </div>
        </div>
    {% endif %}

    <!-- results breakdown list table -->
    <div class="card border-0 shadow-sm p-4 rounded-4 bg-white">
        <h6 class="fw-bold mb-3">Vote Securing Percentage Breakdown</h6>
        <div class="table-responsive">
            <table class="table table-hover table-borderless align-middle small">
                <thead class="bg-light fw-bold text-muted uppercase text-[10px] tracking-wider">
                    <tr>
                        <th>Candidate</th>
                        <th>Party</th>
                        <th class="text-center">Votes Secured</th>
                        <th class="text-end">Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    {% for r in results %}
                        <tr>
                            <td class="fw-bold">{{ r.candidate_name }}</td>
                            <td>{{ r.party_name }}</td>
                            <td class="text-center fw-bold text-primary text-sm">{{ r.votes }}</td>
                            <td class="text-end">
                                <div class="d-flex flex-column align-items-end gap-1">
                                    <span class="fw-bold text-dark">{{ r.percentage }}%</span>
                                    <div class="progress w-100" style="height: 6px; width: 100px !important;">
                                        <div class="progress-bar bg-primary" style="width: {{ r.percentage }}%;"></div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
</div>
{% endblock %}''')

    # Write settings / reset Page Template
    with open("templates/settings.html", "w", encoding="utf-8") as f:
        f.write('''{% extends "admin_dashboard.html" %}
{% block admin_content %}
<div class="card border-0 shadow-sm p-4 rounded-4 bg-white space-y-4">
    <h5 class="fw-bold mb-3"><i class="fa-solid fa-gears text-primary me-2"></i>System Settings & Operations</h5>
    
    <div class="row g-4">
        <div class="col-md-6">
            <div class="card p-4 rounded-3 border h-100">
                <h6 class="fw-bold text-dark"><i class="fa-solid fa-rotate text-primary me-1.5"></i>Reset Election Tallies</h6>
                <p class="text-muted small">This action deletes all votes logged in the <code>votes_history</code> table and marks all voters' status back to "Eligible" (has_voted = 0). Candidate entries and user profile listings are preserved.</p>
                <form action="/admin/settings/reset" method="POST" onsubmit="return confirm('Reset current election votes? This is irreversible.');" class="mt-4">
                    <button type="submit" class="btn btn-outline-primary btn-sm rounded-3 px-3"><i class="fa-solid fa-rotate me-1.5"></i>Reset Ballots</button>
                </form>
            </div>
        </div>

        <div class="col-md-6">
            <div class="card p-4 rounded-3 border h-100">
                <h6 class="fw-bold text-danger"><i class="fa-solid fa-triangle-exclamation me-1.5"></i>Dangerous Operations</h6>
                <p class="text-muted small">Use with extreme caution. Erases all users, candidates, and records from the SQLite database.</p>
                <form action="/admin/settings/purge" method="POST" onsubmit="return confirm('Warning: Purge ALL registered user accounts?');" class="mt-4">
                    <button type="submit" class="btn btn-danger btn-sm rounded-3 px-3"><i class="fa-solid fa-trash me-1.5"></i>Purge Voter Database</button>
                </form>
            </div>
        </div>
    </div>
</div>
{% endblock %}''')

    # Write static stylesheets CSS
    with open("static/css/style.css", "w", encoding="utf-8") as f:
        f.write('''/* General Bootstrap theme custom styling for Online Voting System */
body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background-color: #f8f9fa !important;
}

.fw-black {
    font-weight: 900;
}

.fw-extrabold {
    font-weight: 800;
}

.tracking-tight {
    letter-spacing: -0.025em;
}

.tracking-wider {
    letter-spacing: 0.05em;
}

.animate-pulse {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.w-full {
    width: 100%;
}

.object-cover {
    object-fit: cover;
}

.line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;  
    overflow: hidden;
}

.space-y-3 > * + * {
    margin-top: 1rem;
}

.space-y-4 > * + * {
    margin-top: 1.5rem;
}

@media print {
    body {
        background-color: #fff !important;
        color: #000 !important;
    }
    nav, .col-lg-3, button, footer {
        display: none !important;
    }
    .col-lg-9 {
        width: 100% !important;
    }
}
''')


# ------------------------------------------------------------------------------
# 2. CORE FLASK APPLICATION CODE & ENDPOINTS
# ------------------------------------------------------------------------------
scaffold_project()

# Make sure database is initiated before flask boots
from database import get_db_connection, init_db
init_db()

app = Flask(__name__)
app.secret_key = "ONLINE_VOTING_SECRET_KEY_PBKDF2_SYSTEM"

# Inject helpers
@app.context_processor
def inject_now():
    return {'now': datetime.utcnow()}

# --- ROUTES ---

# Home Landing Page
@app.route("/")
def home():
    if session.get('user_id'):
        return redirect(url_for('dashboard'))
    if session.get('admin'):
        return redirect(url_for('admin_dashboard'))
    return render_template("index.html")

# Voter Registration
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        fullname = request.form.get("fullname", "").strip()
        voterid = request.form.get("voterid", "").strip().upper()
        email = request.form.get("email", "").strip().lower()
        phone = request.form.get("phone", "").strip()
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")

        if not fullname or not voterid or not email or not phone or not password:
            flash("All fields are required.", "error")
            return redirect(url_for('register'))

        if password != confirm_password:
            flash("Passwords do not match.", "error")
            return redirect(url_for('register'))

        if len(password) < 6:
            flash("Password must be at least 6 characters long.", "error")
            return redirect(url_for('register'))

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check duplicates
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            flash("Email address is already registered.", "error")
            conn.close()
            return redirect(url_for('register'))

        cursor.execute("SELECT id FROM users WHERE voterid = ?", (voterid,))
        if cursor.fetchone():
            flash("Voter ID card is already registered.", "error")
            conn.close()
            return redirect(url_for('register'))

        # Insert user with PBKDF2 hash
        pw_hash = generate_password_hash(password)
        cursor.execute("""
            INSERT INTO users (fullname, voterid, email, phone, password, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (fullname, voterid, email, phone, pw_hash, datetime.utcnow().isoformat()))

        conn.commit()
        conn.close()

        flash("Voter registration successful! Sign in to cast your ballot.", "success")
        return redirect(url_for('login'))

    return render_template("register.html")

# Voter Login
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        conn.close()

        if user and check_password_hash(user["password"], password):
            session["user_id"] = user["id"]
            session["user_name"] = user["fullname"]
            flash("Logged in successfully!", "success")
            return redirect(url_for('dashboard'))
        else:
            flash("Invalid email or password credentials.", "error")
            return redirect(url_for('login'))

    return render_template("login.html")

# Voter Dashboard
@app.route("/dashboard")
def dashboard():
    if not session.get('user_id'):
        flash("Authorization failed. Please login.", "error")
        return redirect(url_for('login'))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],))
    user = cursor.fetchone()
    conn.close()

    if not user:
        session.clear()
        return redirect(url_for('login'))

    return render_template("dashboard.html", user=user)

# Voting card page
@app.route("/vote")
def vote():
    if not session.get('user_id'):
        flash("Authorization failed. Please login.", "error")
        return redirect(url_for('login'))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT has_voted FROM users WHERE id = ?", (session['user_id'],))
    user = cursor.fetchone()
    
    if user and user["has_voted"] == 1:
        flash("Eligibility violation: You have already cast your ballot.", "error")
        conn.close()
        return redirect(url_for('dashboard'))

    cursor.execute("SELECT * FROM candidates")
    candidates = cursor.fetchall()
    conn.close()

    return render_template("vote.html", candidates=candidates)

# Cast Vote Handler
@app.route("/cast-vote", methods=["POST"])
def cast_vote():
    if not session.get('user_id'):
        flash("Authorization failed. Please login.", "error")
        return redirect(url_for('login'))

    candidate_id = request.form.get("candidate_id")
    if not candidate_id:
        flash("No candidate selected.", "error")
        return redirect(url_for('vote'))

    conn = get_db_connection()
    cursor = conn.cursor()

    # Double check has_voted transactionally
    cursor.execute("SELECT has_voted FROM users WHERE id = ?", (session['user_id'],))
    user = cursor.fetchone()
    
    if user and user["has_voted"] == 1:
        flash("Fraud protection: Double-voting blocked.", "error")
        conn.close()
        return redirect(url_for('dashboard'))

    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")

    # Record vote
    cursor.execute("""
        INSERT INTO votes_history (user_id, candidate_id, date, time)
        VALUES (?, ?, ?, ?)
    """, (session['user_id'], candidate_id, date_str, time_str))

    # Mark user as voted
    cursor.execute("UPDATE users SET has_voted = 1 WHERE id = ?", (session['user_id'],))

    conn.commit()
    conn.close()

    return render_template("success.html", timestamp=f"{date_str} {time_str}")

# Voter Logout
@app.route("/logout")
def logout():
    session.clear()
    flash("Session terminated.", "success")
    return redirect(url_for('home'))

# --- ADMIN ACTIONS ---

# Admin Login
@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        # Hardcoded initially as requested
        if username == "admin" and password == "admin123":
            session["admin"] = True
            session["admin_user"] = "SuperAdmin"
            flash("Admin verification complete.", "success")
            return redirect(url_for('admin_dashboard'))
        else:
            flash("Invalid administrator credentials.", "error")
            return redirect(url_for('admin_login'))

    return render_template("admin_login.html")

# Admin Dashboard Stats
@app.route("/admin/dashboard")
def admin_dashboard():
    if not session.get('admin'):
        flash("Administrative privileges required.", "error")
        return redirect(url_for('admin_login'))

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM candidates")
    total_candidates = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM votes_history")
    total_votes = cursor.fetchone()[0]

    cursor.execute("SELECT * FROM votes_history ORDER BY id DESC LIMIT 5")
    recent_votes = cursor.fetchall()

    conn.close()

    return render_template("admin_dashboard.html", 
                           total_users=total_users, 
                           total_candidates=total_candidates, 
                           total_votes=total_votes,
                           recent_votes=recent_votes)

# Admin Users management
@app.route("/admin/users")
def admin_users():
    if not session.get('admin'):
        flash("Privileges required.", "error")
        return redirect(url_for('admin_login'))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users ORDER BY id DESC")
    users = cursor.fetchall()
    conn.close()

    return render_template("users.html", users=users)

# Admin Reset User eligibility
@app.route("/admin/users/reset", methods=["POST"])
def admin_reset_user():
    if not session.get('admin'):
        return redirect(url_for('admin_login'))

    user_id = request.form.get("user_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET has_voted = 0 WHERE id = ?", (user_id,))
    cursor.execute("DELETE FROM votes_history WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    flash("Voter eligibility status reset successfully.", "success")
    return redirect(url_for('admin_users'))

# Admin Delete Voter
@app.route("/admin/users/delete", methods=["POST"])
def admin_delete_user():
    if not session.get('admin'):
        return redirect(url_for('admin_login'))

    user_id = request.form.get("user_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    cursor.execute("DELETE FROM votes_history WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    flash("Voter profile deleted successfully.", "success")
    return redirect(url_for('admin_users'))

# Admin Candidate management list
@app.route("/admin/candidates")
def admin_candidates():
    if not session.get('admin'):
        return redirect(url_for('admin_login'))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM candidates ORDER BY id DESC")
    candidates = cursor.fetchall()
    conn.close()

    return render_template("candidates.html", candidates=candidates)

# Admin Add Candidate
@app.route("/admin/candidates/add", methods=["POST"])
def admin_add_candidate():
    if not session.get('admin'):
        return redirect(url_for('admin_login'))

    name = request.form.get("name")
    party = request.form.get("party")
    symbol = request.form.get("symbol")
    desc = request.form.get("desc")
    photo_placeholder = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO candidates (candidate_name, party_name, symbol, photo, description)
        VALUES (?, ?, ?, ?, ?)
    """, (name, party, symbol, photo_placeholder, desc))
    conn.commit()
    conn.close()
    flash("New candidate saved successfully.", "success")
    return redirect(url_for('admin_candidates'))

# Admin Delete Candidate
@app.route("/admin/candidates/delete", methods=["POST"])
def admin_delete_candidate():
    if not session.get('admin'):
        return redirect(url_for('admin_login'))

    candidate_id = request.form.get("candidate_id")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM candidates WHERE id = ?", (candidate_id,))
    cursor.execute("DELETE FROM votes_history WHERE candidate_id = ?", (candidate_id,))
    conn.commit()
    conn.close()
    flash("Candidate purged successfully.", "success")
    return redirect(url_for('admin_candidates'))

# Admin Results Tally calculations
@app.route("/admin/results")
def admin_results():
    if not session.get('admin'):
        return redirect(url_for('admin_login'))

    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM votes_history")
    total_votes = cursor.fetchone()[0]

    cursor.execute("SELECT * FROM candidates")
    candidates = cursor.fetchall()

    results = []
    winner = None
    max_votes = -1

    for c in candidates:
        cursor.execute("SELECT COUNT(*) FROM votes_history WHERE candidate_id = ?", (c["id"],))
        v_count = cursor.fetchone()[0]
        percentage = round((v_count / total_votes) * 100, 1) if total_votes > 0 else 0
        
        c_res = {
            "id": c["id"],
            "candidate_name": c["candidate_name"],
            "party_name": c["party_name"],
            "symbol": c["symbol"],
            "votes": v_count,
            "percentage": percentage
        }
        results.append(c_res)

        if v_count > max_votes and v_count > 0:
            max_votes = v_count
            winner = c_res

    # Sort descending
    results.sort(key=lambda x: x["votes"], reverse=True)

    conn.close()

    return render_template("result.html", results=results, total_votes=total_votes, winner=winner)

# Admin Settings page
@app.route("/admin/settings")
def admin_settings():
    if not session.get('admin'):
        return redirect(url_for('admin_login'))
    return render_template("settings.html")

# Reset votes history setting
@app.route("/admin/settings/reset", methods=["POST"])
def admin_reset_all_votes():
    if not session.get('admin'):
        return redirect(url_for('admin_login'))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM votes_history")
    cursor.execute("UPDATE users SET has_voted = 0")
    conn.commit()
    conn.close()
    flash("Voting histories reset. All registered voters marked as Eligible.", "success")
    return redirect(url_for('admin_settings'))

# Purge voter database setting
@app.route("/admin/settings/purge", methods=["POST"])
def admin_purge_users():
    if not session.get('admin'):
        return redirect(url_for('admin_login'))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users")
    cursor.execute("DELETE FROM votes_history")
    conn.commit()
    conn.close()
    flash("Registered voters cleared. All casting histories cleared.", "warning")
    return redirect(url_for('admin_settings'))

# Admin Logout
@app.route("/admin/logout")
def admin_logout():
    session.clear()
    flash("Admin session closed.", "success")
    return redirect(url_for('home'))


if __name__ == "__main__":
    app.run(debug=True)
