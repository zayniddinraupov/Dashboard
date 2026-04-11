
// Глобальные переменные
var trainingData = [];
var trainers = [];
var currentSort = { column: null, direction: 'asc' };
var useFirebase = true; // Включаем Firebase для синхронизации
var isFirebaseConfigured = false;
var actionHistory = []; // История действий
var currentSupervisor = null;

// Супервайзеры
var supervisors = [
    { id: "supervisor_1", name: "Ахмедов Сардорбек Комилжон ўғли" },
    { id: "supervisor_2", name: "Ўлмасова Нигина Азизовна" },
    { id: "supervisor_3", name: "Носиров Жафар Носир ўғли" },
    { id: "supervisor_4", name: "Начальник службы" }
];

// ==================== СИСТЕМА ВХОДА ====================
function checkLogin() {
    var savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            var user = JSON.parse(savedUser);
            currentUser = user;
            isLoggedIn = true;
            applyUserRole(user);
            return true;
        } catch (e) {}
    }
    return false;
}
    
function applyUserRole(user) {
    if (user.role === 'admin') {
        isAdminLoggedIn = true;
        currentSupervisor = 'all';
    } else if (user.role === 'supervisor') {
        isAdminLoggedIn = false;
        currentSupervisor = user.supervisorId;
    }
    updateAdminPanel();
    updateCurrentUserDisplay();
    applyFilters();
}
    
// Функция переключения боковой панели
function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var mainContent = document.querySelector('.main-content');
    
    if (!sidebar) return;
    
    // Определяем какой класс использовать в зависимости от ширины экрана
    if (window.innerWidth <= 1024) {
        // Мобильная/планшетная версия
        sidebar.classList.toggle('mobile-open');
    } else {
        // Десктоп версия
        sidebar.classList.toggle('hidden');
        if (mainContent) {
            mainContent.classList.toggle('full-width');
        }
    }
}
    
function closeSidebarMobile() {
    var sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 1024 && sidebar) {
        sidebar.classList.remove('active');
    }
}

// Делаем функции глобальными для onclick
window.openModal = openModal;
window.closeModal = closeModal;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.deleteEmployee = deleteEmployee;
window.sortTable = sortTable;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.exportToCSV = exportToCSV;
window.printTable = printTable;
window.deleteAll = deleteAll;
window.toggleSidebar = toggleSidebar;
window.closeSidebarMobile = closeSidebarMobile;
window.showHistory = showHistory;
window.recoverFromFirebase = recoverFromFirebase;
window.recoverDeletedData = recoverDeletedData;
window.isAdmin = isAdmin;
window.canEdit = canEdit;
window.openAdminLogin = openAdminLogin;
window.closeAdminLogin = closeAdminLogin;
window.logoutAdmin = logoutAdmin;
window.updateAdminPanel = updateAdminPanel;
window.showNotification = showNotification;
window.toggleMobileSidebar = toggleMobileSidebar;
window.toggleSupervisorStats = toggleSupervisorStats;
window.showLastTrainingDate = showLastTrainingDate;

// ==================== ЗАЩИТА ОТ XSS ====================

// Экранирование HTML для защиты от XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// ==================== API URL
var API_BASE = '';

// CSRF токен для защиты
var csrfToken = null;

// Текущий пользователь
var currentUser = null;
var isLoggedIn = false;
var authToken = null;

// ==================== СИСТЕМА ВХОДА ====================

// Состояние админа
var isAdminLoggedIn = false;

// Инициализация CSRF токена
function initSecurity() {
    fetch(API_BASE + '/api/auth/csrf')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            csrfToken = data.csrf_token;
        })
        .catch(function(e) {
            console.error('CSRF init failed:', e);
        });
}

// Асинхронная функция входа на сервер
async function serverLogin(username, password) {
    try {
        var response = await fetch(API_BASE + '/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                login: username,
                password: password
            })
        });
        
        var data = await response.json();
        
        if (data.success) {
            // Проверяем, требуется ли 2FA
            if (data.requires_2fa) {
                // Показываем модальное окно для ввода 2FA кода
                show2FAModal(data.login);
                return { success: true, requires_2fa: true, message: 'Введите код 2FA' };
            }
            
            // Обычный вход без 2FA
            authToken = data.token;
            csrfToken = data.csrf_token;
            currentUser = {
                username: username,
                role: data.role,
                name: data.user_name
            };
            isLoggedIn = true;
            isAdminLoggedIn = data.role === 'admin';
            
            // Сохраняем (без пароля!)
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            applyUserRole(currentUser);
            return { success: true, message: data.message };
        } else {
            return { success: false, message: data.error };
        }
    } catch (e) {
        return { success: false, message: 'Ошибка соединения с сервером' };
    }
}
    
// Функция для отправки 2FA кода
async function submit2FA(login, code) {
    try {
        var response = await fetch(API_BASE + '/api/auth/verify-2fa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                login: login,
                code: code
            })
        });
        
        var data = await response.json();
        
        if (data.success) {
            authToken = data.token;
            csrfToken = data.csrf_token;
            currentUser = {
                username: login,
                role: data.role,
                name: data.user_name
            };
            isLoggedIn = true;
            isAdminLoggedIn = data.role === 'admin';
            
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            close2FAModal();
            applyUserRole(currentUser);
            hideLogin();
            return { success: true, message: data.message };
        } else {
            return { success: false, message: data.error };
        }
    } catch (e) {
        return { success: false, message: 'Ошибка соединения с сервером' };
    }
}
    
// Показать модальное окно 2FA
function show2FAModal(login) {
    var modal = document.getElementById('twoFactorModal');
    if (!modal) {
        // Создаём модальное окно если его нет
        var loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) {
            loginOverlay.innerHTML += `
                <div id="twoFactorModal" class="modal" style="display:flex; align-items:center; justify-content:center;">
                    <div class="modal-content" style="max-width:350px; text-align:center;">
                        <h2 style="color:var(--text-primary); margin-bottom:15px;">🔐 Двухфакторная авторизация</h2>
                        <p style="color:var(--text-secondary); margin-bottom:20px;">Введите код из приложения Google Authenticator</p>
                        <input type="text" id="twoFactorCode" placeholder="000000" maxlength="6" 
                            style="width:100%; padding:12px; font-size:18px; text-align:center; 
                            letter-spacing:8px; border:2px solid var(--border-color); 
                            border-radius:8px; background:var(--bg-input); color:var(--text-primary);">
                        <div style="margin-top:20px; display:flex; gap:10px;">
                            <button onclick="submit2FACode()" style="flex:1; padding:12px; 
                                background:linear-gradient(135deg, #00d9ff, #00ff88); border:none; 
                                border-radius:8px; cursor:pointer; font-weight:bold;">Подтвердить</button>
                        </div>
                    </div>
                </div>
            `;
            modal = document.getElementById('twoFactorModal');
        }
    }
    
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('twoFactorCode').value = '';
        document.getElementById('twoFactorCode').focus();
        window.pending2FALogin = login;
    }
}

function close2FAModal() {
    var modal = document.getElementById('twoFactorModal');
    if (modal) {
        modal.style.display = 'none';
    }
    window.pending2FALogin = null;
}

function submit2FACode() {
    var code = document.getElementById('twoFactorCode').value.trim();
    if (!code) {
        alert('Введите код!');
        return;
    }
    
    var login = window.pending2FALogin;
    if (!login) {
        alert('Ошибка: сессия истекла');
        return;
    }
    
    submit2FA(login, code).then(function(result) {
        if (result.success) {
            showNotification('✅ ' + result.message);
        } else {
            alert('❌ ' + result.message);
        }
    });
}
        
// Делаем функции глобальными
window.submit2FACode = submit2FACode;
window.close2FAModal = close2FAModal;
    
// Показать QR код для 2FA
async function show2FAQrCode() {
    var login = prompt('Введите ваш логин для получения QR кода:');
    if (!login) return;
    
    try {
        var response = await fetch(API_BASE + '/api/auth/2fa-qr/' + login, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        var data = await response.json();
        
        if (data.qr_uri) {
            // Создаём модальное окно с QR кодом
            var qrModal = document.createElement('div');
            qrModal.id = 'qrCodeModal';
            qrModal.style.cssText = 'display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; align-items:center; justify-content:center;';
            qrModal.innerHTML = `
                <div style="background:white; padding:30px; border-radius:20px; text-align:center; max-width:400px; margin:20px;">
                    <h2 style="color:#1e293b; margin-bottom:15px;">🔐 Настройка 2FA</h2>
                    <p style="color:#64748b; margin-bottom:20px;">Отсканируйте QR код в приложении Google Authenticator</p>
                    <div id="qrcode-container" style="margin:20px auto;"></div>
                    <p style="color:#64748b; font-size:12px; margin-bottom:10px;">Или введите вручную:</p>
                    <input type="text" value="${data.secret}" readonly 
                        style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; font-size:11px; text-align:center; color:#64748b;" 
                        onclick="this.select()">
                    <div style="margin-top:20px;">
                        <button onclick="document.getElementById('qrCodeModal').remove()" 
                            style="padding:12px 30px; background:linear-gradient(135deg, #667eea, #764ba2); 
                            color:white; border:none; border-radius:10px; cursor:pointer; font-weight:600;">Закрыть</button>
                    </div>
                </div>
            `;
            document.body.appendChild(qrModal);
            
            // Генерируем QR код
            if (typeof QRCode !== 'undefined') {
                var container = document.getElementById('qrcode-container');
                container.innerHTML = '';
                new QRCode(container, {
                    text: data.qr_uri,
                    width: 200,
                    height: 200,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            } else {
                // Если QRCode не загружен, показываем ссылку
                document.getElementById('qrcode-container').innerHTML = 
                    '<a href="' + data.qr_uri + '" target="_blank" style="color:#667eea; font-weight:600;">Открыть ссылку</a>';
                
                // Загружаем библиотеку QRCode
                var script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
                script.onload = function() {
                    var container = document.getElementById('qrcode-container');
                    container.innerHTML = '';
                    new QRCode(container, {
                        text: data.qr_uri,
                        width: 200,
                        height: 200
                    });
                };
                document.head.appendChild(script);
            }
        } else {
            alert('Пользователь не найден: ' + login);
        }
    } catch (e) {
        alert('Ошибка получения QR кода: ' + e.message);
    }
}
    
window.show2FAQrCode = show2FAQrCode;
    
// Асинхронный выход
async function serverLogout() {
    try {
        await fetch(API_BASE + '/api/auth/logout', {
            method: 'POST',
            headers: {
                'X-Session-Token': authToken || '',
                'X-CSRF-Token': csrfToken || ''
            }
        });
    } catch (e) {}
    
    logout();
}

function checkLogin() {
    // Проверяем сохранённую сессию
    var savedToken = localStorage.getItem('authToken');
    var savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        // Проверяем на сервере
        fetch(API_BASE + '/api/auth/check', {
            headers: { 'X-Session-Token': savedToken }
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.authenticated) {
                authToken = savedToken;
                currentUser = JSON.parse(savedUser);
                isLoggedIn = true;
                isAdminLoggedIn = data.role === 'admin';
                applyUserRole(currentUser);
            } else {
                // Сессия истекла
                logout();
            }
        })
        .catch(function() {
            // Сервер недоступен - используем локальные данные
            try {
                var user = JSON.parse(savedUser);
                currentUser = user;
                isLoggedIn = true;
                applyUserRole(user);
            } catch (e) {}
        });
    }
}

function applyUserRole(user) {
    isAdminLoggedIn = user && user.role === 'admin';
    currentSupervisor = 'all';
    updateAdminPanel();
    updateCurrentUserDisplay();
    applyFilters();
}
    
function login(username, password) {
    // Теперь используем серверную аутентификацию
    serverLogin(username, password).then(function(result) {
        if (result.success) {
            hideLogin();
            showNotification('✅ ' + result.message);
        } else {
            alert('❌ ' + result.message);
        }
    });
}
    
function logout() {
    currentUser = null;
    isLoggedIn = false;
    isAdminLoggedIn = false;
    currentSupervisor = null;
    authToken = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    updateAdminPanel();
    updateCurrentUserDisplay();
    applyFilters();
}
    
function showLogin() {
    document.getElementById('loginOverlay').classList.remove('hidden');
}

function hideLogin() {
    document.getElementById('loginOverlay').classList.add('hidden');
}

// Вход в админ-панель (использует серверную аутентификацию)
function openAdminLogin() {
    document.getElementById('adminLoginModal').classList.add('active');
    document.getElementById('adminCodeInput').value = '';
    document.getElementById('adminCodeInput').focus();
}

function closeAdminLogin() {
    document.getElementById('adminLoginModal').classList.remove('active');
}

// Обработка входа админа - через сервер!
document.getElementById('adminLoginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var code = document.getElementById('adminCodeInput').value;
    
    // Используем серверную аутентификацию для админа
    serverLogin('zayniddin', code).then(function(result) {
        if (result.success) {
            isAdminLoggedIn = true;
            currentSupervisor = 'all';
            closeAdminLogin();
            updateAdminPanel();
            updateCurrentUserDisplay();
            applyFilters();
            showNotification('✅ Добро пожаловать, админ!');
        } else {
            alert('❌ ' + result.message);
        }
    });
});

// Выход из админ-панели
function logoutAdmin() {
    serverLogout();
    showLogin();
    showNotification('Вы вышли из системы');
}

// Уведомление
function showNotification(message) {
    // Просто показываем alert
    alert(message);
}

// Обновление отображения текущего пользователя
function updateCurrentUserDisplay() {
    var display = document.getElementById('currentUserDisplay');
    var nameEl = document.getElementById('currentUserName');
    
    if (display && nameEl) {
        if (currentUser) {
            display.style.display = 'block';
            if (isAdminLoggedIn) {
                nameEl.textContent = '👑 Админ';
                nameEl.style.color = '#f59e0b';
            } else {
                nameEl.textContent = '👤 Пользователь';
                nameEl.style.color = '#00d9ff';
            }
        } else {
            display.style.display = 'none';
        }
    }
}
    
// Обновление отображения админ-панели
function updateAdminPanel() {
    var loginBtn = document.getElementById('adminLoginBtn');
    var logoutBtn = document.getElementById('adminLogoutBtn');
    var adminItems = document.querySelectorAll('.admin-only');
    
    if (isAdminLoggedIn) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'flex';
        adminItems.forEach(function(btn) {
            btn.style.display = 'flex';
        });
    } else {
        if (loginBtn) loginBtn.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        adminItems.forEach(function(btn) {
            btn.style.display = 'none';
        });
    }
}
    
// Проверка: админ ли вошёл
function isAdmin() {
    return isAdminLoggedIn === true;
}

// Проверка: может ли редактировать (только админ)
function canEdit(employee) {
    return isAdmin();
}

// Тренеры (только супервайзеры)
var defaultTrainers = [
    "Ахмедов Сардорбек Комилжон ўғли",
    "Ўлмасова Нигина Азизовна",
    "Носиров Жафар Носир ўғли",
    "Начальник службы"
];

// Данные по умолчанию (пустой список)
function getDefaultData() {
    return [];
}

// История действий
function logAction(action, employeeName, supervisorId) {
    var entry = {
        action: action,
        employee: employeeName,
        supervisor: supervisorId,
        supervisorName: getSupervisorName(supervisorId) || 'Админ',
        timestamp: new Date().toISOString()
    };
    actionHistory.unshift(entry);
    
    // Ограничиваем историю 50 записями
    if (actionHistory.length > 50) actionHistory = actionHistory.slice(0, 50);
    
    localStorage.setItem('actionHistory', JSON.stringify(actionHistory));
}

function loadActionHistory() {
    var history = localStorage.getItem('actionHistory');
    if (history) {
        try { actionHistory = JSON.parse(history); } catch (e) {}
    }
}

function showHistory() {
    if (actionHistory.length === 0) {
        alert('История действий пуста');
        return;
    }
    
    var html = '📋 История действий:\n\n';
    actionHistory.slice(0, 20).forEach(function(entry) {
        var date = new Date(entry.timestamp);
        var dateStr = date.toLocaleDateString('ru');
        var timeStr = date.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
        html += '[' + dateStr + ' ' + timeStr + '] ' + entry.supervisorName + ' - ' + entry.action + ': ' + entry.employee + '\n';
    });
    
    alert(html);
}

function getSupervisorName(supervisorId) {
    if (!supervisorId) return '';
    var sup = supervisors.find(function(s) { return s.id === supervisorId; });
    return sup ? sup.name : '';
}

function updateSidebarStats() {
    var totalEl = document.getElementById('statTotal');
    var todayEl = document.getElementById('statToday');
    
    // Подсчитываем данные с учётом текущего фильтра
    var filteredData = trainingData.slice();
    if (currentSupervisor && currentSupervisor !== 'all') {
        filteredData = filteredData.filter(function(item) { 
            return item.addedBy === currentSupervisor; 
        });
    }
    
    if (totalEl) {
        totalEl.textContent = filteredData.length;
    }
    
    if (todayEl) {
        var today = new Date();
        var todayStr = ('0' + today.getDate()).slice(-2) + '.' + ('0' + (today.getMonth() + 1)).slice(-2) + '.' + today.getFullYear();
        var countToday = 0;
        filteredData.forEach(function(item) {
            if (item.date === todayStr) countToday++;
        });
        todayEl.textContent = countToday;
    }
}

// Заглушки для обратной совместимости (удалены из основного кода)
function renderSupervisorStats() { /* устарела */ }
function updateStatsVisibility() { /* устарела */ }

// ==================== СТАТИСТИКА И ДИАГРАММА ====================

// Функция парсинга даты
function parseDate(dateStr) {
    if (!dateStr) return null;
    var parts = dateStr.split('.');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return null;
}

// Отображение статистики супервайзеров
function renderSupervisorStatsList() {
    var container = document.getElementById('supervisorStatsList');
    if (!container) return;
    
    // Маппинг имени тренера к ID супервайзера
    var trainerToSupervisor = {};
    supervisors.forEach(function(s) { 
        trainerToSupervisor[s.name] = s.id;
    });
    
    // Подсчитываем для каждого супервайзера
    var stats = {};
    supervisors.forEach(function(s) { 
        stats[s.id] = { count: 0, name: s.name, lastDate: null }; 
    });
    
    // Считаем по полю trainer (кто обучил) и определяем последнюю дату
    trainingData.forEach(function(item) {
        if (item.trainer && trainerToSupervisor[item.trainer]) {
            var supId = trainerToSupervisor[item.trainer];
            stats[supId].count++;
            
            // Сравниваем даты для определения последней
            var itemDate = parseDate(item.date);
            var lastDate = stats[supId].lastDate ? parseDate(stats[supId].lastDate) : null;
            
            if (!lastDate || (itemDate && itemDate > lastDate)) {
                stats[supId].lastDate = item.date;
            }
        }
    });
    
    // Сортируем по количеству
    var sorted = Object.keys(stats).sort(function(a, b) {
        return stats[b].count - stats[a].count;
    });
    
    var maxCount = 0;
    sorted.forEach(function(id) {
        if (stats[id].count > maxCount) maxCount = stats[id].count;
    });
    
    var html = '';
    sorted.forEach(function(id) {
        var item = stats[id];
        var percent = maxCount > 0 ? (item.count / maxCount * 100) : 0;
        var isCurrentUser = currentSupervisor === id;
        
        // Формируем дату последнего обучения
        var lastDateDisplay = item.lastDate ? escapeHtml(item.lastDate) : '—';
        
        html += '<div class="supervisor-stat-item' + (isCurrentUser ? ' active' : '') + '">';
        html += '<div class="supervisor-stat-name" onclick="showLastTrainingDate(\'' + escapeHtml(id) + '\')" title="Нажмите, чтобы увидеть дату последнего обучения">' + escapeHtml(item.name) + '</div>';
        html += '<div class="supervisor-last-date" id="lastDate-' + escapeHtml(id) + '">Посл. обучение: ' + lastDateDisplay + '</div>';
        html += '<div class="supervisor-stat-bar">';
        html += '<div class="supervisor-stat-fill" style="width:' + percent + '%"></div>';
        html += '</div>';
        html += '<div class="supervisor-stat-count">' + item.count + '</div>';
        html += '</div>';
    });
    
    container.innerHTML = html;
    
    // Рисуем диаграмму
    drawChart();
}

// Функция показа даты последнего обучения при клике
function showLastTrainingDate(supervisorId) {
    var sup = supervisors.find(function(s) { return s.id === supervisorId; });
    if (!sup) return;
    
    // Находим последнюю дату обучения для этого супервайзера
    var trainerToSupervisor = {};
    supervisors.forEach(function(s) { 
        trainerToSupervisor[s.name] = s.id;
    });
    
    var lastDate = null;
    var lastEmployee = '';
    
    trainingData.forEach(function(item) {
        if (item.trainer && trainerToSupervisor[item.trainer] === supervisorId) {
            var itemDate = parseDate(item.date);
            var currentLastDate = lastDate ? parseDate(lastDate) : null;
            
            if (!currentLastDate || (itemDate && itemDate > currentLastDate)) {
                lastDate = item.date;
                lastEmployee = item.name;
            }
        }
    });
    
    if (lastDate) {
        alert('📅 Последнее обучение:\n\n' + sup.name + '\nОбучил: ' + lastEmployee + '\nДата: ' + lastDate);
    } else {
        alert('📅 Последнее обучение:\n\n' + sup.name + '\n\nПока нет данных об обучении');
    }
}
    
// Делаем функцию глобальной
window.showLastTrainingDate = showLastTrainingDate;

// Функция сворачивания/разворачивания панели супервайзеров
function toggleSupervisorStats() {
    var list = document.getElementById('supervisorStatsList');
    var toggle = document.getElementById('supervisorStatsToggle');
    
    if (list.style.display === 'none') {
        list.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        list.style.display = 'none';
        toggle.textContent = '▶';
    }
}
    
window.toggleSupervisorStats = toggleSupervisorStats;

// Функция переключения мобильного меню
function toggleMobileSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
    }
}

window.toggleMobileSidebar = toggleMobileSidebar;

// Функция просмотра подписи
function viewSignature(employeeId) {
    var employee = null;
    for (var i = 0; i < trainingData.length; i++) {
        if (trainingData[i].id === employeeId) { employee = trainingData[i]; break; }
    }
    
    if (!employee || !employee.signatureImage) return;
    
    var w = window.open("", "Подпись", "width=400,height=250");
    w.document.write('<html><head><title>Подпись сотрудника</title></head><body style="font-family:Segoe UI;padding:20px;text-align:center;">');
    w.document.write('<h3>Подпись сотрудника</h3>');
    w.document.write('<p><strong>' + escapeHtml(employee.name) + '</strong></p>');
    w.document.write('<img src="' + employee.signatureImage + '" style="max-width:100%;border:1px solid #ccc;padding:10px;">');
    w.document.write('<p style="color:#666;margin-top:15px;">Дата: ' + escapeHtml(employee.signedAt) + '</p>');
    w.document.write('</body></html>');
    w.document.close();
}

// Функции для электронной подписи
function openSignModal(employeeId) {
    var employee = null;
    for (var i = 0; i < trainingData.length; i++) {
        if (trainingData[i].id === employeeId) { employee = trainingData[i]; break; }
    }
    
    if (!employee) return;
    
    // Если уже подписано, показываем info
    if (employee.signed && employee.signedAt) {
        var signInfo = employee.signatureImage ? '\nПодпись: (рисунок сохранён)' : '\nПодпись: ' + employee.signature;
        alert('✅ Уже подписано!\n\nСотрудник: ' + employee.name + signInfo + '\nДата: ' + employee.signedAt);
        return;
    }
    
    signEmployeeId = employeeId;
    document.getElementById('signEmployeeName').textContent = 'Сотрудник: ' + employee.name;
    document.getElementById('signModal').classList.add('active');
    
    // Инициализируем canvas после показа модального окна
    setTimeout(function() {
        initSignatureCanvas();
        clearSignature();
    }, 100);
}

function closeSignModal() {
    document.getElementById('signModal').classList.remove('active');
    signEmployeeId = null;
}

function confirmSignature() {
    if (!signatureCanvas) {
        alert('Ошибка: canvas не найден');
        return;
    }
    
    // Проверяем, есть ли рисунок
    var canvasData = signatureCanvas.toDataURL();
    // Проверяем, что canvas не пустой (просто белый фон)
    var isEmpty = true;
    var pixelData = signatureCtx.getImageData(0, 0, signatureCanvas.width, signatureCanvas.height).data;
    for (var i = 3; i < pixelData.length; i += 4) {
        if (pixelData[i] > 0) {
            isEmpty = false;
            break;
        }
    }
    
    if (isEmpty) {
        alert('Пожалуйста, нарисуйте подпись пальцем!');
        return;
    }
    
    if (!signEmployeeId) return;
    
    // Находим сотрудника и обновляем
    var index = -1;
    for (var i = 0; i < trainingData.length; i++) {
        if (trainingData[i].id === signEmployeeId) { index = i; break; }
    }
    
    if (index !== -1) {
        var now = new Date();
        var dateStr = ('0' + now.getDate()).slice(-2) + '.' + ('0' + (now.getMonth() + 1)).slice(-2) + '.' + now.getFullYear();
        var timeStr = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
        
        trainingData[index].signed = true;
        trainingData[index].signature = 'Подпись'; // Текстовая метка
        trainingData[index].signatureImage = canvasData; // Сохраняем рисунок как base64
        trainingData[index].signedAt = dateStr + ' ' + timeStr;
        
        saveData();
        applyFilters();
        
        closeSignModal();
        alert('✅ Подпись сохранена!\n\nСотрудник: ' + trainingData[index].name + '\nДата: ' + trainingData[index].signedAt);
    }
}

window.openSignModal = openSignModal;
window.closeSignModal = closeSignModal;
window.confirmSignature = confirmSignature;
window.clearSignature = clearSignature;
window.viewSignature = viewSignature;

// Глобальные переменные для Canvas подписи
var signatureCanvas, signatureCtx;
var isDrawing = false;
var lastX = 0;
var lastY = 0;

// Инициализация Canvas для подписи
function initSignatureCanvas() {
    signatureCanvas = document.getElementById('signatureCanvas');
    if (!signatureCanvas) return;
    
    signatureCtx = signatureCanvas.getContext('2d');
    signatureCtx.strokeStyle = '#000';
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    
    // Обработчики для мыши
    signatureCanvas.addEventListener('mousedown', startDrawing);
    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', stopDrawing);
    signatureCanvas.addEventListener('mouseout', stopDrawing);
    
    // Обработчики для касаний (телефон)
    signatureCanvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        var touch = e.touches[0];
        var rect = signatureCanvas.getBoundingClientRect();
        lastX = touch.clientX - rect.left;
        lastY = touch.clientY - rect.top;
        isDrawing = true;
    });
    
    signatureCanvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (!isDrawing) return;
        var touch = e.touches[0];
        var rect = signatureCanvas.getBoundingClientRect();
        var x = touch.clientX - rect.left;
        var y = touch.clientY - rect.top;
        
        signatureCtx.beginPath();
        signatureCtx.moveTo(lastX, lastY);
        signatureCtx.lineTo(x, y);
        signatureCtx.stroke();
        
        lastX = x;
        lastY = y;
    });
    
    signatureCanvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        isDrawing = false;
    });
}

function startDrawing(e) {
    isDrawing = true;
    var rect = signatureCanvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawing) return;
    var rect = signatureCanvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    
    signatureCtx.beginPath();
    signatureCtx.moveTo(lastX, lastY);
    signatureCtx.lineTo(x, y);
    signatureCtx.stroke();
    
    lastX = x;
    lastY = y;
}

function stopDrawing() {
    isDrawing = false;
}

function clearSignature() {
    if (!signatureCanvas) return;
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}

// ==================== ТЕМА ОБУЧЕНИЯ ====================
function showThemeInfo(employeeId) {
    var employee = null;
    for (var i = 0; i < trainingData.length; i++) {
        if (trainingData[i].id === employeeId) { employee = trainingData[i]; break; }
    }
    
    if (!employee) return;
    
    var content = document.getElementById('themeModalContent');
    
    content.innerHTML = `
        <div style="text-align:center; padding: 20px 0;">
            <div style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <div style="font-size: 3rem; margin-bottom: 10px;">📚</div>
                <h3 style="color: #4338ca; margin-bottom: 10px;">${escapeHtml(employee.theme)}</h3>
            </div>
            
            <div style="text-align:left; background: var(--bg-card); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                <p style="margin-bottom: 10px;"><strong>👤 Сотрудник:</strong> ${escapeHtml(employee.name)}</p>
                <p style="margin-bottom: 10px;"><strong>📅 Дата:</strong> ${escapeHtml(employee.date)}</p>
                <p style="margin-bottom: 10px;"><strong>⏰ Время:</strong> ${escapeHtml(employee.time)}</p>
                <p style="margin-bottom: 10px;"><strong>👨‍🏫 Обучивший:</strong> ${escapeHtml(employee.trainer)}</p>
                ${employee.signed ? '<p style="color: #10b981;"><strong>✅ Подписано:</strong> ' + escapeHtml(employee.signedAt) + '</p>' : '<p style="color: #f59e0b;">⏳ Ещё не подписано</p>'}
            </div>
        </div>
    `;
    
    document.getElementById('themeModal').classList.add('active');
}

function closeThemeModal() {
    document.getElementById('themeModal').classList.remove('active');
}

window.showThemeInfo = showThemeInfo;
window.closeThemeModal = closeThemeModal;

// Рисование диаграммы
function drawChart() {
    var canvas = document.getElementById('trainingChart');
    if (!canvas) return;
    
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    
    // Очищаем - заливаем тёмным фоном
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, width, height);
    
    // Подсчитываем по месяцам
    var months = {};
    var monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    
    trainingData.forEach(function(item) {
        if (item.date) {
            var parts = item.date.split('.');
            if (parts.length === 3) {
                var month = parseInt(parts[1]) - 1;
                var year = parts[2];
                var key = monthNames[month] + ' ' + year.slice(2);
                months[key] = (months[key] || 0) + 1;
            }
        }
    });
    
    // Берём последние 6 месяцев
    var labels = Object.keys(months).slice(-6);
    var data = labels.map(function(l) { return months[l]; });
    
    if (data.length === 0) {
        // Нет данных - показываем заглушку
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 12px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('📊 Нет данных', width/2, height/2);
        return;
    }
    
    var maxVal = Math.max.apply(null, data);
    var barWidth = (width - 30) / data.length;
    var chartHeight = height - 30;
    
    // Яркие цвета для столбиков
    var colors = ['#00d9ff', '#00ff88', '#ffd700', '#ff6b6b', '#a855f7', '#f97316'];
    
    // Рисуем столбики
    data.forEach(function(val, i) {
        var barHeight = (val / maxVal) * chartHeight;
        var x = 15 + i * barWidth + 3;
        var y = height - 20 - barHeight;
        
        // Цвет столбика
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, y, barWidth - 6, barHeight);
        
        // Значение сверху
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(val, x + (barWidth - 6) / 2, y - 3);
        
        // Подпись снизу
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px Segoe UI';
        ctx.fillText(labels[i], x + (barWidth - 6) / 2, height - 5);
    });
}

// Основные функции
function openModal() {
    if (currentSupervisor) {
        var sup = supervisors.find(function(s) { return s.id === currentSupervisor; });
        if (sup) alert('Вы вошли как: ' + sup.name + '\nВы добавляете сотрудника от своего имени.');
    }
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('trainingDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('trainingTime').value = "09:00";
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('addForm').reset();
}

function openEditModal(id) {
    var employee = null;
    for (var i = 0; i < trainingData.length; i++) {
        if (trainingData[i].id === id) { employee = trainingData[i]; break; }
    }
    if (!employee) return;
    
    // Проверка: только админ или создатель может редактировать
    if (!canEdit(employee)) {
        var addedByName = getSupervisorName(employee.addedBy) || 'Админ';
        alert('⛔ Нельзя изменить!\n\nЭтого сотрудника добавил: ' + addedByName);
        return;
    }
    
    document.getElementById('editEmployeeId').value = employee.id;
    document.getElementById('editEmployeeName').value = employee.name;
    document.getElementById('editTrainingTheme').value = employee.theme;
    
    var dateParts = employee.date.split('.');
    document.getElementById('editTrainingDate').value = dateParts[2] + '-' + dateParts[1] + '-' + dateParts[0];
    document.getElementById('editTrainingTime').value = employee.time;
    
    populateTrainerSelect('editTrainerSelect', employee.trainer);
    document.getElementById('editModalOverlay').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModalOverlay').classList.remove('active');
    document.getElementById('editForm').reset();
}

// Корзина для удалённых сотрудников
var trashBin = [];

// Удаление сотрудника (в корзину)
function deleteEmployee(id) {
    if (!trainingData || trainingData.length === 0) return;
    
    var employee = null;
    var index = -1;
    for (var i = 0; i < trainingData.length; i++) {
        if (trainingData[i].id === id) { employee = trainingData[i]; index = i; break; }
    }
    
    if (!employee) { alert('Сотрудник не найден'); return; }
    
    // Проверка: только админ может удалить
    if (!canEdit(employee)) {
        alert('⛔ Нельзя удалить!\nТолько админ может удалять сотрудников.');
        return;
    }
    
    // Защита от случайного удаления
    if (!confirm('Переместить в корзину сотрудника "' + employee.name + '"?')) {
        return;
    }
    
    // Добавляем в корзину с датой удаления
    employee.deletedAt = new Date().toISOString();
    trashBin.unshift(employee);
    
    // Ограничиваем корзину 50 записями
    if (trashBin.length > 50) trashBin = trashBin.slice(0, 50);
    localStorage.setItem('trashBin', JSON.stringify(trashBin));
    
    // Удаляем из основного списка
    trainingData.splice(index, 1);
    
    logAction('Удалён в корзину', employee.name, employee.addedBy);
    saveData();
    applyFilters();
    renderSupervisorStatsList();
    alert('Сотрудник перемещён в корзину. Вы можете восстановить его.');
}
    
// Восстановить из корзины
function restoreFromTrash(id) {
    var employee = null;
    var index = -1;
    for (var i = 0; i < trashBin.length; i++) {
        if (trashBin[i].id === id) { employee = trashBin[i]; index = i; break; }
    }
    
    if (!employee) { alert('Сотрудник не найден в корзине'); return; }
    
    // Удаляем дату удаления
    delete employee.deletedAt;
    
    // Возвращаем в основной список
    trainingData.unshift(employee);
    trashBin.splice(index, 1);
    
    localStorage.setItem('trashBin', JSON.stringify(trashBin));
    logAction('Восстановлен из корзины', employee.name, employee.addedBy);
    saveData();
    applyFilters();
    renderSupervisorStatsList();
    alert('Сотрудник восстановлен!');
}

// Показать корзину
function showTrash() {
    if (trashBin.length === 0) {
        alert('Корзина пуста');
        return;
    }
    
    var html = '🗑️ КОРЗИНА\n\n';
    trashBin.forEach(function(emp, i) {
        var date = emp.deletedAt ? new Date(emp.deletedAt).toLocaleString('ru') : '?';
        html += (i+1) + '. ' + emp.name + '\n   Дата удаления: ' + date + '\n\n';
    });
    html += '\nВведите номер для восстановления (или 0 для выхода):';
    
    var num = prompt(html);
    if (num && num > 0 && num <= trashBin.length) {
        restoreFromTrash(trashBin[num-1].id);
    }
}

// Загрузить корзину
function loadTrash() {
    var trash = localStorage.getItem('trashBin');
    if (trash) {
        try { trashBin = JSON.parse(trash); } catch (e) { trashBin = []; }
    }
}

// Очистить корзину
function emptyTrash() {
    if (trashBin.length === 0) {
        alert('Корзина уже пуста');
        return;
    }
    
    if (confirm('🗑️ Очистить корзину? Все сотрудники будут удалены безвозвратно!\n\nКоличество: ' + trashBin.length)) {
        trashBin = [];
        localStorage.setItem('trashBin', JSON.stringify(trashBin));
        alert('Корзина очищена');
    }
}
    
// Сортировка таблицы
function sortTable(column) {
    var headers = document.querySelectorAll('th.sortable');
    headers.forEach(function(h) { h.classList.remove('sort-asc', 'sort-desc'); });
    
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    
    var header = document.querySelector("th[onclick=\"sortTable('" + column + "')\"]");
    if (header) header.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    
    trainingData.sort(function(a, b) {
        var valA = a[column], valB = b[column];
        if (column === 'date') {
            var dA = valA.split('.'), dB = valB.split('.');
            valA = new Date(dA[2], dA[1] - 1, dA[0]);
            valB = new Date(dB[2], dB[1] - 1, dB[0]);
        }
        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    applyFilters();
}

// Применение фильтров
function applyFilters() {
    var filtered = trainingData.slice();
    
    // Фильтр по супервайзеру
    if (currentSupervisor && currentSupervisor !== 'all') {
        filtered = filtered.filter(function(item) { 
            return item.addedBy === currentSupervisor; 
        });
    }
    
    // Поиск
    var searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(function(item) {
            return item.name.toLowerCase().includes(searchTerm) ||
                   item.theme.toLowerCase().includes(searchTerm) ||
                   item.date.toLowerCase().includes(searchTerm) ||
                   item.trainer.toLowerCase().includes(searchTerm);
        });
    }
    
    // Дата от
    var dateFrom = document.getElementById('dateFrom').value;
    if (dateFrom) {
        var fromDate = new Date(dateFrom);
        filtered = filtered.filter(function(item) {
            var d = item.date.split('.');
            return new Date(d[2], d[1] - 1, d[0]) >= fromDate;
        });
    }
    
    // Дата до
    var dateTo = document.getElementById('dateTo').value;
    if (dateTo) {
        var toDate = new Date(dateTo);
        filtered = filtered.filter(function(item) {
            var d = item.date.split('.');
            return new Date(d[2], d[1] - 1, d[0]) <= toDate;
        });
    }
    
    renderTable(filtered);
    updateSidebarStats();
    renderSupervisorStatsList();
}

// Очистить фильтры
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    currentSort = { column: null, direction: 'asc' };
    var sortableHeaders = document.querySelectorAll('th.sortable');
    if (sortableHeaders) sortableHeaders.forEach(function(h) { h.classList.remove('sort-asc', 'sort-desc'); });
    applyFilters();
}

// Экспорт в CSV
function exportToCSV() {
    var filtered = trainingData.slice();
    
    var headers = ['№', 'Ф.И.О', 'Тема обучения', 'Дата', 'Время', 'Обучивший'];
    var rows = filtered.map(function(item) { 
        return [item.id, item.name, item.theme, item.date, item.time, item.trainer]; 
    });
    
    var csvContent = '\uFEFF';
    csvContent += headers.join(';') + '\n';
    rows.forEach(function(row) {
        csvContent += row.map(function(cell) {
            var str = String(cell || '');
            return (str.indexOf(';') !== -1 || str.indexOf('"') !== -1) ? '"' + str.replace(/"/g, '""') + '"' : str;
        }).join(';') + '\n';
    });
    
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'обучение_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
}

// Печать
function printTable() { window.print(); }

// Удалить всех
function deleteAll() {
    if (confirm('⚠️ ВНИМАНИЕ! Вы собираетесь удалить ВСЕХ сотрудников.\n\nДля полного удаления нажмите "ОК".')) {
        localStorage.setItem('emergencyBackup', JSON.stringify(trainingData));
        trainingData = [];
        saveData();
        applyFilters();
        renderSupervisorStatsList();
        alert('⚠️ Все данные удалены.');
    }
}

// Заполнение списка тренеров
function populateTrainerSelect(selectId, selectedTrainer) {
    var select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Выберите сотрудника --</option>';
    trainers.forEach(function(trainer) {
        var option = document.createElement('option');
        option.value = trainer;
        option.textContent = trainer;
        if (trainer === selectedTrainer) option.selected = true;
        select.appendChild(option);
    });
}

// Заполнение списка "Кто добавил"
function populateAddedBySelect(selectId, selectedValue) {
    var select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Выберите --</option>';
    
    // Добавляем админа
    var adminOption = document.createElement('option');
    adminOption.value = 'admin';
    adminOption.textContent = '👑 Админ';
    if (selectedValue === 'admin') adminOption.selected = true;
    select.appendChild(adminOption);
    
    // Добавляем супервайзеров
    supervisors.forEach(function(supervisor) {
        var option = document.createElement('option');
        option.value = supervisor.id;
        option.textContent = supervisor.name;
        if (supervisor.id === selectedValue) option.selected = true;
        select.appendChild(option);
    });
}

// Сохранение данных
function saveData() {
    if (trainingData && trainingData.length >= 0) {
        // Всегда создаём резервную копию
        localStorage.setItem('emergencyBackup', JSON.stringify(trainingData));
        
        // История бэкапов (последние 5)
        var backups = JSON.parse(localStorage.getItem('backupHistory') || '[]');
        var today = new Date().toLocaleDateString('ru');
        if (backups.length === 0 || backups[0].date !== today) {
            backups.unshift({ date: today, data: JSON.stringify(trainingData) });
            if (backups.length > 5) backups = backups.slice(0, 5);
            localStorage.setItem('backupHistory', JSON.stringify(backups));
        }
        
        localStorage.setItem('trainingData', JSON.stringify(trainingData));
        localStorage.setItem('trainers', JSON.stringify(trainers));
        
        if (useFirebase) {
            try {
                saveDataToFirebase(trainingData);
                saveTrainersToFirebase(trainers);
            } catch (e) { 
                console.error('Firebase save error:', e); 
            }
        }
    }
}

// Рендер таблицы
function renderTable(data) {
    var tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-results">Ничего не найдено</td></tr>';
        return;
    }
    
    var html = '';
    data.forEach(function(item) {
        var canEditThis = canEdit(item);
        
        // Определяем статус подписи
        var signedHtml = '';
        if (item.signed && item.signedAt) {
            if (item.signatureImage) {
                // Показываем изображение подписи
                signedHtml = '<img src="' + item.signatureImage + '" class="signature-preview" title="Подписано: ' + escapeHtml(item.signedAt) + '" onclick="viewSignature(\'' + item.id + '\')">';
            } else {
                signedHtml = '<span class="signed-badge" title="Подписано: ' + escapeHtml(item.signedAt) + '">✅ Подписано</span>';
            }
        } else {
            signedHtml = '<button class="sign-btn" onclick="openSignModal(' + item.id + ')" title="Подписать">✍️ Подписать</button>';
        }
        
        html += '<tr>';
        html += '<td class="row-number">' + item.id + '</td>';
        html += '<td><strong>' + escapeHtml(item.name) + '</strong></td>';
        html += '<td><button class="theme-btn" onclick="showThemeInfo(' + item.id + ')" title="Посмотреть тему обучения">📖 ' + escapeHtml(item.theme) + '</button></td>';
        html += '<td class="date-cell">' + escapeHtml(item.date) + '</td>';
        html += '<td class="time-cell">' + escapeHtml(item.time) + '</td>';
        html += '<td class="signature-cell">' + signedHtml + '</td>';
        html += '<td><span class="trainer-badge">' + escapeHtml(item.trainer) + '</span></td>';
        html += '<td class="actions-cell">';
        
        if (canEditThis) {
            html += '<button class="edit-btn" onclick="openEditModal(' + item.id + ')">✏️</button>';
            html += '<button class="delete-btn" onclick="deleteEmployee(' + item.id + ')">🗑️</button>';
        } else {
            html += '<span style="color:#999;font-size:0.8rem" title="Только админ может редактировать">🔒</span>';
        }
        
        html += '</td></tr>';
    });
    tbody.innerHTML = html;
}

// Восстановить удалённые данные
function recoverDeletedData() {
    var emergency = localStorage.getItem('emergencyBackup');
    if (emergency) {
        try {
            var recovered = JSON.parse(emergency);
            if (recovered && recovered.length > 0) {
                trainingData = recovered;
                saveData();
                applyFilters();
                renderSupervisorStatsList();
                alert('Данные восстановлены! (' + recovered.length + ' сотрудников)');
                return true;
            }
        } catch (e) { console.error('Ошибка:', e); }
    }
    alert('Резервная копия не найдена.');
    return false;
}
    
// Восстановить из Firebase
function recoverFromFirebase() {
    if (useFirebase) {
        loadDataFromFirebase(function(fbData) {
            if (fbData && fbData.length > 0) {
                trainingData = fbData;
                saveData();
                applyFilters();
                renderSupervisorStatsList();
                alert('Данные восстановлены из Firebase! (' + fbData.length + ' сотрудников)');
            } else {
                alert('Данные в Firebase не найдены.');
            }
        });
    } else {
        alert('Firebase недоступен.');
    }
}

// Проверка Firebase
function initFirebaseCheck() {
    if (typeof firebase === 'undefined') return false;
    if (typeof initFirebase === 'function') {
        return initFirebase();
    }
    return false;
}

// ==================== ПЕРЕКЛЮЧЕНИЕ ТЕМЫ ====================
function toggleTheme() {
    var html = document.documentElement;
    var themeToggle = document.getElementById('themeToggle');
    var themeIcon = document.getElementById('themeIcon');
    
    // Проверяем текущую тему
    var currentTheme = html.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        // Переключаем на светлую тему
        html.setAttribute('data-theme', 'light');
        localStorage.setItem('appTheme', 'light');
        if (themeIcon) themeIcon.textContent = '🌙';
    } else {
        // Переключаем на тёмную тему
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('appTheme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
    }
}

// Загрузка сохранённой темы
function loadTheme() {
    var savedTheme = localStorage.getItem('appTheme');
    var themeIcon = document.getElementById('themeIcon');
    
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        // По умолчанию светлая тема
        document.documentElement.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

// Делаем функцию глобальной
window.toggleTheme = toggleTheme;
window.loadTheme = loadTheme;

// Инициализация приложения
async function initializeApp() {
    // Загружаем корзину
    loadTrash();
    
    // Загружаем историю действий
    loadActionHistory();
    
    // Загружаем из localStorage
    var localData = localStorage.getItem('trainingData');
    var localTrainers = localStorage.getItem('trainers');
    
    if (localData) {
        try { trainingData = JSON.parse(localData); } catch (e) {}
    }
    if (localTrainers) {
        try { trainers = JSON.parse(localTrainers); } catch (e) {}
    }
    
    if (trainingData.length === 0) {
        trainingData = getDefaultData();
    }
    
    // Всегда обновляем список тренеров, добавляя новых из defaultTrainers
    if (trainers.length === 0) {
        trainers = defaultTrainers.slice();
    } else {
        // Добавляем недостающих тренеров из defaultTrainers
        defaultTrainers.forEach(function(trainer) {
            if (trainers.indexOf(trainer) === -1) {
                trainers.push(trainer);
            }
        });
    }
            
    // Показываем данные
    populateTrainerSelect('trainerSelect');
    renderTable(trainingData);
    renderSupervisorStatsList();
    updateAdminPanel();
    updateCurrentUserDisplay();
    
    // Инициализируем Firebase
    var firebaseInit = initFirebaseCheck();
    if (firebaseInit) {
        useFirebase = true;
        
        setTimeout(function() {
            loadDataFromFirebase(function(fbData) {
                if (fbData && fbData.length > 0) {
                    if (JSON.stringify(fbData) !== JSON.stringify(trainingData)) {
                        trainingData = fbData;
                        localStorage.setItem('trainingData', JSON.stringify(trainingData));
                        applyFilters();
                        renderSupervisorStatsList();
                    }
                }
            });
        }, 500);
    }
    
    // Автообновление из Firebase
    if (useFirebase) {
        setInterval(function() {
            loadDataFromFirebase(function(fbData) {
                if (fbData && fbData.length > 0) {
                    if (JSON.stringify(fbData) !== JSON.stringify(trainingData)) {
                        trainingData = fbData;
                        localStorage.setItem('trainingData', JSON.stringify(trainingData));
                        applyFilters();
                        renderSupervisorStatsList();
                    }
                }
            });
        }, 5000);
    }
}

// Обработчики событий
document.addEventListener('DOMContentLoaded', function() {
    // Проверка входа
    loadTheme();

    if (!checkLogin()) {
        showLogin();
    }
    
    // Обработка формы входа
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var username = document.getElementById('loginUsername').value.trim();
            var password = document.getElementById('loginPassword').value;
            var errorEl = document.getElementById('loginError');
            
            // Используем серверную аутентификацию
            serverLogin(username, password).then(function(result) {
                if (result.success) {
                    hideLogin();
                    
                    // Инициализируем Firebase
                    var firebaseInit = initFirebaseCheck();
                    if (firebaseInit) {
                        useFirebase = true;
                        // Загружаем данные из Firebase
                        loadDataFromFirebase(function(fbData) {
                            if (fbData && fbData.length > 0) {
                                trainingData = fbData;
                            }
                            // Загружаем тренеров из Firebase
                            loadTrainersFromFirebase(function(fbTrainers) {
                                if (fbTrainers && Array.isArray(fbTrainers)) {
                                    trainers = fbTrainers;
                                }
                                // Объединяем с дефолтными тренерами
                                defaultTrainers.forEach(function(t) {
                                    if (trainers.indexOf(t) === -1) trainers.push(t);
                                });
                                
                                populateTrainerSelect('trainerSelect');
                                applyUserRole(currentUser);
                                applyFilters();
                                updateSidebarStats();
                                renderSupervisorStatsList();
                            });
                        });
                    } else {
                        // Если Firebase не работает - грузим из localStorage
                        var localData = localStorage.getItem('trainingData');
                        var localTrainers = localStorage.getItem('trainers');
                        
                        if (localData) {
                            try { trainingData = JSON.parse(localData); } catch (e) {}
                        }
                        if (localTrainers) {
                            try { 
                                trainers = JSON.parse(localTrainers);
                                defaultTrainers.forEach(function(t) {
                                    if (trainers.indexOf(t) === -1) trainers.push(t);
                                });
                            } catch (e) {}
                        }
                        
                        populateTrainerSelect('trainerSelect');
                        applyUserRole(currentUser);
                        applyFilters();
                        updateSidebarStats();
                        renderSupervisorStatsList();
                    }
                } else {
                    errorEl.textContent = result.message;
                    errorEl.classList.add('show');
                }
            });
        });
    }
    
    // Поиск
    var searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    
    // Закрытие модальных окон
    var modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) modalOverlay.addEventListener('click', function(e) { 
        if (e.target === modalOverlay) closeModal(); 
    });
    
    var editModalOverlay = document.getElementById('editModalOverlay');
    if (editModalOverlay) editModalOverlay.addEventListener('click', function(e) { 
        if (e.target === editModalOverlay) closeEditModal(); 
    });
    
    // Закрытие модального окна подписи
    var signModal = document.getElementById('signModal');
    if (signModal) signModal.addEventListener('click', function(e) { 
        if (e.target === signModal) closeSignModal(); 
    });
    
    // Закрытие модального окна темы
    var themeModal = document.getElementById('themeModal');
    if (themeModal) themeModal.addEventListener('click', function(e) { 
        if (e.target === themeModal) closeThemeModal(); 
    });
    
    // Форма добавления
    var addForm = document.getElementById('addForm');
    if (addForm) {
        addForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            var name = document.getElementById('employeeName').value.trim();
            var theme = document.getElementById('trainingTheme').value.trim();
            var dateInput = document.getElementById('trainingDate').value;
            var time = document.getElementById('trainingTime').value;
            var trainer = document.getElementById('trainerSelect').value;
            
            var dateParts = dateInput.split('-');
            var formattedDate = dateParts[2] + '.' + dateParts[1] + '.' + dateParts[0];
            
            var newId = trainingData.length > 0 ? Math.max.apply(null, trainingData.map(function(item) { return item.id; })) + 1 : 1;
            
            trainingData.unshift({
                id: newId, name: name, theme: theme, date: formattedDate, time: time, trainer: trainer
            });
            
            logAction('Добавлен', name, 'admin');
            
            if (trainers.indexOf(trainer) === -1) {
                trainers.push(trainer);
                populateTrainerSelect('trainerSelect');
            }
            
            saveData();
            applyFilters();
            renderSupervisorStatsList();
            closeModal();
            alert('Сотрудник добавлен!');
        });
    }
    
    // Форма редактирования
    var editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            var id = parseInt(document.getElementById('editEmployeeId').value);
            var name = document.getElementById('editEmployeeName').value.trim();
            var theme = document.getElementById('editTrainingTheme').value.trim();
            var dateInput = document.getElementById('editTrainingDate').value;
            var time = document.getElementById('editTrainingTime').value;
            var trainer = document.getElementById('editTrainerSelect').value;
            
            var dateParts = dateInput.split('-');
            var formattedDate = dateParts[2] + '.' + dateParts[1] + '.' + dateParts[0];
            
            var index = -1;
            for (var i = 0; i < trainingData.length; i++) {
                if (trainingData[i].id === id) { index = i; break; }
            }
            
            if (index !== -1) {
                var oldName = trainingData[index].name;
                trainingData[index] = { id: id, name: name, theme: theme, date: formattedDate, time: time, trainer: trainer };
                
                if (oldName !== name) {
                    logAction('Изменён', oldName + ' → ' + name, 'admin');
                }
                
                if (trainers.indexOf(trainer) === -1) {
                    trainers.push(trainer);
                    populateTrainerSelect('trainerSelect');
                }
                
                saveData();
                applyFilters();
                renderSupervisorStatsList();
            }
            
            closeEditModal();
            alert('Данные обновлены!');
        });
    }
    
    // adminLoginForm уже обрабатывается в serverLogin
});

// Запуск после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем сохранённую тему
    loadTheme();

    // Проверяем, вошёл ли пользователь ранее
    if (checkLogin()) {
        // Пользователь уже вошёл - показываем интерфейс
        initializeApp();
    } else {
        // Показываем экран входа
        showLogin();
    }
});

