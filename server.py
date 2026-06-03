"""
Pixel Ledger 服务器 — 多端数据互通
数据存储在 Render 服务器 SQLite，换设备登录同一账号即可访问数据。
"""
import json
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, session

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
DIST_DIR = APP_DIR / "dist"

app = Flask(__name__, static_folder=str(DIST_DIR), static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "pixel-ledger-server-2026")

DATA_DIR.mkdir(parents=True, exist_ok=True)
USERS_DB = DATA_DIR / "users.db"
APP_DB = DATA_DIR / "app_data.db"


# ---- Helpers ----

def hash_pw(password: str) -> str:
    h = 0
    salt = "pixel-ledger-server-salt"
    s = salt + password
    for c in s:
        h = ((h << 5) - h) + ord(c)
        h |= 0
    return hex(abs(h))[2:]


def get_users_conn():
    conn = sqlite3.connect(str(USERS_DB))
    conn.row_factory = sqlite3.Row
    return conn


def get_app_conn():
    conn = sqlite3.connect(str(APP_DB))
    conn.row_factory = sqlite3.Row
    return conn


# ---- Init ----

def init_users_db():
    with get_users_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count == 0:
            conn.execute(
                "INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)",
                ("admin", "管理员", hash_pw("123456")),
            )
        conn.commit()


def init_app_db():
    with get_app_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                data_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


# ---- Auth API ----

@app.route("/api/register", methods=["POST"])
def api_register():
    body = request.get_json(force=True) or {}
    username = (body.get("username") or "").strip()
    password = (body.get("password") or "").strip()
    if not username or len(username) < 1 or len(username) > 30:
        return jsonify({"ok": False, "error": "用户名长度 1-30 个字符"}), 400
    if not re.match(r'^[a-zA-Z0-9_\-一-鿿]+$', username):
        return jsonify({"ok": False, "error": "用户名只能包含中英文、数字、下划线和连字符"}), 400
    if not password or len(password) < 3:
        return jsonify({"ok": False, "error": "密码至少 3 个字符"}), 400
    with get_users_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            return jsonify({"ok": False, "error": "该用户名已存在"}), 409
        conn.execute(
            "INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)",
            (username, username, hash_pw(password)),
        )
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/login", methods=["POST"])
def api_login():
    body = request.get_json(force=True) or {}
    username = (body.get("username") or "").strip()
    password = (body.get("password") or "").strip()
    with get_users_conn() as conn:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        if not user or user["password_hash"] != hash_pw(password):
            return jsonify({"ok": False, "error": "用户名或密码错误"}), 401
    session["logged_in"] = True
    session["username"] = username
    session["display_name"] = user["display_name"] or username
    # Ensure user has a data row
    init_app_db()
    with get_app_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM user_data WHERE username = ?", (username,)
        ).fetchone()
        if not existing:
            conn.execute(
                "INSERT INTO user_data (username, data_json) VALUES (?, ?)",
                (username, "{}"),
            )
            conn.commit()
    return jsonify({"ok": True, "username": username})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok": True})


# ---- Data API ----

def _require_auth():
    if not session.get("logged_in"):
        return jsonify({"ok": False, "error": "请先登录"}), 401
    return None


@app.route("/api/data", methods=["GET"])
def api_get_data():
    auth_err = _require_auth()
    if auth_err:
        return auth_err
    username = session["username"]
    with get_app_conn() as conn:
        row = conn.execute(
            "SELECT data_json FROM user_data WHERE username = ?", (username,)
        ).fetchone()
    if not row:
        return jsonify({"ok": True, "data": {}})
    return jsonify({"ok": True, "data": json.loads(row["data_json"])})


@app.route("/api/data", methods=["POST"])
def api_save_data():
    auth_err = _require_auth()
    if auth_err:
        return auth_err
    username = session["username"]
    body = request.get_json(force=True) or {}
    data_json = json.dumps(body.get("data", body), ensure_ascii=False)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_app_conn() as conn:
        conn.execute(
            "INSERT INTO user_data (username, data_json, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(username) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at",
            (username, data_json, now),
        )
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/health")
def api_health():
    return jsonify({"ok": True, "service": "pixel-ledger-server"})


@app.route("/api/check")
def api_check():
    """Check if user is logged in."""
    if session.get("logged_in"):
        return jsonify({"ok": True, "logged_in": True, "username": session.get("username")})
    return jsonify({"ok": True, "logged_in": False})


# ---- Static files + SPA fallback ----

@app.route("/")
def serve_index():
    return send_from_directory(str(DIST_DIR), "index.html")


@app.route("/<path:path>")
def serve_static(path):
    # If the path points to an existing static file, serve it
    full = DIST_DIR / path
    if full.exists() and full.is_file():
        return send_from_directory(str(DIST_DIR), path)
    # Otherwise SPA fallback
    return send_from_directory(str(DIST_DIR), "index.html")


# ---- Startup ----

if __name__ == "__main__":
    init_users_db()
    init_app_db()
    port = int(os.environ.get("PORT", 5050))
    print(f"Pixel Ledger Server running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
