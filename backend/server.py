import io
import math
import os
import random
import smtplib
import sqlite3
import ssl
import time
import zipfile
from email.message import EmailMessage
from functools import wraps

from flask import Flask, g, jsonify, make_response, request, send_file
from flask_cors import CORS
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from PIL import Image
from pypdf import PdfReader, PdfWriter
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
CORS(app)

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

DB_PATH = os.path.join(os.path.dirname(__file__), 'users.db')
MASTER_EMAIL = 'pritongtinolaaa@gmail.com'
DEFAULT_CREDITS = 30
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
TOKEN_SECRET = os.environ.get('SCHIROPDF_SECRET', 'schiropdf-dev-secret')
EMAIL_DELIVERY_MODE = os.environ.get('SCHIROPDF_EMAIL_MODE', 'dev')
VERIFICATION_TTL_SECONDS = 15 * 60
PASSWORD_RESET_TTL_SECONDS = 15 * 60
SMTP_HOST = os.environ.get('SMTP_HOST', '')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USERNAME = os.environ.get('SMTP_USERNAME', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SMTP_FROM_EMAIL = os.environ.get('SMTP_FROM_EMAIL', SMTP_USERNAME or 'no-reply@schiropdf.local')

TIERS = {
    'starter-pack': {'name': 'Starter Pack', 'price_usd': 2.99, 'credits': 25},
    'pro-pack': {'name': 'Pro Pack', 'price_usd': 7.99, 'credits': 90},
    'ultra-pack': {'name': 'Ultra Pack', 'price_usd': 19.99, 'credits': 260},
}

serializer = URLSafeTimedSerializer(TOKEN_SECRET)
RATE_BUCKETS = {}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _column_exists(conn, table_name, column_name):
    rows = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
    return any(row['name'] == column_name for row in rows)


def _ensure_column(conn, table_name, column_name, column_ddl):
    if not _column_exists(conn, table_name, column_name):
        conn.execute(f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_ddl}')


def init_db():
    conn = get_db()
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            username TEXT NOT NULL,
            credits INTEGER NOT NULL DEFAULT 30,
            is_admin INTEGER NOT NULL DEFAULT 0,
            is_verified INTEGER NOT NULL DEFAULT 0,
            is_blocked INTEGER NOT NULL DEFAULT 0,
            account_tier TEXT NOT NULL DEFAULT 'free',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )

    _ensure_column(conn, 'users', 'is_verified', 'INTEGER NOT NULL DEFAULT 0')
    _ensure_column(conn, 'users', 'is_blocked', 'INTEGER NOT NULL DEFAULT 0')
    _ensure_column(conn, 'users', 'account_tier', "TEXT NOT NULL DEFAULT 'free'")

    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        '''
    )

    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS password_reset_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        '''
    )

    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS purchase_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tier_id TEXT NOT NULL,
            tier_name TEXT NOT NULL,
            price_usd REAL NOT NULL,
            credits_added INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        '''
    )

    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS credit_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            delta INTEGER NOT NULL,
            credits_after INTEGER,
            details TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        '''
    )

    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS auth_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            email TEXT,
            event_type TEXT NOT NULL,
            status TEXT NOT NULL,
            details TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        '''
    )

    conn.commit()
    conn.close()


def now_ts():
    return int(time.time())


def make_code():
    return str(random.randint(100000, 999999))


def row_to_user_dict(row):
    return {
        'id': row['id'],
        'email': row['email'],
        'username': row['username'],
        'credits': None if row['credits'] < 0 else row['credits'],
        'is_admin': bool(row['is_admin']),
        'is_verified': bool(row['is_verified']),
        'is_blocked': bool(row['is_blocked']),
        'account_tier': row['account_tier'],
        'created_at': row['created_at'],
    }


def make_token(user_id):
    return serializer.dumps({'uid': user_id})


def get_token_payload(token):
    return serializer.loads(token, max_age=TOKEN_MAX_AGE_SECONDS)


def get_authorized_user():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None

    token = auth_header.replace('Bearer ', '', 1).strip()
    if not token:
        return None

    try:
        payload = get_token_payload(token)
    except (BadSignature, SignatureExpired):
        return None

    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE id = ?', (payload.get('uid'),)).fetchone()
    conn.close()
    return row


def _record_credit_event(conn, user_id, event_type, delta, credits_after, details):
    conn.execute(
        'INSERT INTO credit_events (user_id, event_type, delta, credits_after, details) VALUES (?, ?, ?, ?, ?)',
        (user_id, event_type, delta, credits_after, details),
    )


def _record_auth_event(conn, user_id, email, event_type, status, details=''):
    conn.execute(
        'INSERT INTO auth_events (user_id, email, event_type, status, details) VALUES (?, ?, ?, ?, ?)',
        (user_id, email, event_type, status, details),
    )


def enforce_rate_limit(bucket_key, limit, window_seconds):
    now = now_ts()
    entries = RATE_BUCKETS.get(bucket_key, [])
    entries = [t for t in entries if now - t < window_seconds]
    if len(entries) >= limit:
        return False
    entries.append(now)
    RATE_BUCKETS[bucket_key] = entries
    return True


def _send_email(to_email, subject, body):
    if EMAIL_DELIVERY_MODE != 'smtp':
        return False, 'dev-mode'

    if not (SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD):
        return False, 'smtp-not-configured'

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = SMTP_FROM_EMAIL
    msg['To'] = to_email
    msg.set_content(body)

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.starttls(context=context)
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        return True, 'sent'
    except Exception as exc:
        return False, f'smtp-error:{str(exc)}'


def require_auth(admin=False, tool=False, verified=False):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user = get_authorized_user()
            if not user:
                return jsonify({'error': 'Authentication required.'}), 401

            if admin and not bool(user['is_admin']):
                return jsonify({'error': 'Admin access required.'}), 403

            if bool(user['is_blocked']):
                return jsonify({'error': 'This account is blocked. Contact an administrator.'}), 403

            if verified and not bool(user['is_verified']) and not bool(user['is_admin']):
                return jsonify({'error': 'Please verify your email before performing this action.'}), 403

            if tool and not bool(user['is_admin']) and user['credits'] <= 0:
                return jsonify({'error': 'Not enough credits. Please top up your account.'}), 402

            g.user = user
            start = time.perf_counter() if tool else None

            result = func(*args, **kwargs)
            response = make_response(result)

            if not tool:
                return response

            if bool(user['is_admin']):
                response.headers['X-Credits-Used'] = '0'
                response.headers['X-Credits-Remaining'] = 'unlimited'
                return response

            if response.status_code >= 400:
                return response

            elapsed_seconds = time.perf_counter() - start
            credits_used = max(1, math.ceil(elapsed_seconds / 30))

            conn = get_db()
            updated = conn.execute(
                'UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?',
                (credits_used, user['id'], credits_used),
            )
            if updated.rowcount == 0:
                conn.close()
                return jsonify({'error': 'Not enough credits for this operation.'}), 402

            row = conn.execute('SELECT credits FROM users WHERE id = ?', (user['id'],)).fetchone()
            _record_credit_event(
                conn,
                user['id'],
                'tool_usage',
                -credits_used,
                row['credits'],
                f'route={request.path},seconds={elapsed_seconds:.2f}',
            )
            conn.commit()
            conn.close()

            response.headers['X-Credits-Used'] = str(credits_used)
            response.headers['X-Credits-Remaining'] = str(row['credits'])
            return response

        return wrapper

    return decorator


def _require_pdf(file):
    data = file.read()
    if not data.startswith(b'%PDF'):
        raise ValueError('Uploaded file does not appear to be a valid PDF.')
    return PdfReader(io.BytesIO(data))


def _create_verification_code(conn, user_id):
    code = make_code()
    conn.execute('UPDATE verification_codes SET used = 1 WHERE user_id = ? AND used = 0', (user_id,))
    conn.execute(
        'INSERT INTO verification_codes (user_id, code, expires_at, used) VALUES (?, ?, ?, 0)',
        (user_id, code, now_ts() + VERIFICATION_TTL_SECONDS),
    )
    return code


def _create_password_reset_code(conn, user_id):
    code = make_code()
    conn.execute('UPDATE password_reset_codes SET used = 1 WHERE user_id = ? AND used = 0', (user_id,))
    conn.execute(
        'INSERT INTO password_reset_codes (user_id, code, expires_at, used) VALUES (?, ?, ?, 0)',
        (user_id, code, now_ts() + PASSWORD_RESET_TTL_SECONDS),
    )
    return code


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/api/auth/register', methods=['POST'])
def register():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown')
    if not enforce_rate_limit(f'register:{ip}', 6, 300):
        return jsonify({'error': 'Too many registrations. Please wait a few minutes.'}), 429

    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip().lower()
    password = payload.get('password') or ''
    username = (payload.get('username') or '').strip()

    if not email:
        return jsonify({'error': 'Email is required.'}), 400
    if not username or len(username) < 2:
        return jsonify({'error': 'Username must be at least 2 characters.'}), 400
    if not password or len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters.'}), 400

    is_admin = 1 if email == MASTER_EMAIL else 0
    credits = -1 if is_admin else DEFAULT_CREDITS
    is_verified = 1 if is_admin else 0
    account_tier = 'owner' if is_admin else 'free'

    conn = get_db()
    try:
        cursor = conn.execute(
            'INSERT INTO users (email, password_hash, username, credits, is_admin, is_verified, account_tier) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (email, generate_password_hash(password), username, credits, is_admin, is_verified, account_tier),
        )
    except sqlite3.IntegrityError:
        _record_auth_event(conn, None, email, 'register', 'failed', 'email_exists')
        conn.close()
        return jsonify({'error': 'Email is already registered.'}), 409

    verification_code = None
    if not is_admin:
        verification_code = _create_verification_code(conn, cursor.lastrowid)

    _record_auth_event(conn, cursor.lastrowid, email, 'register', 'success', '')

    conn.commit()
    row = conn.execute('SELECT * FROM users WHERE id = ?', (cursor.lastrowid,)).fetchone()
    conn.close()

    response = {
        'token': make_token(row['id']),
        'user': row_to_user_dict(row),
        'verification_required': not bool(row['is_verified']),
    }

    if verification_code:
        ok, mode = _send_email(
            email,
            'schiropdf verification code',
            f'Your verification code is: {verification_code}\nThis code expires in 15 minutes.',
        )
        if EMAIL_DELIVERY_MODE == 'dev' or not ok:
            response['dev_verification_code'] = verification_code
        response['email_delivery'] = mode

    return jsonify(response)


@app.route('/api/auth/login', methods=['POST'])
def login():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown')
    if not enforce_rate_limit(f'login:{ip}', 12, 300):
        return jsonify({'error': 'Too many login attempts. Please try again later.'}), 429

    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip().lower()
    password = payload.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if not row or not check_password_hash(row['password_hash'], password):
        _record_auth_event(conn, row['id'] if row else None, email, 'login', 'failed', 'invalid_credentials')
        conn.commit()
        conn.close()
        return jsonify({'error': 'Invalid email or password.'}), 401

    if row['is_blocked']:
        _record_auth_event(conn, row['id'], email, 'login', 'failed', 'blocked_account')
        conn.commit()
        conn.close()
        return jsonify({'error': 'This account is blocked. Contact an administrator.'}), 403

    if not row['is_verified'] and not row['is_admin']:
        _record_auth_event(conn, row['id'], email, 'login', 'failed', 'email_not_verified')
        conn.commit()
        conn.close()
        return jsonify({'error': 'Email not verified. Please verify your account first.'}), 403

    _record_auth_event(conn, row['id'], email, 'login', 'success', '')
    conn.commit()
    conn.close()

    return jsonify({'token': make_token(row['id']), 'user': row_to_user_dict(row)})


@app.route('/api/auth/me', methods=['GET'])
@require_auth()
def me():
    return jsonify({'user': row_to_user_dict(g.user)})


@app.route('/api/auth/update-username', methods=['POST'])
@require_auth()
def update_username():
    payload = request.get_json(silent=True) or {}
    username = (payload.get('username') or '').strip()

    if not username or len(username) < 2:
        return jsonify({'error': 'Username must be at least 2 characters.'}), 400

    conn = get_db()
    conn.execute('UPDATE users SET username = ? WHERE id = ?', (username, g.user['id']))
    conn.commit()
    row = conn.execute('SELECT * FROM users WHERE id = ?', (g.user['id'],)).fetchone()
    conn.close()

    return jsonify({'user': row_to_user_dict(row)})


@app.route('/api/auth/send-verification-code', methods=['POST'])
@require_auth()
def send_verification_code():
    if g.user['is_verified'] or g.user['is_admin']:
        return jsonify({'message': 'Email already verified.'})

    conn = get_db()
    code = _create_verification_code(conn, g.user['id'])
    _record_auth_event(conn, g.user['id'], g.user['email'], 'send_verification_code', 'success', '')
    conn.commit()
    conn.close()

    response = {'message': 'Verification code sent.'}
    ok, mode = _send_email(
        g.user['email'],
        'schiropdf verification code',
        f'Your verification code is: {code}\nThis code expires in 15 minutes.',
    )
    if EMAIL_DELIVERY_MODE == 'dev' or not ok:
        response['dev_verification_code'] = code
    response['email_delivery'] = mode
    return jsonify(response)


@app.route('/api/auth/verify-email', methods=['POST'])
@require_auth()
def verify_email():
    payload = request.get_json(silent=True) or {}
    code = (payload.get('code') or '').strip()

    if not code:
        return jsonify({'error': 'Verification code is required.'}), 400

    conn = get_db()
    row = conn.execute(
        '''
        SELECT * FROM verification_codes
        WHERE user_id = ? AND code = ? AND used = 0
        ORDER BY id DESC LIMIT 1
        ''',
        (g.user['id'], code),
    ).fetchone()

    if not row:
        conn.close()
        return jsonify({'error': 'Invalid verification code.'}), 400

    if row['expires_at'] < now_ts():
        conn.close()
        return jsonify({'error': 'Verification code has expired.'}), 400

    conn.execute('UPDATE verification_codes SET used = 1 WHERE id = ?', (row['id'],))
    conn.execute('UPDATE users SET is_verified = 1 WHERE id = ?', (g.user['id'],))
    _record_auth_event(conn, g.user['id'], g.user['email'], 'verify_email', 'success', '')
    conn.commit()
    user_row = conn.execute('SELECT * FROM users WHERE id = ?', (g.user['id'],)).fetchone()
    conn.close()

    return jsonify({'message': 'Email verified successfully.', 'user': row_to_user_dict(user_row)})


@app.route('/api/auth/request-password-reset', methods=['POST'])
def request_password_reset():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown')
    if not enforce_rate_limit(f'password_reset:{ip}', 8, 300):
        return jsonify({'error': 'Too many reset attempts. Please wait and try again.'}), 429

    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'Email is required.'}), 400

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if not user:
        _record_auth_event(conn, None, email, 'request_password_reset', 'failed', 'email_not_found')
        conn.commit()
        conn.close()
        return jsonify({'message': 'If this email exists, a reset code has been sent.'})

    code = _create_password_reset_code(conn, user['id'])
    _record_auth_event(conn, user['id'], email, 'request_password_reset', 'success', '')
    conn.commit()
    conn.close()

    response = {'message': 'If this email exists, a reset code has been sent.'}
    ok, mode = _send_email(
        email,
        'schiropdf password reset code',
        f'Your reset code is: {code}\nThis code expires in 15 minutes.',
    )
    if EMAIL_DELIVERY_MODE == 'dev' or not ok:
        response['dev_reset_code'] = code
    response['email_delivery'] = mode
    return jsonify(response)


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip().lower()
    code = (payload.get('code') or '').strip()
    new_password = payload.get('new_password') or ''

    if not email or not code or not new_password:
        return jsonify({'error': 'Email, code, and new password are required.'}), 400
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters.'}), 400

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'Invalid reset request.'}), 400

    reset_row = conn.execute(
        '''
        SELECT * FROM password_reset_codes
        WHERE user_id = ? AND code = ? AND used = 0
        ORDER BY id DESC LIMIT 1
        ''',
        (user['id'], code),
    ).fetchone()

    if not reset_row:
        conn.close()
        return jsonify({'error': 'Invalid reset code.'}), 400

    if reset_row['expires_at'] < now_ts():
        conn.close()
        return jsonify({'error': 'Reset code has expired.'}), 400

    conn.execute('UPDATE password_reset_codes SET used = 1 WHERE id = ?', (reset_row['id'],))
    conn.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        (generate_password_hash(new_password), user['id']),
    )
    _record_auth_event(conn, user['id'], email, 'reset_password', 'success', '')
    conn.commit()
    conn.close()

    return jsonify({'message': 'Password reset successful. You can login now.'})


@app.route('/api/billing/tiers', methods=['GET'])
def billing_tiers():
    data = []
    for tier_id, tier in TIERS.items():
        data.append(
            {
                'id': tier_id,
                'name': tier['name'],
                'price_usd': tier['price_usd'],
                'credits': tier['credits'],
            }
        )
    return jsonify({'tiers': data})


@app.route('/api/billing/purchase', methods=['POST'])
@require_auth(verified=True)
def billing_purchase():
    payload = request.get_json(silent=True) or {}
    tier_id = payload.get('tier_id')

    if tier_id not in TIERS:
        return jsonify({'error': 'Invalid tier selected.'}), 400

    tier = TIERS[tier_id]

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (g.user['id'],)).fetchone()

    credits_added = 0 if user['is_admin'] else tier['credits']
    if not user['is_admin']:
        conn.execute('UPDATE users SET credits = credits + ? WHERE id = ?', (credits_added, user['id']))

    updated_user = conn.execute('SELECT * FROM users WHERE id = ?', (user['id'],)).fetchone()

    conn.execute(
        '''
        INSERT INTO purchase_history (user_id, tier_id, tier_name, price_usd, credits_added, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ''',
        (user['id'], tier_id, tier['name'], tier['price_usd'], credits_added, 'success'),
    )

    if not user['is_admin']:
        _record_credit_event(
            conn,
            user['id'],
            'purchase',
            credits_added,
            updated_user['credits'],
            f'tier={tier_id},price={tier["price_usd"]}',
        )

    conn.commit()
    conn.close()

    return jsonify({'message': 'Purchase completed.', 'user': row_to_user_dict(updated_user)})


@app.route('/api/credits/history', methods=['GET'])
@require_auth()
def credits_history():
    conn = get_db()

    purchases = conn.execute(
        '''
        SELECT id, tier_id, tier_name, price_usd, credits_added, status, created_at
        FROM purchase_history
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 50
        ''',
        (g.user['id'],),
    ).fetchall()

    events = conn.execute(
        '''
        SELECT id, event_type, delta, credits_after, details, created_at
        FROM credit_events
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 100
        ''',
        (g.user['id'],),
    ).fetchall()

    conn.close()

    return jsonify(
        {
            'purchases': [dict(r) for r in purchases],
            'events': [dict(r) for r in events],
        }
    )


@app.route('/api/tools/estimate', methods=['POST'])
@require_auth(verified=True)
def estimate_credits():
    payload = request.get_json(silent=True) or {}
    file_count = int(payload.get('file_count') or 1)
    total_mb = float(payload.get('total_mb') or 0)
    # Lightweight heuristic that always charges at least 1 credit.
    estimated_seconds = 12 + (file_count * 8) + (total_mb * 4)
    estimated_credits = max(1, math.ceil(estimated_seconds / 30))
    return jsonify({'estimated_credits': estimated_credits, 'estimated_seconds': round(estimated_seconds, 1)})


@app.route('/api/admin/users', methods=['GET'])
@require_auth(admin=True)
def admin_users():
    search = (request.args.get('search') or '').strip().lower()

    conn = get_db()
    if search:
        rows = conn.execute(
            '''
            SELECT id, email, username, credits, is_admin, is_verified, created_at
            FROM users
            WHERE LOWER(email) LIKE ? OR LOWER(username) LIKE ?
            ORDER BY id DESC
            LIMIT 200
            ''',
            (f'%{search}%', f'%{search}%'),
        ).fetchall()
    else:
        rows = conn.execute(
            '''
            SELECT id, email, username, credits, is_admin, is_verified, created_at
            FROM users
            ORDER BY id DESC
            LIMIT 200
            '''
        ).fetchall()
    conn.close()

    return jsonify({'users': [row_to_user_dict(r) for r in rows]})


@app.route('/api/admin/users/<int:user_id>/block', methods=['POST'])
@require_auth(admin=True)
def admin_block_user(user_id):
    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'User not found.'}), 404

    if row['is_admin']:
        conn.close()
        return jsonify({'error': 'Cannot block an admin account.'}), 400

    conn.execute('UPDATE users SET is_blocked = 1 WHERE id = ?', (user_id,))
    updated = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    _record_auth_event(conn, user_id, row['email'], 'admin_block_user', 'success', f'blocked_by={g.user["id"]}')
    conn.commit()
    conn.close()
    return jsonify({'user': row_to_user_dict(updated)})


@app.route('/api/admin/users/<int:user_id>/unblock', methods=['POST'])
@require_auth(admin=True)
def admin_unblock_user(user_id):
    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'User not found.'}), 404

    conn.execute('UPDATE users SET is_blocked = 0 WHERE id = ?', (user_id,))
    updated = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    _record_auth_event(conn, user_id, row['email'], 'admin_unblock_user', 'success', f'unblocked_by={g.user["id"]}')
    conn.commit()
    conn.close()
    return jsonify({'user': row_to_user_dict(updated)})


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@require_auth(admin=True)
def admin_delete_user(user_id):
    if user_id == g.user['id']:
        return jsonify({'error': 'You cannot delete your own account.'}), 400

    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'User not found.'}), 404

    if row['is_admin']:
        conn.close()
        return jsonify({'error': 'Cannot delete an admin account.'}), 400

    conn.execute('DELETE FROM verification_codes WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM password_reset_codes WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM purchase_history WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM credit_events WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM auth_events WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    _record_auth_event(conn, None, row['email'], 'admin_delete_user', 'success', f'deleted_by={g.user["id"]}')
    conn.commit()
    conn.close()

    return jsonify({'message': 'User deleted successfully.'})


@app.route('/api/admin/users/<int:user_id>/add-credits', methods=['POST'])
@require_auth(admin=True)
def admin_add_credits(user_id):
    payload = request.get_json(silent=True) or {}

    try:
        amount = int(payload.get('amount'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Amount must be a valid integer.'}), 400

    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than zero.'}), 400

    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'User not found.'}), 404

    if row['credits'] < 0:
        conn.close()
        return jsonify({'error': 'This user already has unlimited credits.'}), 400

    conn.execute('UPDATE users SET credits = credits + ? WHERE id = ?', (amount, user_id))
    updated = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    _record_credit_event(
        conn,
        user_id,
        'admin_grant',
        amount,
        updated['credits'],
        f'granted_by={g.user["id"]}',
    )
    conn.commit()
    conn.close()

    return jsonify({'user': row_to_user_dict(updated)})


@app.route('/api/admin/users/<int:user_id>/upgrade-premium', methods=['POST'])
@require_auth(admin=True)
def admin_upgrade_premium(user_id):
    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'User not found.'}), 404

    if row['is_admin']:
        conn.close()
        return jsonify({'error': 'Owner/admin accounts cannot be upgraded this way.'}), 400

    if row['account_tier'] == 'premium':
        conn.close()
        return jsonify({'error': 'User is already premium.'}), 400

    conn.execute(
        'UPDATE users SET account_tier = ?, credits = credits + 100 WHERE id = ?',
        ('premium', user_id),
    )
    updated = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()

    _record_credit_event(
        conn,
        user_id,
        'admin_upgrade_premium',
        100,
        updated['credits'],
        f'upgraded_by={g.user["id"]}',
    )
    _record_auth_event(
        conn,
        user_id,
        updated['email'],
        'admin_upgrade_premium',
        'success',
        f'upgraded_by={g.user["id"]}',
    )
    conn.commit()
    conn.close()

    return jsonify({'user': row_to_user_dict(updated), 'message': 'User upgraded to premium (+100 credits).'})


@app.route('/api/admin/users/<int:user_id>/downgrade-free', methods=['POST'])
@require_auth(admin=True)
def admin_downgrade_free(user_id):
    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'User not found.'}), 404

    if row['is_admin']:
        conn.close()
        return jsonify({'error': 'Owner/admin accounts cannot be downgraded.'}), 400

    if row['account_tier'] != 'premium':
        conn.close()
        return jsonify({'error': 'User is not premium.'}), 400

    conn.execute(
        'UPDATE users SET account_tier = ? WHERE id = ?',
        ('free', user_id),
    )
    updated = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()

    _record_auth_event(
        conn,
        user_id,
        updated['email'],
        'admin_downgrade_free',
        'success',
        f'downgraded_by={g.user["id"]}',
    )
    conn.commit()
    conn.close()

    return jsonify({'user': row_to_user_dict(updated), 'message': 'User downgraded to free tier.'})


@app.route('/api/admin/audit', methods=['GET'])
@require_auth(admin=True)
def admin_audit():
    search = (request.args.get('search') or '').strip().lower()

    conn = get_db()
    if search:
        rows = conn.execute(
            '''
            SELECT ce.id, ce.user_id, u.email, u.username, ce.event_type, ce.delta, ce.credits_after, ce.details, ce.created_at
            FROM credit_events ce
            JOIN users u ON u.id = ce.user_id
            WHERE LOWER(u.email) LIKE ? OR LOWER(u.username) LIKE ?
            ORDER BY ce.id DESC
            LIMIT 200
            ''',
            (f'%{search}%', f'%{search}%'),
        ).fetchall()
    else:
        rows = conn.execute(
            '''
            SELECT ce.id, ce.user_id, u.email, u.username, ce.event_type, ce.delta, ce.credits_after, ce.details, ce.created_at
            FROM credit_events ce
            JOIN users u ON u.id = ce.user_id
            ORDER BY ce.id DESC
            LIMIT 200
            '''
        ).fetchall()
    conn.close()

    return jsonify({'events': [dict(r) for r in rows]})


@app.route('/api/admin/auth-audit', methods=['GET'])
@require_auth(admin=True)
def admin_auth_audit():
    search = (request.args.get('search') or '').strip().lower()
    conn = get_db()
    if search:
        rows = conn.execute(
            '''
            SELECT id, user_id, email, event_type, status, details, created_at
            FROM auth_events
            WHERE LOWER(COALESCE(email, '')) LIKE ?
            ORDER BY id DESC
            LIMIT 200
            ''',
            (f'%{search}%',),
        ).fetchall()
    else:
        rows = conn.execute(
            '''
            SELECT id, user_id, email, event_type, status, details, created_at
            FROM auth_events
            ORDER BY id DESC
            LIMIT 200
            '''
        ).fetchall()
    conn.close()
    return jsonify({'events': [dict(r) for r in rows]})


@app.route('/api/admin/analytics', methods=['GET'])
@require_auth(admin=True)
def admin_analytics():
    conn = get_db()
    totals = conn.execute(
        '''
        SELECT
          COUNT(*) AS total_users,
          SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) AS verified_users,
          SUM(CASE WHEN is_admin = 1 THEN 1 ELSE 0 END) AS admin_users,
          SUM(CASE WHEN credits > 0 THEN credits ELSE 0 END) AS total_user_credits
        FROM users
        '''
    ).fetchone()

    usage_7d = conn.execute(
        '''
        SELECT COUNT(*) AS events, COALESCE(SUM(ABS(delta)), 0) AS credits_used
        FROM credit_events
        WHERE event_type = 'tool_usage' AND created_at >= datetime('now', '-7 day')
        '''
    ).fetchone()

    top_tools = conn.execute(
        '''
        SELECT details, COUNT(*) AS runs
        FROM credit_events
        WHERE event_type = 'tool_usage'
        GROUP BY details
        ORDER BY runs DESC
        LIMIT 5
        '''
    ).fetchall()
    conn.close()

    parsed_tools = []
    for row in top_tools:
        details = row['details'] or ''
        route = details.split(',')[0].replace('route=', '') if 'route=' in details else details
        parsed_tools.append({'route': route, 'runs': row['runs']})

    return jsonify(
        {
            'summary': {
                'total_users': totals['total_users'] or 0,
                'verified_users': totals['verified_users'] or 0,
                'admin_users': totals['admin_users'] or 0,
                'total_user_credits': totals['total_user_credits'] or 0,
                'tool_events_7d': usage_7d['events'] or 0,
                'credits_used_7d': usage_7d['credits_used'] or 0,
            },
            'top_tools': parsed_tools,
        }
    )


@app.route('/api/merge', methods=['POST'])
@require_auth(tool=True, verified=True)
def merge_pdfs():
    files = request.files.getlist('files')
    if len(files) < 2:
        return jsonify({'error': 'At least 2 PDF files are required.'}), 400

    writer = PdfWriter()
    for f in files:
        try:
            reader = _require_pdf(f)
        except Exception as e:
            return jsonify({'error': str(e)}), 400
        for page in reader.pages:
            writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return send_file(output, mimetype='application/pdf', as_attachment=True, download_name='merged.pdf')


@app.route('/api/split', methods=['POST'])
@require_auth(tool=True, verified=True)
def split_pdf():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file provided.'}), 400

    try:
        reader = _require_pdf(file)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, page in enumerate(reader.pages):
            writer = PdfWriter()
            writer.add_page(page)
            page_buf = io.BytesIO()
            writer.write(page_buf)
            zf.writestr(f'page_{i + 1}.pdf', page_buf.getvalue())

    zip_buf.seek(0)
    return send_file(zip_buf, mimetype='application/zip', as_attachment=True, download_name='split_pages.zip')


@app.route('/api/rotate', methods=['POST'])
@require_auth(tool=True, verified=True)
def rotate_pdf():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file provided.'}), 400

    try:
        degrees = int(request.form.get('degrees', 90))
        if degrees not in (90, 180, 270):
            raise ValueError
    except ValueError:
        return jsonify({'error': 'Degrees must be 90, 180, or 270.'}), 400

    try:
        reader = _require_pdf(file)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    writer = PdfWriter()
    for page in reader.pages:
        page.rotate(degrees)
        writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return send_file(output, mimetype='application/pdf', as_attachment=True, download_name='rotated.pdf')


@app.route('/api/protect', methods=['POST'])
@require_auth(tool=True, verified=True)
def protect_pdf():
    file = request.files.get('file')
    password = request.form.get('password', '').strip()

    if not file:
        return jsonify({'error': 'No file provided.'}), 400
    if not password:
        return jsonify({'error': 'A password is required.'}), 400
    if len(password) > 256:
        return jsonify({'error': 'Password must be 256 characters or fewer.'}), 400

    try:
        reader = _require_pdf(file)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(password)

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return send_file(output, mimetype='application/pdf', as_attachment=True, download_name='protected.pdf')


@app.route('/api/unlock', methods=['POST'])
@require_auth(tool=True, verified=True)
def unlock_pdf():
    file = request.files.get('file')
    password = request.form.get('password', '').strip()

    if not file:
        return jsonify({'error': 'No file provided.'}), 400

    data = file.read()
    if not data.startswith(b'%PDF'):
        return jsonify({'error': 'Uploaded file does not appear to be a valid PDF.'}), 400

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        return jsonify({'error': f'Could not read PDF: {str(e)}'}), 400

    if reader.is_encrypted:
        result = reader.decrypt(password)
        if not result:
            return jsonify({'error': 'Incorrect password or unable to unlock this PDF.'}), 400

    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return send_file(output, mimetype='application/pdf', as_attachment=True, download_name='unlocked.pdf')


@app.route('/api/pdf-to-text', methods=['POST'])
@require_auth(tool=True, verified=True)
def pdf_to_text():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file provided.'}), 400

    try:
        reader = _require_pdf(file)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    if reader.is_encrypted:
        return jsonify({'error': 'PDF is password-protected. Please unlock it first.'}), 400

    parts = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ''
        if text.strip():
            parts.append(f'--- Page {i + 1} ---\\n{text.strip()}')

    full_text = '\\n\\n'.join(parts) if parts else 'No extractable text found in this PDF.'
    return jsonify({'text': full_text, 'pages': len(reader.pages)})


@app.route('/api/jpg-to-pdf', methods=['POST'])
@require_auth(tool=True, verified=True)
def jpg_to_pdf():
    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': 'No image files provided.'}), 400

    writer = PdfWriter()
    for f in files:
        try:
            img = Image.open(io.BytesIO(f.read()))
            if img.mode in ('RGBA', 'P', 'LA'):
                img = img.convert('RGB')
            img_pdf_buf = io.BytesIO()
            img.save(img_pdf_buf, format='PDF')
            img_pdf_buf.seek(0)
            reader = PdfReader(img_pdf_buf)
            writer.add_page(reader.pages[0])
        except Exception as e:
            return jsonify({'error': f'Could not process image "{f.filename}": {str(e)}'}), 400

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return send_file(output, mimetype='application/pdf', as_attachment=True, download_name='converted.pdf')


@app.route('/api/pdf-info', methods=['POST'])
@require_auth(tool=True, verified=True)
def pdf_info():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file provided.'}), 400

    try:
        reader = _require_pdf(file)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    metadata = {}
    if reader.metadata:
        for k, v in reader.metadata.items():
            try:
                metadata[str(k)] = str(v)
            except Exception:
                pass

    return jsonify({'pages': len(reader.pages), 'encrypted': reader.is_encrypted, 'metadata': metadata})


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
else:
    init_db()
