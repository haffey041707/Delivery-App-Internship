"""Haulr development backend.

Run with: python3 server.py
"""
from __future__ import annotations

import socket
import sqlite3
import os
import json
import secrets
import ssl
import certifi
from math import atan2, cos, radians, sin, sqrt
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request as URLRequest, urlopen

from flask import Flask, jsonify, request, send_from_directory, session, redirect
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "haulr.db"


def load_env_file() -> None:
    """Read key=value pairs from a local .env so secrets stay out of the source."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()
app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get("HAULR_SECRET_KEY", "haulr-local-development-key-change-in-production")


def connection() -> sqlite3.Connection:
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db


def init_database() -> None:
    with connection() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pickup TEXT NOT NULL,
                drop_location TEXT NOT NULL,
                load_type TEXT NOT NULL,
                weight INTEGER NOT NULL,
                phone TEXT NOT NULL,
                description TEXT DEFAULT '',
                vehicle TEXT NOT NULL,
                fare INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'searching',
                driver_name TEXT,
                vehicle_number TEXT,
                created_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                phone TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                booking_id INTEGER REFERENCES bookings(id),
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT 'info',
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        db.execute("""CREATE TABLE IF NOT EXISTS account_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),
            token TEXT NOT NULL UNIQUE,device TEXT NOT NULL,ip_address TEXT,last_active TEXT NOT NULL
        )""")
        user_columns = {row[1] for row in db.execute("PRAGMA table_info(users)")}
        if "upi_id" not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN upi_id TEXT")
        if "upi_provider" not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN upi_provider TEXT")
        if "cash_preferred" not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN cash_preferred INTEGER DEFAULT 0")
        existing = {row[1] for row in db.execute("PRAGMA table_info(bookings)")}
        for name, definition in {
            "schedule": "TEXT DEFAULT 'now'",
            "helpers": "INTEGER DEFAULT 0",
            "payment_method": "TEXT DEFAULT 'UPI'",
            "distance_km": "REAL DEFAULT 0"
            ,"user_id": "INTEGER REFERENCES users(id)"
            ,"pickup_lat": "REAL"
            ,"pickup_lng": "REAL"
            ,"drop_lat": "REAL"
            ,"drop_lng": "REAL"
            ,"payment_status": "TEXT DEFAULT 'pending'"
            ,"payment_reference": "TEXT"
            ,"paid_at": "TEXT"
        }.items():
            if name not in existing:
                db.execute(f"ALTER TABLE bookings ADD COLUMN {name} {definition}")


def booking_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def register_session(user_id: int) -> None:
    token = secrets.token_urlsafe(24)
    session["session_token"] = token
    device = request.headers.get("User-Agent", "Unknown browser")[:180]
    with connection() as db:
        db.execute("INSERT INTO account_sessions (user_id,token,device,ip_address,last_active) VALUES (?,?,?,?,?)",
                   (user_id, token, device, request.remote_addr, datetime.now(timezone.utc).isoformat()))


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:filename>")
def assets(filename: str):
    return send_from_directory(ROOT, filename)


@app.after_request
def no_cache(response):
    """Stop the browser serving a stale app.js/premium.css after an edit."""
    if request.path == "/" or request.path.endswith((".js", ".css", ".html")):
        response.headers["Cache-Control"] = "no-store, must-revalidate"
    return response


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "haulr-api"})


@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    name, email, phone, password = (str(data.get(key, "")).strip() for key in ("name", "email", "phone", "password"))
    if len(name) < 2 or "@" not in email or len(phone) < 8 or len(password) < 8:
        return jsonify({"error": "Enter a valid name, email, phone, and password of at least 8 characters"}), 400
    try:
        with connection() as db:
            cursor = db.execute("INSERT INTO users (name,email,phone,password_hash,created_at) VALUES (?,?,?,?,?)",
                                (name, email.lower(), phone, generate_password_hash(password), datetime.now(timezone.utc).isoformat()))
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"error": "An account with this email already exists"}), 409
    return jsonify({"id": user_id, "name": name, "email": email.lower(), "phone": phone, "requires_login": True}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    with connection() as db:
        user = db.execute("SELECT * FROM users WHERE email = ?", (str(data.get("email", "")).strip().lower(),)).fetchone()
    if not user or not check_password_hash(user["password_hash"], str(data.get("password", ""))):
        return jsonify({"error": "Incorrect email or password"}), 401
    session["user_id"] = user["id"]
    register_session(user["id"])
    return jsonify({key: user[key] for key in ("id", "name", "email", "phone")})


@app.post("/api/auth/logout")
def logout():
    token = session.get("session_token")
    if token:
        with connection() as db:
            db.execute("DELETE FROM account_sessions WHERE token = ?", (token,))
    session.clear()
    return jsonify({"status": "signed_out"})


@app.get("/api/auth/me")
def current_user():
    if not session.get("user_id"):
        return jsonify({"user": None})
    if not session.get("session_token"):
        register_session(session["user_id"])
    with connection() as db:
        user = db.execute("SELECT id,name,email,phone,created_at FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    # Vercel functions can run on different ephemeral instances.  Keep the
    # verified identity in Flask's signed session so a successful Google login
    # remains signed in even if that instance's temporary SQLite file is fresh.
    return jsonify({"user": dict(user) if user else session.get("user_profile")})


@app.post("/api/auth/change-password")
def change_password():
    if not session.get("user_id"):
        return jsonify({"error": "Sign in to change your password"}), 401
    data = request.get_json(silent=True) or {}
    current, new_password = str(data.get("current_password", "")), str(data.get("new_password", ""))
    if len(new_password) < 8:
        return jsonify({"error": "New password must contain at least 8 characters"}), 400
    with connection() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        if not user or not check_password_hash(user["password_hash"], current):
            return jsonify({"error": "Current password is incorrect"}), 400
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (generate_password_hash(new_password), user["id"]))
        db.execute("INSERT INTO notifications (user_id,title,message,kind,created_at) VALUES (?,?,?,?,?)",
                   (user["id"], "Password changed", "Your Haulr password was changed successfully.", "security", datetime.now(timezone.utc).isoformat()))
    return jsonify({"status": "changed"})


@app.get("/api/auth/sessions")
def account_sessions():
    if not session.get("user_id"):
        return jsonify({"error": "Sign in to view sessions"}), 401
    with connection() as db:
        rows = db.execute("SELECT id,token,device,ip_address,last_active FROM account_sessions WHERE user_id=? ORDER BY id DESC", (session["user_id"],)).fetchall()
    current_token = session.get("session_token")
    return jsonify([{**dict(row), "token": None, "current": row["token"] == current_token} for row in rows])


@app.delete("/api/auth/sessions/<int:session_id>")
def revoke_session(session_id):
    if not session.get("user_id"):
        return jsonify({"error": "Sign in to manage sessions"}), 401
    with connection() as db:
        row = db.execute("SELECT token FROM account_sessions WHERE id=? AND user_id=?", (session_id, session["user_id"])).fetchone()
        if not row:
            return jsonify({"error": "Session not found"}), 404
        db.execute("DELETE FROM account_sessions WHERE id=?", (session_id,))
    if row["token"] == session.get("session_token"):
        session.clear()
        return jsonify({"status": "signed_out"})
    return jsonify({"status": "revoked"})


@app.get("/api/notifications")
def list_notifications():
    if not session.get("user_id"):
        return jsonify([])
    with connection() as db:
        rows = db.execute("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 40", (session["user_id"],)).fetchall()
    return jsonify([dict(row) for row in rows])


@app.patch("/api/notifications/read")
def read_notifications():
    if not session.get("user_id"):
        return jsonify({"error": "Sign in to manage notifications"}), 401
    with connection() as db:
        db.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (session["user_id"],))
    return jsonify({"status": "read"})


@app.get("/api/auth/google/start")
def google_start():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        return "Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured on the server.", 503
    state = secrets.token_urlsafe(24)
    session["google_oauth_state"] = state
    callback = request.host_url.rstrip("/") + "/api/auth/google/callback"
    query = urlencode({
        "client_id": client_id, "redirect_uri": callback, "response_type": "code",
        "scope": "openid email profile", "state": state, "access_type": "online", "hl": "en",
        "prompt": "select_account"
    })
    return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + query)


@app.get("/api/auth/google/status")
def google_status():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    # The client id is public by design; the browser needs it to render the Google button.
    return jsonify({"configured": bool(client_id), "client_id": client_id or ""})


@app.post("/api/auth/google/token")
def google_token():
    """Verify an ID token from Google Identity Services. Needs no redirect URI."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    credential = str((request.get_json(silent=True) or {}).get("credential", ""))
    if not client_id or not credential:
        return jsonify({"error": "Google sign-in is not configured on this server"}), 503
    try:
        tls_context = ssl.create_default_context(cafile=certifi.where())
        lookup = "https://oauth2.googleapis.com/tokeninfo?" + urlencode({"id_token": credential})
        profile = json.loads(urlopen(URLRequest(lookup), timeout=10, context=tls_context).read())
    except Exception as exc:
        app.logger.exception("Google token verification failed: %s", exc)
        return jsonify({"error": "Could not verify this Google sign-in"}), 502
    if profile.get("aud") != client_id:
        return jsonify({"error": "This Google token was issued for a different app"}), 401
    if str(profile.get("email_verified", "")).lower() != "true" or not profile.get("email"):
        return jsonify({"error": "This Google account has no verified email"}), 401
    email = profile["email"].lower()
    name = profile.get("name") or email.split("@")[0]
    with connection() as db:
        user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if user:
            user_id = user["id"]
        else:
            cursor = db.execute("INSERT INTO users (name,email,phone,password_hash,created_at) VALUES (?,?,?,?,?)",
                                (name, email, "", generate_password_hash(secrets.token_urlsafe(32)), datetime.now(timezone.utc).isoformat()))
            user_id = cursor.lastrowid
        row = db.execute("SELECT id,name,email,phone FROM users WHERE id = ?", (user_id,)).fetchone()
    session["user_id"] = user_id
    session["user_profile"] = dict(row)
    register_session(user_id)
    return jsonify(dict(row))


@app.get("/api/auth/google/callback")
def google_callback():
    if request.args.get("state") != session.pop("google_oauth_state", None):
        return redirect("/?auth_error=invalid_google_state")
    code = request.args.get("code")
    client_id, client_secret = os.environ.get("GOOGLE_CLIENT_ID"), os.environ.get("GOOGLE_CLIENT_SECRET")
    if not code or not client_id or not client_secret:
        return redirect("/?auth_error=google_cancelled")
    callback = request.host_url.rstrip("/") + "/api/auth/google/callback"
    try:
        token_data = urlencode({"code": code, "client_id": client_id, "client_secret": client_secret,
                                "redirect_uri": callback, "grant_type": "authorization_code"}).encode()
        token_request = URLRequest("https://oauth2.googleapis.com/token", data=token_data,
                                   headers={"Content-Type": "application/x-www-form-urlencoded"})
        tls_context = ssl.create_default_context(cafile=certifi.where())
        token = json.loads(urlopen(token_request, timeout=10, context=tls_context).read())["access_token"]
        profile_request = URLRequest("https://openidconnect.googleapis.com/v1/userinfo",
                                     headers={"Authorization": f"Bearer {token}"})
        profile = json.loads(urlopen(profile_request, timeout=10, context=tls_context).read())
        if not profile.get("email") or not profile.get("email_verified"):
            raise ValueError("Google email is not verified")
        email, name = profile["email"].lower(), profile.get("name") or profile["email"].split("@")[0]
        with connection() as db:
            user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            if user:
                user_id = user["id"]
            else:
                cursor = db.execute("INSERT INTO users (name,email,phone,password_hash,created_at) VALUES (?,?,?,?,?)",
                                    (name, email, "", generate_password_hash(secrets.token_urlsafe(32)), datetime.now(timezone.utc).isoformat()))
                user_id = cursor.lastrowid
        session["user_id"] = user_id
        session["user_profile"] = {"id": user_id, "name": name, "email": email, "phone": ""}
        register_session(user_id)
        return redirect("/?auth=google_success")
    except Exception as exc:
        app.logger.exception("Google OAuth callback failed: %s", exc)
        return redirect("/?auth_error=google_failed")


@app.get("/api/saved-places")
def saved_places():
    """Distinct pickup and drop addresses drawn from the account's own booking history."""
    if not session.get("user_id"):
        return jsonify([])
    user_id = session["user_id"]
    with connection() as db:
        rows = db.execute(
            """SELECT pickup AS label, pickup_lat AS lat, pickup_lng AS lng, created_at, 'pickup' AS kind
                 FROM bookings WHERE user_id = ? AND TRIM(COALESCE(pickup,'')) != ''
               UNION ALL
               SELECT drop_location, drop_lat, drop_lng, created_at, 'drop'
                 FROM bookings WHERE user_id = ? AND TRIM(COALESCE(drop_location,'')) != ''""",
            (user_id, user_id),
        ).fetchall()
    places: dict[str, dict] = {}
    for row in rows:
        label = row["label"].strip()
        entry = places.setdefault(label.lower(), {
            "label": label, "lat": None, "lng": None, "uses": 0,
            "last_used": row["created_at"], "kinds": set(),
        })
        entry["uses"] += 1
        entry["kinds"].add(row["kind"])
        if row["created_at"] > entry["last_used"]:
            entry["last_used"] = row["created_at"]
        if entry["lat"] in (None, 0) and row["lat"]:
            entry["lat"], entry["lng"] = row["lat"], row["lng"]
    ordered = sorted(places.values(), key=lambda item: (item["uses"], item["last_used"]), reverse=True)
    return jsonify([{**item, "kinds": sorted(item["kinds"])} for item in ordered])


@app.get("/api/bookings")
def list_bookings():
    if not session.get("user_id"):
        return jsonify([])
    with connection() as db:
        rows = db.execute("SELECT * FROM bookings WHERE user_id = ? ORDER BY id DESC LIMIT 50", (session["user_id"],)).fetchall()
    return jsonify([booking_dict(row) for row in rows])


@app.get("/api/bookings/<int:booking_id>")
def get_booking(booking_id: int):
    if not session.get("user_id"):
        return jsonify({"error": "Sign in to track an order"}), 401
    with connection() as db:
        row = db.execute("SELECT * FROM bookings WHERE id = ? AND user_id = ?", (booking_id, session["user_id"])).fetchone()
    if not row:
        return jsonify({"error": "Order not found in your account"}), 404
    return jsonify(booking_dict(row))


@app.get("/api/wallet")
def wallet():
    if not session.get("user_id"):
        return jsonify({"error": "Sign in to view your wallet"}), 401
    with connection() as db:
        summary = db.execute("""SELECT COALESCE(SUM(fare),0) AS total_spend,
                              SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS completed
                              FROM bookings WHERE user_id = ?""", (session["user_id"],)).fetchone()
        prefs = db.execute("SELECT upi_id,upi_provider,cash_preferred FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    return jsonify({"balance": 0, "total_spend": summary["total_spend"], "completed": summary["completed"] or 0,
                    "upi_id": prefs["upi_id"], "upi_provider": prefs["upi_provider"], "cash_preferred": bool(prefs["cash_preferred"])})


@app.patch("/api/payment-preferences")
def payment_preferences():
    if not session.get("user_id"):
        return jsonify({"error": "Sign in to save payment preferences"}), 401
    data = request.get_json(silent=True) or {}
    with connection() as db:
        if "upi_id" in data:
            db.execute("UPDATE users SET upi_id = ? WHERE id = ?", (str(data["upi_id"]).strip(), session["user_id"]))
        if "upi_provider" in data:
            db.execute("UPDATE users SET upi_provider = ? WHERE id = ?", (str(data["upi_provider"]).strip(), session["user_id"]))
        if "cash_preferred" in data:
            db.execute("UPDATE users SET cash_preferred = ? WHERE id = ?", (1 if data["cash_preferred"] else 0, session["user_id"]))
    return jsonify({"status": "saved"})


@app.post("/api/bookings")
def create_booking():
    if not session.get("user_id"):
        return jsonify({"error": "Sign in to book a delivery"}), 401
    data = request.get_json(silent=True) or {}
    required = ("pickup", "drop_location", "load_type", "weight", "phone", "vehicle", "fare")
    missing = [field for field in required if data.get(field) in (None, "")]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400
    try:
        weight, fare = int(data["weight"]), int(data["fare"])
        if weight < 1 or fare < 1:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "Weight and fare must be positive numbers"}), 400
    now = datetime.now(timezone.utc).isoformat()
    payment_method = data.get("payment_method", "UPI")
    is_cash = payment_method.strip().lower() == "cash"
    payment_status = "due_on_delivery" if is_cash else "paid"
    payment_reference = None if is_cash else f"PAY{now[:10].replace('-', '')}{secrets.token_hex(4).upper()}"
    paid_at = None if is_cash else now
    with connection() as db:
        cursor = db.execute(
            """INSERT INTO bookings
               (pickup, drop_location, load_type, weight, phone, description, vehicle, fare, created_at, schedule, helpers, payment_method, distance_km, user_id, pickup_lat, pickup_lng, drop_lat, drop_lng, payment_status, payment_reference, paid_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data["pickup"].strip(), data["drop_location"].strip(), data["load_type"], weight,
             data["phone"].strip(), data.get("description", "").strip(), data["vehicle"], fare, now,
             data.get("schedule", "now"), int(data.get("helpers", 0)), data.get("payment_method", "UPI"),
             float(data.get("distance_km", 0)), session["user_id"],
             float(data.get("pickup_lat", 0)), float(data.get("pickup_lng", 0)),
             float(data.get("drop_lat", 0)), float(data.get("drop_lng", 0)),
             payment_status, payment_reference, paid_at),
        )
        row = db.execute("SELECT * FROM bookings WHERE id = ?", (cursor.lastrowid,)).fetchone()
        db.execute("INSERT INTO notifications (user_id,booking_id,title,message,kind,created_at) VALUES (?,?,?,?,?,?)",
                   (session["user_id"], row["id"], "Booking received", f"Order HLR-{row['id']:04d} is searching for a verified driver.", "booking", now))
    return jsonify(booking_dict(row)), 201


@app.post("/api/fare-quote")
def fare_quote():
    data = request.get_json(silent=True) or {}
    try:
        start, end = data["pickup"], data["drop"]
        lat1, lon1, lat2, lon2 = map(radians, [float(start[0]), float(start[1]), float(end[0]), float(end[1])])
    except (KeyError, TypeError, ValueError, IndexError):
        return jsonify({"error": "Valid pickup and drop coordinates are required"}), 400
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    straight_km = 6371 * 2 * atan2(sqrt(a), sqrt(1 - a))
    distance = round(straight_km * 1.25, 1)
    helpers = max(0, min(2, int(data.get("helpers", 0))))
    rates = {
        "Loading Rickshaw": (99, 18), "Tata Ace": (149, 27),
        "Pickup 8ft": (229, 38), "14ft Truck": (399, 58)
    }
    base, per_km = rates.get(data.get("vehicle"), rates["Loading Rickshaw"])
    helper_cost = (0, 120, 220)[helpers]
    fare = round((base + max(distance, 1) * per_km + helper_cost) / 10) * 10
    return jsonify({"distance_km": distance, "duration_minutes": max(8, round(distance * 3.2)), "fare": fare})


@app.patch("/api/bookings/<int:booking_id>/status")
def update_status(booking_id: int):
    data = request.get_json(silent=True) or {}
    allowed = {"searching", "accepted", "pickup", "in_transit", "delivered", "rejected"}
    status = data.get("status")
    if status not in allowed:
        return jsonify({"error": "Invalid booking status"}), 400
    driver = "Rahul Sharma" if status == "accepted" else data.get("driver_name")
    number = "GJ 18 BX 4821" if status == "accepted" else data.get("vehicle_number")
    with connection() as db:
        result = db.execute(
            "UPDATE bookings SET status = ?, driver_name = COALESCE(?, driver_name), vehicle_number = COALESCE(?, vehicle_number) WHERE id = ?",
            (status, driver, number, booking_id),
        )
        if not result.rowcount:
            return jsonify({"error": "Booking not found"}), 404
        row = db.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
        if row["user_id"]:
            status_messages = {
                "accepted": ("Driver assigned", f"{driver or 'A verified driver'} accepted order HLR-{booking_id:04d}."),
                "pickup": ("Driver at pickup", f"Your driver reached the pickup for HLR-{booking_id:04d}."),
                "in_transit": ("Delivery in transit", f"Order HLR-{booking_id:04d} is moving toward the destination."),
                "delivered": ("Delivery completed", f"Order HLR-{booking_id:04d} was marked delivered."),
                "rejected": ("Booking update", f"Order HLR-{booking_id:04d} was declined by this driver; matching will continue.")
            }
            if status in status_messages:
                title, message = status_messages[status]
                db.execute("INSERT INTO notifications (user_id,booking_id,title,message,kind,created_at) VALUES (?,?,?,?,?,?)",
                           (row["user_id"], booking_id, title, message, status, datetime.now(timezone.utc).isoformat()))
    return jsonify(booking_dict(row))


def free_port(candidate: int) -> bool:
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", candidate))
            return True
        except OSError:
            return False


if __name__ == "__main__":
    init_database()
    port = int(os.environ.get("PORT", 5000))
    if not free_port(port):
        # macOS AirPlay Receiver occupies 5000; move aside instead of crashing.
        for fallback in (5055, 5001, 5002, 8010):
            if free_port(fallback):
                print(f"Port {port} is in use (macOS AirPlay uses 5000). Starting on {fallback} instead.")
                port = fallback
                break
    print(f"Haulr running at http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=True)
