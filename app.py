"""
HR Dashboard Backend - Flask API
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import json
import os
from datetime import datetime, timedelta
import secrets
import hashlib
import pyotp

app = Flask(__name__)
CORS(app)

# ============= БЕЗОПАСНОСТЬ =============

# Секретный ключ API
API_SECRET_KEY = "hr_dashboard_2024_secret_key"

# Для админа
ADMIN_LOGIN = "zayniddin"
ADMIN_PASSWORD = "3020"  # Пароль (хранится временно, при старте хешируется)
ADMIN_PASSWORD_HASH = None  # будет вычислен при старте
TWO_FACTOR_SECRET = None    # будет сгенерирован при старте

# Для супервизора
SUPERVISOR_LOGIN = "supervisor"
SUPERVISOR_PASSWORD = "supervisor"  # Пароль
SUPERVISOR_PASSWORD_HASH = None
SUPERVISOR_TWO_FACTOR_SECRET = None

# Хеширование пароля
def hash_password(password):
    """Создать хеш пароля"""
    salt = API_SECRET_KEY[:16]  # используем часть ключа как соль
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()

# Проверка пароля
def verify_password(password, password_hash):
    """Проверить пароль"""
    return hash_password(password) == password_hash

# Генерация QR-кода для 2FA (ссылка для Google Authenticator)
def generate_2fa_qr(login, secret):
    """Создать ссылку для настройки 2FA"""
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=login,
        issuer_name="HR Dashboard"
    )

# Проверка кода 2FA
def verify_2fa(secret, code):
    """Проверить код двухфакторной авторизации"""
    totp = pyotp.TOTP(secret)
    # Разрешаем код +/- 1 период (30 сек)
    return totp.verify(code, valid_window=1)

# Сессии (в памяти)
sessions = {}  # {token: {login, expires}}

def generate_session():
    """Создать токен сессии"""
    return secrets.token_hex(32)

def create_session(login, two_factor_verified=False):
    """Создать новую сессию"""
    token = generate_session()
    sessions[token] = {
        'login': login,
        'expires': datetime.now() + timedelta(hours=24),
        'two_factor_verified': two_factor_verified
    }
    return token

def verify_session(token):
    """Проверить сессию"""
    if token not in sessions:
        return None
    
    session = sessions[token]
    if datetime.now() > session['expires']:
        del sessions[token]
        return None
    
    return session

def delete_session(token):
    """Удалить сессию"""
    if token in sessions:
        del sessions[token]

# Очистка просроченных сессий
def cleanup_sessions():
    """Удалить просроченные сессии"""
    now = datetime.now()
    expired = [t for t, s in sessions.items() if now > s['expires']]
    for t in expired:
        del sessions[t]

# Проверка API ключа
def require_api_key(f):
    """Декоратор для проверки API ключа"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if api_key != API_SECRET_KEY:
            if request.headers.get('Origin') or request.headers.get('Referer'):
                pass
            else:
                return jsonify({'error': 'Unauthorized', 'message': 'Invalid API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Проверка авторизации (сессия или Basic Auth)
def require_auth(f):
    """Декоратор для проверки авторизации"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Проверяем сессию
        token = request.headers.get('X-Session-Token')
        session = verify_session(token) if token else None
        
        if session:
            return f(*args, **kwargs)
        
        # Проверяем Basic Auth
        auth = request.authorization
        if auth:
            # Для админа - полная авторизация
            if auth.username == ADMIN_LOGIN and verify_password(auth.password, ADMIN_PASSWORD_HASH):
                return f(*args, **kwargs)
            # Для супервизора - полная авторизация  
            if auth.username == SUPERVISOR_LOGIN and verify_password(auth.password, SUPERVISOR_PASSWORD_HASH):
                return f(*args, **kwargs)
        
        return jsonify({'error': 'Unauthorized', 'message': 'Authentication required'}), 401
    return decorated_function

# Проверка что 2FA пройден
def require_2fa(f):
    """Декоратор для проверки 2FA"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('X-Session-Token')
        session = verify_session(token) if token else None
        
        if session and session.get('two_factor_verified'):
            return f(*args, **kwargs)
        
        return jsonify({'error': '2FA Required', 'message': 'Two-factor authentication required'}), 402
    return decorated_function

# ============= ЛОГИРОВАНИЕ =============
import logging
import time
from functools import wraps

log_file = "access.log"

def log_request(f):
    """Логирование запросов"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = time.time()
        ip = request.remote_addr
        method = request.method
        path = request.path
        
        result = f(*args, **kwargs)
        
        duration = time.time() - start_time
        status = result[1] if isinstance(result, tuple) else 200
        
        log_entry = f"{datetime.now()} | {ip} | {method} | {path} | {status} | {duration:.3f}s\n"
        
        try:
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry)
        except:
            pass
        
        return result
    return decorated_function

@app.after_request
def after_request(response):
    response.headers.add('X-API-Key', API_SECRET_KEY)
    return response

DB_NAME = "database.db"

# Инициализация при старте
def init_security():
    global ADMIN_PASSWORD, SUPERVISOR_PASSWORD
    global ADMIN_PASSWORD_HASH, TWO_FACTOR_SECRET, SUPERVISOR_PASSWORD_HASH, SUPERVISOR_TWO_FACTOR_SECRET
    
    # Хешируем пароли
    ADMIN_PASSWORD_HASH = hash_password(ADMIN_PASSWORD)
    SUPERVISOR_PASSWORD_HASH = hash_password(SUPERVISOR_PASSWORD)
    
    # Удаляем пароли из памяти (они больше не нужны в открытом виде)
    del ADMIN_PASSWORD
    del SUPERVISOR_PASSWORD
    
    # Генерируем секреты для 2FA
    TWO_FACTOR_SECRET = pyotp.random_base32()
    SUPERVISOR_TWO_FACTOR_SECRET = pyotp.random_base32()
    
    print(f"🔐 Пароли зашифрованы")
    print(f"🔑 2FA для админа: {TWO_FACTOR_SECRET}")
    print(f"🔑 2FA для супервизора: {SUPERVISOR_TWO_FACTOR_SECRET}")
    print(f"📱 QR ссылка для админа: {generate_2fa_qr(ADMIN_LOGIN, TWO_FACTOR_SECRET)}")

# ==================== API AUTH (Авторизация и 2FA) ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Вход - проверяет логин/пароль, возвращает 2FA код"""
    data = request.json
    login = data.get('login', '').lower().strip()
    password = data.get('password', '').strip()
    
    # Проверяем админа
    if login == ADMIN_LOGIN and verify_password(password, ADMIN_PASSWORD_HASH):
        # Генерируем код для 2FA
        code = pyotp.TOTP(TWO_FACTOR_SECRET).now()
        return jsonify({
            'success': True,
            'require_2fa': True,
            'user_type': 'admin',
            'user_name': 'Admin',
            'message': 'Введите код из Google Authenticator'
        })
    
    # Проверяем супервизора
    if login == SUPERVISOR_LOGIN and verify_password(password, SUPERVISOR_PASSWORD_HASH):
        code = pyotp.TOTP(SUPERVISOR_TWO_FACTOR_SECRET).now()
        return jsonify({
            'success': True,
            'require_2fa': True,
            'user_type': 'supervisor',
            'user_name': 'Supervisor',
            'message': 'Введите код из Google Authenticator'
        })
    
    return jsonify({'success': False, 'error': 'Неверный логин или пароль'})

@app.route('/api/auth/verify-2fa', methods=['POST'])
def verify_2fa():
    """Проверка кода 2FA и создание сессии"""
    data = request.json
    login = data.get('login', '').lower().strip()
    code = data.get('code', '').strip()
    
    if not code:
        return jsonify({'success': False, 'error': 'Введите код'})
    
    # Проверяем код для админа
    if login == ADMIN_LOGIN:
        if verify_2fa(TWO_FACTOR_SECRET, code):
            token = create_session(ADMIN_LOGIN, two_factor_verified=True)
            return jsonify({
                'success': True,
                'token': token,
                'role': 'admin',
                'message': 'Добро пожаловать, Admin!'
            })
    
    # Проверяем код для супервизора
    if login == SUPERVISOR_LOGIN:
        if verify_2fa(SUPERVISOR_TWO_FACTOR_SECRET, code):
            token = create_session(SUPERVISOR_LOGIN, two_factor_verified=True)
            return jsonify({
                'success': True,
                'token': token,
                'role': 'supervisor',
                'message': 'Добро пожаловать, Supervisor!'
            })
    
    return jsonify({'success': False, 'error': 'Неверный код 2FA'})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Выход из системы"""
    token = request.headers.get('X-Session-Token')
    if token:
        delete_session(token)
    return jsonify({'success': True, 'message': 'Вы вышли из системы'})

@app.route('/api/auth/check', methods=['GET'])
def check_auth():
    """Проверить статус авторизации"""
    token = request.headers.get('X-Session-Token')
    session = verify_session(token) if token else None
    
    if session:
        return jsonify({
            'authenticated': True,
            'login': session['login'],
            'two_factor_verified': session.get('two_factor_verified', False)
        })
    
    return jsonify({'authenticated': False})

@app.route('/api/auth/2fa-setup', methods=['GET'])
def get_2fa_setup():
    """Получить информацию для настройки 2FA"""
    token = request.headers.get('X-Session-Token')
    session = verify_session(token) if token else None
    
    if not session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if session['login'] == ADMIN_LOGIN:
        secret = TWO_FACTOR_SECRET
        login = ADMIN_LOGIN
    else:
        secret = SUPERVISOR_TWO_FACTOR_SECRET
        login = SUPERVISOR_LOGIN
    
    return jsonify({
        'secret': secret,
        'qr_url': generate_2fa_qr(login, secret),
        'login': login
    })

# Инициализация базы данных
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Таблица сотрудников
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
    
    # Таблица перерывов
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
    
    # Таблица сообщений чата
    c.execute('''CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        author TEXT NOT NULL,
        time TEXT,
        timestamp INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Таблица логинов сотрудников
    c.execute('''CREATE TABLE IF NOT EXISTS employee_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_name TEXT NOT NULL UNIQUE,
        login TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Таблица смен
    c.execute('''CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Таблица назначений сотрудников в смены
    c.execute('''CREATE TABLE IF NOT EXISTS shift_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_name TEXT NOT NULL,
        employee_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(shift_name, employee_name)
    )''')
    
    # Таблица типов работы сотрудников
    c.execute('''CREATE TABLE IF NOT EXISTS work_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_name TEXT NOT NULL UNIQUE,
        work_type TEXT DEFAULT 'standard',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Таблица настроек
    c.execute('''CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )''')
    
    conn.commit()
    conn.close()
    print("✅ База данных инициализирована")

# Утилиты для работы с БД
def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def dict_from_row(row):
    if row is None:
        return None
    return dict(row)

# ==================== API EMPLOYEES ====================

@app.route('/api/employees', methods=['GET'])
def get_employees():
    conn = get_db_connection()
    employees = conn.execute('SELECT * FROM employees ORDER BY name').fetchall()
    conn.close()
    return jsonify([dict(e) for e in employees])

@app.route('/api/employees', methods=['POST'])
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
def delete_employee(emp_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM employees WHERE id=?', (emp_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API BREAKS ====================

@app.route('/api/breaks', methods=['GET'])
def get_breaks():
    conn = get_db_connection()
    breaks = conn.execute('SELECT * FROM breaks ORDER BY created_at DESC').fetchall()
    conn.close()
    return jsonify([dict(b) for b in breaks])

@app.route('/api/breaks', methods=['POST'])
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
def get_chat():
    conn = get_db_connection()
    messages = conn.execute('SELECT * FROM chat_messages ORDER BY timestamp ASC').fetchall()
    conn.close()
    return jsonify([dict(m) for m in messages])

@app.route('/api/chat', methods=['POST'])
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
def get_credentials():
    conn = get_db_connection()
    creds = conn.execute('SELECT * FROM employee_credentials').fetchall()
    conn.close()
    return jsonify([dict(c) for c in creds])

@app.route('/api/credentials', methods=['POST'])
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
def delete_credential(emp_name):
    conn = get_db_connection()
    conn.execute('DELETE FROM employee_credentials WHERE employee_name=?', (emp_name,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API SHIFTS ====================

@app.route('/api/shifts', methods=['GET'])
def get_shifts():
    conn = get_db_connection()
    shifts = conn.execute('SELECT * FROM shifts').fetchall()
    result = []
    for s in shifts:
        shift = dict(s)
        # Получить сотрудников смены
        assignments = conn.execute(
            'SELECT employee_name FROM shift_assignments WHERE shift_name=?',
            (shift['name'],)
        ).fetchall()
        shift['employees'] = [a['employee_name'] for a in assignments]
        result.append(shift)
    conn.close()
    return jsonify(result)

@app.route('/api/shifts', methods=['POST'])
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
def delete_shift(shift_name):
    conn = get_db_connection()
    conn.execute('DELETE FROM shifts WHERE name=?', (shift_name,))
    conn.execute('DELETE FROM shift_assignments WHERE shift_name=?', (shift_name,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/shifts/<shift_name>/assign', methods=['POST'])
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
def get_work_types():
    conn = get_db_connection()
    types = conn.execute('SELECT * FROM work_types').fetchall()
    conn.close()
    return jsonify([dict(t) for t in types])

@app.route('/api/work-types', methods=['POST'])
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
def get_setting(key):
    conn = get_db_connection()
    row = conn.execute('SELECT value FROM settings WHERE key=?', (key,)).fetchone()
    conn.close()
    return jsonify({'value': row['value'] if row else None})

@app.route('/api/settings/<key>', methods=['POST'])
def set_setting(key):
    data = request.json
    conn = get_db_connection()
    conn.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
                 (key, data.get('value')))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ==================== API FULL DATA (for backup/restore) ====================

@app.route('/api/backup', methods=['GET'])
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
def restore_backup():
    data = request.json
    conn = get_db_connection()
    
    try:
        # Очистка и восстановление
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
        print(f"Ошибка восстановления: {e}")
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
    init_security()  # Инициализация защиты
    init_db()
    print("\n" + "="*50)
    print("🚀 HR Dashboard Backend запущен!")
    print("   Адрес: http://localhost:5000")
    print("="*50 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
