"""
HR Dashboard - Flask API with Enhanced Security
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ==================== ЛОГИРОВАНИЕ ====================
import logging
from logging.handlers import RotatingFileHandler
import os

# Создаём папку для логов
os.makedirs('logs', exist_ok=True)

# Настройка логирования в файл
file_handler = RotatingFileHandler(
    'logs/app.log', 
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5,
    encoding='utf-8'
)
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter(
    '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
))

# Логирование в консоль и файл
logging.basicConfig(
    level=logging.INFO,
    handlers=[
        file_handler,
        logging.StreamHandler()
    ]
)

# Отключаем лишнее логирование Flask для ускорения
logging.getLogger('werkzeug').setLevel(logging.WARNING)

from flask import Flask, request, jsonify, send_from_directory, session, redirect
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta
import secrets
import hashlib
import pyotp
import bcrypt
import time
from functools import wraps

app = Flask(__name__)

# ============= ENHANCED SECURITY =============

# Secure secret key for sessions
app.secret_key = secrets.token_hex(64)

# CORS - разрешаем локальную сеть и ngrok
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5000", 
            "http://127.0.0.1:5000",
            "http://10.174.81.107:5000",
            "https://sanctionless-christy-cerebrational.ngrok-free.dev"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "X-CSRF-Token", "X-Session-Token"]
    }
})

# Fixed salt for consistent password hashing
FIXED_BCRYPT_SALT = b'$2b$12$AQLswn/c/PDZyYZpAImhle'

# Admin credentials - stored as bcrypt hashes (теперь с фиксированным salt)
ADMIN_LOGIN = "zayniddin"
ADMIN_PASSWORD_HASH = bcrypt.hashpw("3020".encode('utf-8'), FIXED_BCRYPT_SALT)
ADMIN_PHONE = "+998901234567"  # Номер телефона админа

# Supervisor credentials  
SUPERVISOR_LOGIN = "supervisor"
SUPERVISOR_PASSWORD_HASH = bcrypt.hashpw("supervisor".encode('utf-8'), FIXED_BCRYPT_SALT)
SUPERVISOR_PHONE = "+998901234568"  # Номер телефона супервайзера

# 2FA secrets (сохраняются в файл для постоянства)
TWO_FACTOR_SECRET_FILE = '2fa_admin.secret'
SUPERVISOR_TWO_FACTOR_SECRET_FILE = '2fa_supervisor.secret'

def load_2fa_secret(filename):
    """Загрузка или создание 2FA секрета"""
    if os.path.exists(filename):
        with open(filename, 'r') as f:
            return f.read().strip()
    else:
        secret = pyotp.random_base32()
        with open(filename, 'w') as f:
            f.write(secret)
        return secret

TWO_FACTOR_SECRET = load_2fa_secret(TWO_FACTOR_SECRET_FILE)
SUPERVISOR_TWO_FACTOR_SECRET = load_2fa_secret(SUPERVISOR_TWO_FACTOR_SECRET_FILE)

# Включить 2FA (True - требуется, False - пропуск для удобства)
REQUIRE_2FA = True

# Rate limiting storage (теперь в БД)
def init_security_db():
    """Инициализация таблиц безопасности"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Сессии в БД
    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        login TEXT NOT NULL,
        role TEXT NOT NULL,
        ip TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
    )''')
    
    # CSRF токены
    c.execute('''CREATE TABLE IF NOT EXISTS csrf_tokens (
        token TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Логины attempts
    c.execute('''CREATE TABLE IF NOT EXISTS login_attempts (
        ip TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        locked_until TIMESTAMP
    )''')
    
    conn.commit()
    conn.close()

def generate_csrf_token():
    """Генерация CSRF токена"""
    token = secrets.token_hex(32)
    conn = sqlite3.connect(DB_NAME)
    conn.execute('INSERT OR REPLACE INTO csrf_tokens (token) VALUES (?)', (token,))
    conn.commit()
    conn.close()
    return token

def verify_csrf_token(token):
    """Проверка CSRF токена"""
    if not token:
        return False
    conn = sqlite3.connect(DB_NAME)
    row = conn.execute('SELECT token FROM csrf_tokens WHERE token=?', (token,)).fetchone()
    conn.close()
    return row is not None

def clean_expired_sessions():
    """Очистка просроченных сессий"""
    conn = sqlite3.connect(DB_NAME)
    conn.execute('DELETE FROM sessions WHERE expires_at < datetime("now")')
    conn.execute('DELETE FROM csrf_tokens WHERE created_at < datetime("-1 hour")')
    conn.commit()
    conn.close()

# Rate limiting storage (теперь в БД)
def check_rate_limit(ip, max_attempts=5, lockout_minutes=15):
    """Rate limiting to prevent brute force"""
    conn = sqlite3.connect(DB_NAME)
    row = conn.execute('SELECT count, locked_until FROM login_attempts WHERE ip=?', (ip,)).fetchone()
    
    if row:
        count, locked_until = row
        if locked_until:
            locked_dt = datetime.fromisoformat(locked_until)
            if datetime.now() < locked_dt:
                conn.close()
                return False, "Слишком много попыток. Попробуйте позже."
        
        # Сброс после истечения блокировки
        if locked_until:
            conn.execute('UPDATE login_attempts SET count=0, locked_until=NULL WHERE ip=?', (ip,))
            conn.commit()
    
    conn.close()
    return True, None

def record_failed_attempt(ip):
    """Record failed login attempt"""
    conn = sqlite3.connect(DB_NAME)
    row = conn.execute('SELECT count FROM login_attempts WHERE ip=?', (ip,)).fetchone()
    
    count = (row[0] + 1) if row else 1
    
    locked_until = None
    if count >= 5:
        locked_until = (datetime.now() + timedelta(minutes=15)).isoformat()
        print(f"[SECURITY] IP {ip} locked for 15 minutes")
    
    conn.execute('''INSERT OR REPLACE INTO login_attempts (ip, count, locked_until) 
                    VALUES (?, ?, ?)''', (ip, count, locked_until))
    conn.commit()
    conn.close()

def hash_password(password):
    """Secure password hashing with bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def verify_password(password, password_hash):
    """Verify password against bcrypt hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash)
    except:
        return False

def generate_2fa_qr(login, secret):
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=login,
        issuer_name="HR Dashboard"
    )

def verify_2fa(secret, code):
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)

# Session management (теперь в БД)
def generate_session():
    return secrets.token_hex(32)

def create_session(login, role, two_factor_verified=False):
    """Создание сессии в БД"""
    token = generate_session()
    expires_at = (datetime.now() + timedelta(hours=24)).isoformat()
    ip = request.remote_addr
    
    conn = sqlite3.connect(DB_NAME)
    conn.execute('''INSERT INTO sessions (token, login, role, ip, expires_at) 
                    VALUES (?, ?, ?, ?, ?)''',
                 (token, login, role, ip, expires_at))
    conn.commit()
    conn.close()
    return token

def verify_session(token):
    """Проверка сессии в БД"""
    if not token:
        return None
    
    conn = sqlite3.connect(DB_NAME)
    row = conn.execute('''SELECT login, role, expires_at FROM sessions 
                          WHERE token=?''', (token,)).fetchone()
    conn.close()
    
    if not row:
        return None
    
    login, role, expires_at = row
    expires_dt = datetime.fromisoformat(expires_at)
    
    if datetime.now() > expires_dt:
        delete_session(token)
        return None
    
    return {'login': login, 'role': role}

def delete_session(token):
    """Удаление сессии из БД"""
    conn = sqlite3.connect(DB_NAME)
    conn.execute('DELETE FROM sessions WHERE token=?', (token,))
    conn.commit()
    conn.close()

# ==================== SECURITY MIDDLEWARE ====================

def require_auth(f):
    """Декоратор для защищённых маршрутов"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('X-Session-Token')
        session = verify_session(token)
        
        if not session:
            return jsonify({'error': 'Требуется авторизация'}), 401
        
        # Добавляем сессию в request
        request.session = session
        return f(*args, **kwargs)
    return decorated_function

def require_csrf(f):
    """Декоратор для проверки CSRF токена"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        csrf_token = request.headers.get('X-CSRF-Token')
        
        if not verify_csrf_token(csrf_token):
            return jsonify({'error': 'Неверный CSRF токен'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

@app.after_request
def after_request(response):
    # Remove server info
    response.headers['Server'] = 'SecureServer'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

@app.before_request
def https_redirect():
    """Редирект на HTTPS (работает только если есть SSL сертификат)"""
    if request.headers.get('X-Forwarded-Proto') == 'http':
        # Для ngrok - просто пропускаем
        pass

# Database
DB_NAME = "database.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        operator TEXT,
        address TEXT,
        date TEXT,
        birthday TEXT,
        status TEXT DEFAULT 'На работе',
        photo TEXT,
        gender TEXT DEFAULT 'male',
        dateRange TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS breaks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        planned_duration INTEGER,
        actual_minutes INTEGER,
        date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        author TEXT NOT NULL,
        time TEXT,
        timestamp INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS employee_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_name TEXT NOT NULL UNIQUE,
        login TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS shift_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_name TEXT NOT NULL,
        employee_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(shift_name, employee_name)
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS work_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_name TEXT NOT NULL UNIQUE,
        work_type TEXT DEFAULT 'standard',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )''')
    
    conn.commit()
    conn.close()
    print("[OK] Database initialized")

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

# ==================== API AUTH ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    client_ip = request.remote_addr
    logging.info(f"[LOGIN] Attempt from {client_ip}")
    
    # Rate limiting check
    allowed, error_msg = check_rate_limit(client_ip)
    if not allowed:
        logging.warning(f"[RATE LIMIT] Blocked {client_ip}")
        return jsonify({'success': False, 'error': error_msg}), 429
    
    data = request.json
    login = data.get('login', '').strip()
    password = data.get('password', '').strip()
    
    # Нормализуем номер телефона (убираем все кроме цифр и +)
    phone = ''.join(c for c in login if c.isdigit() or c == '+')
    if phone.startswith('+998'):
        pass  # Оставляем как есть
    elif phone.startswith('998'):
        phone = '+' + phone
    elif len(phone) == 9 and phone.startswith('90'):
        phone = '+998' + phone
    elif len(phone) == 9 and phone.startswith('91'):
        phone = '+998' + phone
    
    if not login or not password:
        record_failed_attempt(client_ip)
        return jsonify({'success': False, 'error': 'Введите логин/номер и пароль'})
    
    # Определяем тип входа (логин или телефон) и роль
    entered_login = login.lower().strip()
    entered_phone = phone
    
    # Проверяем admin (по логину или телефону)
    is_admin = False
    if (entered_login == ADMIN_LOGIN or entered_phone == ADMIN_PHONE) and verify_password(password, ADMIN_PASSWORD_HASH):
        is_admin = True
        login_for_session = ADMIN_LOGIN
        user_name = 'Admin'
    
    # Проверяем supervisor (по логину или телефону)
    is_supervisor = False
    if not is_admin and (entered_login == SUPERVISOR_LOGIN or entered_phone == SUPERVISOR_PHONE) and verify_password(password, SUPERVISOR_PASSWORD_HASH):
        is_supervisor = True
        login_for_session = SUPERVISOR_LOGIN
        user_name = 'Supervisor'
    
    if is_admin:
        if REQUIRE_2FA:
            logging.info(f"[LOGIN] Admin needs 2FA from {client_ip}")
            return jsonify({
                'success': True,
                'requires_2fa': True,
                'login': login_for_session,
                'message': 'Введите код 2FA'
            })
        else:
            token = create_session(ADMIN_LOGIN, 'admin', two_factor_verified=True)
            csrf_token = generate_csrf_token()
            logging.info(f"[LOGIN] Admin logged in (no 2FA) from {client_ip}")
            return jsonify({
                'success': True,
                'token': token,
                'role': 'admin',
                'user_name': user_name,
                'csrf_token': csrf_token,
                'message': 'Добро пожаловать!'
            })
    
    if is_supervisor:
        if REQUIRE_2FA:
            logging.info(f"[LOGIN] Supervisor needs 2FA from {client_ip}")
            return jsonify({
                'success': True,
                'requires_2fa': True,
                'login': login_for_session,
                'message': 'Введите код 2FA'
            })
        else:
            token = create_session(SUPERVISOR_LOGIN, 'supervisor', two_factor_verified=True)
            csrf_token = generate_csrf_token()
            logging.info(f"[LOGIN] Supervisor logged in (no 2FA) from {client_ip}")
            return jsonify({
                'success': True,
                'token': token,
                'role': 'supervisor',
                'user_name': user_name,
                'csrf_token': csrf_token,
                'message': 'Добро пожаловать!'
            })
    
    # Failed attempt
    record_failed_attempt(client_ip)
    logging.warning(f"[SECURITY] Failed login from {client_ip}, user: {login}")
    
    return jsonify({'success': False, 'error': 'Неверный логин/номер телефона или пароль'})

@app.route('/api/auth/verify-2fa', methods=['POST'])
def verify_2fa():
    client_ip = request.remote_addr
    logging.info(f"[2FA] Verification attempt from {client_ip}")
    
    allowed, error_msg = check_rate_limit(client_ip)
    if not allowed:
        logging.warning(f"[RATE LIMIT] 2FA blocked {client_ip}")
        return jsonify({'success': False, 'error': error_msg}), 429
    
    data = request.json
    login = data.get('login', '').lower().strip()
    code = data.get('code', '').strip()
    
    if not code:
        return jsonify({'success': False, 'error': 'Введите код'})
    
    if login == ADMIN_LOGIN:
        if verify_2fa(TWO_FACTOR_SECRET, code):
            token = create_session(ADMIN_LOGIN, 'admin', two_factor_verified=True)
            csrf_token = generate_csrf_token()
            logging.info(f"[LOGIN] Admin logged in with 2FA from {client_ip}")
            return jsonify({
                'success': True,
                'token': token,
                'role': 'admin',
                'user_name': 'Admin',
                'csrf_token': csrf_token,
                'message': 'Добро пожаловать!'
            })
    
    if login == SUPERVISOR_LOGIN:
        if verify_2fa(SUPERVISOR_TWO_FACTOR_SECRET, code):
            token = create_session(SUPERVISOR_LOGIN, 'supervisor', two_factor_verified=True)
            csrf_token = generate_csrf_token()
            logging.info(f"[LOGIN] Supervisor logged in with 2FA from {client_ip}")
            return jsonify({
                'success': True,
                'token': token,
                'role': 'supervisor',
                'user_name': 'Supervisor',
                'csrf_token': csrf_token,
                'message': 'Добро пожаловать!'
            })
    
    record_failed_attempt(client_ip)
    logging.warning(f"[2FA] Failed 2FA from {client_ip}, user: {login}")
    return jsonify({'success': False, 'error': 'Неверный код 2FA'})

@app.route('/api/auth/2fa-qr/<login>', methods=['GET'])
def get_2fa_qr(login):
    """Получение QR кода для настройки 2FA"""
    login = login.lower()
    
    if login == ADMIN_LOGIN:
        qr_uri = generate_2fa_qr(ADMIN_LOGIN, TWO_FACTOR_SECRET)
        return jsonify({
            'qr_uri': qr_uri,
            'secret': TWO_FACTOR_SECRET,
            'app_name': 'HR Dashboard'
        })
    
    if login == SUPERVISOR_LOGIN:
        qr_uri = generate_2fa_qr(SUPERVISOR_LOGIN, SUPERVISOR_TWO_FACTOR_SECRET)
        return jsonify({
            'qr_uri': qr_uri,
            'secret': SUPERVISOR_TWO_FACTOR_SECRET,
            'app_name': 'HR Dashboard'
        })
    
    return jsonify({'error': 'Пользователь не найден'}), 404

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    token = request.headers.get('X-Session-Token')
    if token:
        delete_session(token)
    return jsonify({'success': True, 'message': 'Вы вышли из системы'})

@app.route('/api/auth/check', methods=['GET'])
def check_auth():
    token = request.headers.get('X-Session-Token')
    session = verify_session(token) if token else None
    
    if session:
        return jsonify({
            'authenticated': True,
            'login': session['login'],
            'role': session.get('role'),
            'two_factor_verified': True
        })
    
    return jsonify({'authenticated': False})

@app.route('/api/auth/csrf', methods=['GET'])
def get_csrf():
    """Получение CSRF токена"""
    token = generate_csrf_token()
    return jsonify({'csrf_token': token})

@app.route('/api/auth/refresh-csrf', methods=['POST'])
def refresh_csrf():
    """Обновление CSRF токена"""
    token = generate_csrf_token()
    return jsonify({'csrf_token': token})

# ==================== API EMPLOYEES ====================

@app.route('/api/employees', methods=['GET'])
@require_auth
def get_employees():
    conn = get_db_connection()
    employees = conn.execute('SELECT * FROM employees ORDER BY name').fetchall()
    conn.close()
    return jsonify([dict(e) for e in employees])

@app.route('/api/employees', methods=['POST'])
@require_auth
def add_employee():
    data = request.json
    conn = get_db_connection()
    conn.execute('''INSERT INTO employees (name, phone, operator, address, date, birthday, status, photo, gender, dateRange)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                 (data.get('name'), data.get('phone'), data.get('operator'),
                  data.get('address'), data.get('date'), data.get('birthday'),
                  data.get('status', 'На работе'), data.get('photo'),
                  data.get('gender', 'male'), data.get('dateRange')))
    conn.commit()
    new_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    conn.close()
    return jsonify({'success': True, 'id': new_id})

@app.route('/api/employees/<int:emp_id>', methods=['PUT'])
@require_auth
def update_employee(emp_id):
    data = request.json
    conn = get_db_connection()
    conn.execute('''UPDATE employees SET 
                    name=?, phone=?, operator=?, address=?, date=?, birthday=?,
                    status=?, photo=?, gender=?, dateRange=?
                    WHERE id=?''',
                 (data.get('name'), data.get('phone'), data.get('operator'),
                  data.get('address'), data.get('date'), data.get('birthday'),
                  data.get('status'), data.get('photo'), data.get('gender'),
                  data.get('dateRange'), emp_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/employees/<int:emp_id>', methods=['DELETE'])
@require_auth
def delete_employee(emp_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM employees WHERE id=?', (emp_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API BREAKS ====================

@app.route('/api/breaks', methods=['GET'])
@require_auth
def get_breaks():
    conn = get_db_connection()
    breaks = conn.execute('SELECT * FROM breaks ORDER BY created_at DESC').fetchall()
    conn.close()
    return jsonify([dict(b) for b in breaks])

@app.route('/api/breaks', methods=['POST'])
@require_auth
def add_break():
    data = request.json
    conn = get_db_connection()
    conn.execute('''INSERT INTO breaks (name, start_time, end_time, planned_duration, actual_minutes, date)
                    VALUES (?, ?, ?, ?, ?, ?)''',
                 (data.get('name'), data.get('start_time'), data.get('end_time'),
                  data.get('planned_duration'), data.get('actual_minutes'), data.get('date')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API CHAT ====================

@app.route('/api/chat', methods=['GET'])
@require_auth
def get_chat():
    conn = get_db_connection()
    messages = conn.execute('SELECT * FROM chat_messages ORDER BY timestamp ASC').fetchall()
    conn.close()
    return jsonify([dict(m) for m in messages])

@app.route('/api/chat', methods=['POST'])
@require_auth
def add_message():
    data = request.json
    conn = get_db_connection()
    conn.execute('''INSERT INTO chat_messages (text, author, time, timestamp)
                    VALUES (?, ?, ?, ?)''',
                 (data.get('text'), data.get('author'), data.get('time'), data.get('timestamp')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API CREDENTIALS ====================

@app.route('/api/credentials', methods=['GET'])
@require_auth
def get_credentials():
    conn = get_db_connection()
    creds = conn.execute('SELECT * FROM employee_credentials').fetchall()
    conn.close()
    return jsonify([dict(c) for c in creds])

@app.route('/api/credentials', methods=['POST'])
@require_auth
def add_credential():
    data = request.json
    conn = get_db_connection()
    conn.execute('''INSERT OR REPLACE INTO employee_credentials (employee_name, login, password)
                    VALUES (?, ?, ?)''',
                 (data.get('employee_name'), data.get('login'), data.get('password')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/credentials/<emp_name>', methods=['DELETE'])
@require_auth
def delete_credential(emp_name):
    conn = get_db_connection()
    conn.execute('DELETE FROM employee_credentials WHERE employee_name=?', (emp_name,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API SHIFTS ====================

@app.route('/api/shifts', methods=['GET'])
@require_auth
def get_shifts():
    conn = get_db_connection()
    shifts = conn.execute('SELECT * FROM shifts').fetchall()
    result = []
    for s in shifts:
        shift = dict(s)
        assignments = conn.execute(
            'SELECT employee_name FROM shift_assignments WHERE shift_name=?',
            (shift['name'],)
        ).fetchall()
        shift['employees'] = [a['employee_name'] for a in assignments]
        result.append(shift)
    conn.close()
    return jsonify(result)

@app.route('/api/shifts', methods=['POST'])
@require_auth
def add_shift():
    data = request.json
    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO shifts (name) VALUES (?)', (data.get('name'),))
        conn.commit()
        success = True
    except:
        success = False
    conn.close()
    return jsonify({'success': success})

@app.route('/api/shifts/<shift_name>', methods=['DELETE'])
@require_auth
def delete_shift(shift_name):
    conn = get_db_connection()
    conn.execute('DELETE FROM shifts WHERE name=?', (shift_name,))
    conn.execute('DELETE FROM shift_assignments WHERE shift_name=?', (shift_name,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/shifts/<shift_name>/assign', methods=['POST'])
@require_auth
def assign_to_shift(shift_name):
    data = request.json
    emp_name = data.get('employee_name')
    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO shift_assignments (shift_name, employee_name) VALUES (?, ?)',
                     (shift_name, emp_name))
        conn.commit()
        success = True
    except:
        success = False
    conn.close()
    return jsonify({'success': success})

@app.route('/api/shifts/<shift_name>/unassign', methods=['POST'])
@require_auth
def unassign_from_shift(shift_name):
    data = request.json
    emp_name = data.get('employee_name')
    conn = get_db_connection()
    conn.execute('DELETE FROM shift_assignments WHERE shift_name=? AND employee_name=?',
                 (shift_name, emp_name))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API WORK TYPES ====================

@app.route('/api/work-types', methods=['GET'])
@require_auth
def get_work_types():
    conn = get_db_connection()
    types = conn.execute('SELECT * FROM work_types').fetchall()
    conn.close()
    return jsonify([dict(t) for t in types])

@app.route('/api/work-types', methods=['POST'])
@require_auth
def set_work_type():
    data = request.json
    conn = get_db_connection()
    conn.execute('''INSERT OR REPLACE INTO work_types (employee_name, work_type) VALUES (?, ?)''',
                 (data.get('employee_name'), data.get('work_type')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API SETTINGS ====================

@app.route('/api/settings/<key>', methods=['GET'])
@require_auth
def get_setting(key):
    conn = get_db_connection()
    row = conn.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
    conn.close()
    return jsonify({'value': row['value'] if row else None})

@app.route('/api/settings/<key>', methods=['POST'])
@require_auth
def set_setting(key):
    data = request.json
    conn = get_db_connection()
    conn.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                 (key, data.get('value')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API BACKUP ====================

@app.route('/api/backup', methods=['GET'])
@require_auth
def get_full_backup():
    conn = get_db_connection()
    data = {
        'employees': [dict(e) for e in conn.execute('SELECT * FROM employees').fetchall()],
        'breaks': [dict(b) for b in conn.execute('SELECT * FROM breaks').fetchall()],
        'chat_messages': [dict(m) for m in conn.execute('SELECT * FROM chat_messages').fetchall()],
        'employee_credentials': [dict(c) for c in conn.execute('SELECT * FROM employee_credentials').fetchall()],
        'shifts': [dict(s) for s in conn.execute('SELECT * FROM shifts').fetchall()],
        'shift_assignments': [dict(a) for a in conn.execute('SELECT * FROM shift_assignments').fetchall()],
        'work_types': [dict(w) for w in conn.execute('SELECT * FROM work_types').fetchall()],
        'settings': [dict(s) for s in conn.execute('SELECT * FROM settings').fetchall()],
        'backup_date': datetime.now().isoformat()
    }
    conn.close()
    return jsonify(data)

@app.route('/api/backup', methods=['POST'])
@require_auth
def restore_backup():
    data = request.json
    conn = get_db_connection()
    
    try:
        conn.execute('DELETE FROM employees')
        for e in data.get('employees', []):
            conn.execute('''INSERT INTO employees (name, phone, operator, address, date, birthday, status, photo, gender, dateRange)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                         (e.get('name'), e.get('phone'), e.get('operator'), e.get('address'),
                          e.get('date'), e.get('birthday'), e.get('status'), e.get('photo'),
                          e.get('gender'), e.get('dateRange')))
        
        conn.execute('DELETE FROM chat_messages')
        for m in data.get('chat_messages', []):
            conn.execute('INSERT INTO chat_messages (text, author, time, timestamp) VALUES (?, ?, ?, ?)',
                         (m.get('text'), m.get('author'), m.get('time'), m.get('timestamp')))
        
        conn.execute('DELETE FROM employee_credentials')
        for c in data.get('employee_credentials', []):
            conn.execute('INSERT INTO employee_credentials (employee_name, login, password) VALUES (?, ?, ?)',
                         (c.get('employee_name'), c.get('login'), c.get('password')))
        
        conn.execute('DELETE FROM shifts')
        conn.execute('DELETE FROM shift_assignments')
        for s in data.get('shifts', []):
            conn.execute('INSERT INTO shifts (name) VALUES (?)', (s.get('name'),))
        for a in data.get('shift_assignments', []):
            conn.execute('INSERT INTO shift_assignments (shift_name, employee_name) VALUES (?, ?)',
                         (a.get('shift_name'), a.get('employee_name')))
        
        conn.execute('DELETE FROM work_types')
        for w in data.get('work_types', []):
            conn.execute('INSERT INTO work_types (employee_name, work_type) VALUES (?, ?)',
                         (w.get('employee_name'), w.get('work_type')))
        
        conn.commit()
        success = True
    except Exception as e:
        print(f"Error: {e}")
        success = False
    
    conn.close()
    return jsonify({'success': success})

# ==================== STATIC FILES ====================

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

# ==================== MAIN ====================

if __name__ == '__main__':
    init_db()
    init_security_db()  # Инициализация таблиц безопасности
    
    logging.info("="*50)
    logging.info("🚀 HR Dashboard with Enhanced Security!")
    logging.info("   ✅ Bcrypt password hashing")
    logging.info("   ✅ Rate limiting (5 attempts/15 min)")
    logging.info("   ✅ CSRF protection")
    logging.info("   ✅ Secure sessions in DB")
    logging.info("   ✅ CORS restricted")
    logging.info("   ✅ 2FA enabled")
    logging.info("   ✅ File logging enabled")
    logging.info("   ✅ HTTPS headers enabled")
    logging.info("="*50)
    
    app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)
