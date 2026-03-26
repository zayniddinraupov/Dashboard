let role = ""
let employees = []
let globalPhoto = "https://i.ibb.co/cVn0mgx/photo-2024-12-01-12-00-00.jpg"
let db = null

// API настройки (Flask бэкенд)
const API_URL = "http://localhost:5000/api"
let useBackend = true // Включить/выключить использование бэкенда

// Проверить доступность бэкенда
async function checkBackend() {
    try {
        let response = await fetch(API_URL.replace('/api', ''))
        return response.ok
    } catch {
        return false
    }
}

// Async функция для загрузки сотрудников с бэкенда
async function loadEmployeesFromBackend() {
    try {
        let response = await fetch(API_URL + '/employees')
        if (response.ok) {
            let data = await response.json()
            employees = data.map(e => ({
                id: e.id,
                name: e.name,
                phone: e.phone,
                operator: e.operator,
                address: e.address,
                date: e.date,
                birthday: e.birthday,
                status: e.status,
                photo: e.photo,
                gender: e.gender,
                dateRange: e.dateRange
            }))
            console.log("Загружено с бэкенда:", employees.length)
            return true
        }
    } catch (e) {
        console.log("Бэкенд недоступен, используем локальное хранилище")
    }
    return false
}

// Async функция для сохранения сотрудника на бэкенде
async function saveEmployeeToBackend(employee, isNew = false) {
    try {
        let method = isNew ? 'POST' : 'PUT'
        let url = API_URL + '/employees' + (isNew ? '' : '/' + employee.id)

        let response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(employee)
        })
        return response.ok
    } catch (e) {
        console.log("Ошибка сохранения на бэкенд:", e)
        return false
    }
}

// Async функция для удаления сотрудника с бэкенда
async function deleteEmployeeFromBackend(empId) {
    try {
        let response = await fetch(API_URL + '/employees/' + empId, { method: 'DELETE' })
        return response.ok
    } catch (e) {
        console.log("Ошибка удаления с бэкенда:", e)
        return false
    }
}

// Async функция для загрузки чата с бэкенда
async function loadChatFromBackend() {
    try {
        let response = await fetch(API_URL + '/chat')
        if (response.ok) {
            let data = await response.json()
            chatMessages = data.map(m => ({
                id: m.id,
                text: m.text,
                author: m.author,
                time: m.time,
                timestamp: m.timestamp
            }))
            localStorage.setItem("chatMessages", JSON.stringify(chatMessages))
            return true
        }
    } catch (e) {
        console.log("Бэкенд недоступен для чата")
    }
    return false
}

// Async функция для сохранения сообщения на бэкенде
async function saveMessageToBackend(message) {
    try {
        await fetch(API_URL + '/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        })
        return true
    } catch (e) {
        console.log("Ошибка сохранения сообщения:", e)
        return false
    }
}

// Async функция для загрузки credentials с бэкенда
async function loadCredentialsFromBackend() {
    try {
        let response = await fetch(API_URL + '/credentials')
        if (response.ok) {
            let data = await response.json()
            let creds = {}
            data.forEach(c => {
                creds[c.login] = { password: c.password, name: c.employee_name }
            })
            employeeCredentials = creds
            localStorage.setItem("employeeCredentials", JSON.stringify(employeeCredentials))
            return true
        }
    } catch (e) {
        console.log("Бэкенд недоступен для credentials")
    }
    return false
}

// Async функция для сохранения credentials на бэкенде
async function saveCredentialsToBackend(login, data) {
    try {
        await fetch(API_URL + '/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: login, password: data.password, employee_name: data.name })
        })
        return true
    } catch (e) {
        console.log("Ошибка сохранения credentials:", e)
        return false
    }
}

// Async функция для загрузки work types с бэкенда
async function loadWorkTypesFromBackend() {
    try {
        let response = await fetch(API_URL + '/work-types')
        if (response.ok) {
            let data = await response.json()
            data.forEach(w => {
                localStorage.setItem("employeeWorkType_" + w.employee_name, w.work_type)
            })
            return true
        }
    } catch (e) {
        console.log("Бэкенд недоступен для work types")
    }
    return false
}

// Async функция для сохранения work type на бэкенде
async function saveWorkTypeToBackend(empName, workType) {
    try {
        await fetch(API_URL + '/work-types', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_name: empName, work_type: workType })
        })
        return true
    } catch (e) {
        console.log("Ошибка сохранения work type:", e)
        return false
    }
}

// Async функция для полного бэкапа
async function backupToBackend() {
    try {
        let data = {
            employees: employees,
            chat_messages: chatMessages,
            employee_credentials: Object.entries(employeeCredentials).map(([login, d]) => ({
                login: login, password: d.password, employee_name: d.name
            })),
            work_types: Object.keys(localStorage).filter(k => k.startsWith('employeeWorkType_')).map(k => ({
                employee_name: k.replace('employeeWorkType_', ''),
                work_type: localStorage.getItem(k)
            })),
            backup_date: new Date().toISOString()
        }

        let response = await fetch(API_URL + '/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        return response.ok
    } catch (e) {
        console.log("Ошибка бэкапа:", e)
        return false
    }
}

// Async функция для восстановления из бэкенда
async function restoreFromBackend() {
    try {
        let response = await fetch(API_URL + '/backup')
        if (response.ok) {
            let data = await response.json()

            // Восстанавливаем сотрудников
            if (data.employees) {
                employees = data.employees.map(e => ({
                    id: e.id, name: e.name, phone: e.phone, operator: e.operator,
                    address: e.address, date: e.date, birthday: e.birthday,
                    status: e.status, photo: e.photo, gender: e.gender, dateRange: e.dateRange
                }))
            }

            // Восстанавливаем чат
            if (data.chat_messages) {
                chatMessages = data.chat_messages.map(m => ({
                    id: m.id, text: m.text, author: m.author, time: m.time, timestamp: m.timestamp
                }))
                localStorage.setItem("chatMessages", JSON.stringify(chatMessages))
            }

            // Восстанавливаем credentials
            if (data.employee_credentials) {
                let creds = {}
                data.employee_credentials.forEach(c => {
                    creds[c.login] = { password: c.password, name: c.employee_name }
                })
                employeeCredentials = creds
                localStorage.setItem("employeeCredentials", JSON.stringify(employeeCredentials))
            }

            // Восстанавливаем work types
            if (data.work_types) {
                data.work_types.forEach(w => {
                    localStorage.setItem("employeeWorkType_" + w.employee_name, w.work_type)
                })
            }

            console.log("Восстановлено из бэкенда")
            return true
        }
    } catch (e) {
        console.log("Ошибка восстановления:", e)
    }
    return false
}

// Элементы страницы
let login, password, newName, newPhone, loginPage, mainPage, search

// ============= СОТРУДНИКИ (Перерывы) =============
let employeeBreaks = []
let currentEmployee = null
let activeBreak = null
let breakTimer = null

// Логин/пароль для входа сотрудников (admin может добавлять)
let employeeCredentials = JSON.parse(localStorage.getItem("employeeCredentials")) || {
    "zayniddin": { password: "3020", name: "Зайниддин" },
    "Sabina": { password: "3029", name: "Ходжамова Сабина" },
    
}

// Telegram настройки
const TELEGRAM_BOT_TOKEN = "8760355230:AAGo9o-UCk1SFW5hMxIisyrj0w927p41dzQ"
const TELEGRAM_CHAT_ID = "-1003808756110"

function showEmployeeLogin() {
    document.getElementById("loginPage").style.display = "none"
    document.getElementById("employeeLoginPage").style.display = "flex"
}

function showAdminLogin() {
    document.getElementById("employeeLoginPage").style.display = "none"
    document.getElementById("loginPage").style.display = "flex"
}

// Показать кто ещё на перерыве
function showOtherBreaks() {
    let list = document.getElementById("otherBreaksList")
    if (!list) return
    
    let breaks = getActiveBreaks()
    let now = Date.now()
    let active = breaks.filter(b => b.endTime > now && b.name !== currentEmployee?.name)
    
    if (active.length === 0) {
        list.innerHTML = "<p style='color:#666;'>Никого нет на перерыве</p>"
        return
    }
    
    list.innerHTML = active.map(b => {
        let elapsed = Math.floor((now - b.startTimestamp) / 60000)
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f8f9fa;border-radius:8px;margin-bottom:8px;">
                <span>👤 <strong>${b.name}</strong></span>
                <span style="color:#667eea;font-weight:bold;">${b.type} (${elapsed} мин)</span>
            </div>
        `
    }).join("")
}

// Обновлять каждые 10 секунд
setInterval(function() {
    if (currentEmployee && document.getElementById("employeeDashboard") && !document.getElementById("employeeDashboard").classList.contains("hidden")) {
        showOtherBreaks()
    }
}, 10000)
    
function loginEmployee() {
    let login = document.getElementById("empLogin").value.trim()
    let password = document.getElementById("empPassword").value.trim()
    
    if (!login || !password) {
        alert("Введите логин и пароль!")
        return
    }
    
    let empData = employeeCredentials[login]
    if (!empData || empData.password !== password) {
        alert("Неверный логин или пароль!")
        return
    }
    
    currentEmployee = { login: login, name: empData.name }
    loadEmployeeBreaks()
    loadEmployeeActiveBreak()
    
    document.getElementById("employeeLoginPage").style.display = "none"
    document.getElementById("employeeDashboard").classList.remove("hidden")
    document.getElementById("empName").textContent = " | " + empData.name
    updateEmployeeWorkTypeView(empData.name)
    renderShiftInfo()
    showOtherBreaks()
    loadTheme()
    initChatWhenReady()
}

function updateEmployeeWorkTypeView(empName) {
    let workType = getEmployeeWorkType(empName)
    let info = WORK_TYPES[workType] || WORK_TYPES.standard
    let display = document.getElementById("workTypeDisplayText")
    if (display) {
        display.textContent = `${info.name}. Лимит перерыва: ${info.breakMinutes} мин`
    }
}

// Изменить тип рабочего времени может только админ
function changeWorkType() {
    if (role !== "admin" || !currentEmployee || !currentEmployee.name) return
    
    let workType = document.getElementById("workTypeSelect")?.value || "standard"
    setEmployeeWorkType(currentEmployee.name, workType)
    updateEmployeeWorkTypeView(currentEmployee.name)
    
    let info = WORK_TYPES[workType]
    alert(`✅ Тип работы изменён!\n\n⏱ ${info.name}\n\nЛимит перерыва: ${info.breakMinutes} минут`)
}

function logoutEmployee() {
    try {
        // Если есть активный перерыв - завершаем
        if (activeBreak) {
            if (!confirm("У вас активный перерыв! Завершить и выйти?")) {
                return
            }
            endBreak()
        }
        
        currentEmployee = null
        activeBreak = null
        
        // Останавливаем таймеры
        if (breakTimer) {
            clearInterval(breakTimer)
            breakTimer = null
        }
        if (breakLimitChecker) {
            clearInterval(breakLimitChecker)
            breakLimitChecker = null
        }
        
        // Скрываем дашборд сотрудника
        let empDashboard = document.getElementById("employeeDashboard")
        if (empDashboard) empDashboard.classList.add("hidden")
        
        // Показываем страницу входа
        let loginPageEl = document.getElementById("loginPage")
        if (loginPageEl) loginPageEl.style.display = "flex"
        
        // Очищаем поля
        let empLoginEl = document.getElementById("empLogin")
        let empPasswordEl = document.getElementById("empPassword")
        if (empLoginEl) empLoginEl.value = ""
        if (empPasswordEl) empPasswordEl.value = ""
        
        // Сбрасываем видимость перерывов
        let breakCard = document.getElementById("employeeBreakCard")
        let activeBreakEl = document.getElementById("activeBreak")
        if (breakCard) breakCard.style.display = "block"
        if (activeBreakEl) activeBreakEl.style.display = "none"
        
    } catch(e) {
        console.error("Ошибка выхода:", e)
        // Принудительный выход
        location.reload()
    }
}

// ============= ОГРАНИЧЕНИЕ ПЕРЕРЫВОВ =============
// Максимум 3 сотрудника одновременно на перерыве (для обычных)
const MAX_BREAKS = 3

// Получить всех сотрудников на перерыве
function getActiveBreaks() {
    let saved = localStorage.getItem("activeBreaks")
    if (saved) {
        try {
            return JSON.parse(saved)
        } catch (e) {
            return []
        }
    }
    return []
}

// Сохранить список активных перерывов
function saveActiveBreaks(breaks) {
    localStorage.setItem("activeBreaks", JSON.stringify(breaks))
}

// Проверить возможность выхода на перерыв (с учётом смен)
function canStartBreak(breakType) {
    let employeeName = currentEmployee.name
    let employeeShift = getEmployeeShift(employeeName)
    let breaks = getActiveBreaks()
    let now = Date.now()
    
    // Фильтруем только действующие перерывы
    let active = breaks.filter(b => b.endTime > now)
    
    // ПРОВЕРКА СМЕНЫ - если сотрудник в смене
    if (employeeShift) {
        let shiftMembers = getShiftMembers(employeeShift)
        
        // Проверяем кто из смены уже на перерыве
        let shiftOnBreak = active.filter(b => shiftMembers.includes(b.name))
        
        if (shiftOnBreak.length > 0) {
            let person = shiftOnBreak[0]
            let elapsed = Math.floor((now - person.startTimestamp) / 60000)
            return { 
                allowed: false, 
                reason: "shift_wait",
                active: active,
                waitingFor: person.name,
                waitingMinutes: elapsed
            }
        }
    } else {
        // Для обычных сотрудников - лимит 3 человека
        if (active.length >= MAX_BREAKS) {
            return { allowed: false, reason: "limit", active: active }
        }
    }
    
    // Особое правило для обеда
    if (breakType === "Обед") {
        // Для сменных - только 1 на обеде за раз
        if (employeeShift) {
            let lunchOnBreak = active.filter(b => b.type === "Обед" && shiftMembers.includes(b.name))
            if (lunchOnBreak.length > 0) {
                return { allowed: false, reason: "lunch_shift", active: active, waitingFor: lunchOnBreak[0].name }
            }
        } else {
            // Обычные - лимит 3
            let lunchCount = active.filter(b => b.type === "Обед").length
            if (lunchCount >= MAX_BREAKS) {
                return { allowed: false, reason: "lunch_full", active: active }
            }
        }
    }
    
    // Если обычный сотрудник хочет перерыв, но полная смена на обеде - запрещено
    let lunchOnBreak = active.filter(b => b.type === "Обед")
    if (!employeeShift && lunchOnBreak.length >= MAX_BREAKS) {
        let lunchPeople = lunchOnBreak.map(b => b.name)
        return { allowed: false, reason: "lunch_blocked", active: active, lunchPeople: lunchPeople }
    }
    
    return { allowed: true, active: active }
}

// Показать сообщение о причине отказа
function showBreakDeniedMessage(checkResult, breakType) {
    let message = ""
    
    if (checkResult.reason === "shift_wait") {
        message = `⏳ ЖДИТЕ СВОЮ ОЧЕРЕДЬ!\n\n${checkResult.waitingFor} уже на перерыве.\n\nПодождите, пока он(а) вернётся!\n\n⏱ На перерыве: ${checkResult.waitingMinutes} мин`
    } else if (checkResult.reason === "lunch_shift") {
        message = `⏳ ${checkResult.waitingFor} сейчас на обеде.\n\nДождитесь, пока он(а) закончит обед!`
    } else if (checkResult.reason === "limit") {
        let names = checkResult.active.map(b => b.name).join(", ")
        message = `⚠️ НАРУШЕН ЛИМИТ!\n\nСейчас на перерыве: ${names}\n\nМаксимум ${MAX_BREAKS} человека одновременно.\n\nДождитесь, пока кто-то вернётся!`
    } else if (checkResult.reason === "lunch_full") {
        let names = checkResult.active.map(b => b.name).join(", ")
        message = `⚠️ ВСЕ НА ОБЕДЕ!\n\nСейчас обедают: ${names}\n\nДождитесь, пока кто-то закончит обед!`
    } else if (checkResult.reason === "lunch_blocked") {
        let names = checkResult.lunchPeople ? checkResult.lunchPeople.join(", ") : checkResult.active.filter(b => b.type === "Обед").map(b => b.name).join(", ")
        message = `⚠️ НЕЛЬЗЯ ВЫЙТИ!\n\nСейчас на обеде: ${names}\n\nПока они не закончат обед, никто не может выйти на перерыв!\n\nПодождите, пожалуйста!`
    }
    
    alert(message)
}

function startBreak(breakType, minutes) {
    // Используем имя текущего сотрудника
    let employeeName = currentEmployee.name
    
    if (!employeeName) {
        alert("Ошибка: сотрудник не определён!")
        return
    }
    
    // Проверяем лимит перерывов
    let checkResult = canStartBreak(breakType)
    if (!checkResult.allowed) {
        showBreakDeniedMessage(checkResult, breakType)
        return
    }
    
    let now = new Date()
    let endTime = now.getTime() + (minutes * 60 * 1000)
    
    let newBreak = {
        name: employeeName,
        type: breakType,
        duration: minutes,
        startTime: now.toLocaleString("ru-RU"),
        startTimestamp: now.getTime(),
        endTime: endTime
    }
    
    // Добавляем в список активных перерывов
    let breaks = getActiveBreaks()
    breaks.push(newBreak)
    saveActiveBreaks(breaks)
    
    // Устанавливаем как текущий активный перерыв
    activeBreak = newBreak
    
    // Сохраняем активный перерыв
    saveActiveBreak()
    
    // Показываем таймер
    document.getElementById("employeeBreakCard").style.display = "none"
    document.getElementById("activeBreak").style.display = "block"
    document.getElementById("breakTypeDisplay").textContent = breakType + " (взято: " + minutes + " мин)"
    
    // Запускаем таймер
    startTimer()
    
    // Отправляем уведомление о начале перерыва
    sendTelegramNotification(employeeName, breakType, minutes, "начало")
    
    alert("✅ Перерыв начался! Таймер запущен.")
}

function startTimer() {
    updateTimerDisplay()
    breakTimer = setInterval(updateTimerDisplay, 1000)
    // Проверка превышения лимита каждые 30 секунд
    checkBreakLimit()
    breakLimitChecker = setInterval(checkBreakLimit, 30000)
}

let breakLimitChecker = null

// Проверка лимита перерыва и отправка уведомления
function checkBreakLimit() {
    if (!activeBreak) return
    
    let now = new Date().getTime()
    let elapsed = now - activeBreak.startTimestamp
    let elapsedMinutes = Math.floor(elapsed / 60000)
    let limit = getEmployeeBreakLimit(activeBreak.name)
    
    // Если превысили лимит на 5 минут - отправляем уведомление
    if (elapsedMinutes > limit && elapsedMinutes <= limit + 5) {
        // Проверяем, не отправляли ли уже
        let notifiedKey = "breakLimitNotified_" + activeBreak.startTimestamp
        if (!localStorage.getItem(notifiedKey)) {
            localStorage.setItem(notifiedKey, "true")
            
            let overtime = elapsedMinutes - limit
            sendTelegramNotification(
                activeBreak.name, 
                activeBreak.type, 
                activeBreak.duration, 
                "Превышение лимита!",
                `⚠️ ВНИМАНИЕ! ${activeBreak.name} превысил время перерыва!\n\n⏱ Лимит: ${limit} мин\n⏱ Фактически: ${elapsedMinutes} мин\n⏱ Превышение: ${overtime} мин`
            )
        }
    }
}

function updateTimerDisplay() {
    if (!activeBreak) return
    
    let now = new Date().getTime()
    let elapsed = now - activeBreak.startTimestamp
    let totalDuration = activeBreak.duration * 60 * 1000
    let remaining = activeBreak.endTime - now
    let limit = getEmployeeBreakLimit(activeBreak.name)
    
    if (remaining <= 0) {
        // Время вышло - можно завершать
        document.getElementById("timerDisplay").textContent = activeBreak.duration + ":00"
        document.getElementById("timerDisplay").style.color = "#e74c3c"
        
        // Показываем предупреждение о превышении
        if (elapsed >= totalDuration) {
            let overtime = Math.floor((elapsed - totalDuration) / 60000)
            document.getElementById("breakTypeDisplay").innerHTML = 
                `${activeBreak.type} (взято: ${activeBreak.duration} мин)<br>
                <span style="color:#e74c3c;font-size:14px;">⚠️ Внимание! Превышение на ${overtime} мин</span>`
        }
        return
    }
    
    // Показываем сколько прошло (прямой отсчёт)
    let elapsedMinutes = Math.floor(elapsed / 60000)
    let elapsedSeconds = Math.floor((elapsed % 60000) / 1000)
    
    document.getElementById("timerDisplay").textContent = 
        String(elapsedMinutes).padStart(2, '0') + ":" + String(elapsedSeconds).padStart(2, '0')
    
    // Меняем цвет когда время вышло или предупреждение о лимите
    if (elapsed >= totalDuration) {
        document.getElementById("timerDisplay").style.color = "#e74c3c"
    } else if (elapsedMinutes >= limit - 5) {
        // Предупреждение за 5 минут до лимита
        document.getElementById("timerDisplay").style.color = "#f39c12"
    } else {
        document.getElementById("timerDisplay").style.color = "#667eea"
    }
    
    // Показываем сколько осталось до лимита
    let limitRemaining = limit - elapsedMinutes
    if (limitRemaining > 0 && limitRemaining <= 5) {
        document.getElementById("breakTypeDisplay").innerHTML = 
            `${activeBreak.type} (взято: ${activeBreak.duration} мин)<br>
            <span style="color:#f39c12;font-size:14px;">⏰ До лимита осталось: ${limitRemaining} мин</span>`
    }
}

function endBreak() {
    if (!activeBreak) return
    
    let now = new Date()
    let employeeName = activeBreak.name
    let breakType = activeBreak.type
    let breakDuration = activeBreak.duration
    let limit = getEmployeeBreakLimit(employeeName)
    
    // Вычисляем фактическое время
    let elapsed = now.getTime() - activeBreak.startTimestamp
    let actualMinutes = Math.floor(elapsed / 60000)
    let overtime = actualMinutes > limit ? actualMinutes - limit : 0
    
    let breakData = {
        name: employeeName,
        type: breakType,
        plannedDuration: breakDuration,  // Запланированное время
        actualMinutes: actualMinutes,    // Фактическое время
        limit: limit,
        overtime: overtime,
        startTime: activeBreak.startTime,
        endTime: now.toLocaleString("ru-RU")
    }
    
    // Останавливаем таймер
    if (breakTimer) {
        clearInterval(breakTimer)
        breakTimer = null
    }
    
    // Останавливаем проверку лимита
    if (breakLimitChecker) {
        clearInterval(breakLimitChecker)
        breakLimitChecker = null
    }
    
    // Удаляем из списка активных перерывов
    let breaks = getActiveBreaks()
    breaks = breaks.filter(b => b.name !== employeeName || b.type !== breakType || b.startTimestamp !== activeBreak.startTimestamp)
    saveActiveBreaks(breaks)
    
    // Сохраняем перерыв в историю
    employeeBreaks.push(breakData)
    saveEmployeeBreaks()
    
    // Удаляем активный перерыв из storage (для конкретного сотрудника)
    if (employeeName) {
        localStorage.removeItem("activeBreak_" + employeeName)
    }
    
    // Формируем сообщение
    let message = ""
    if (overtime > 0) {
        message = `⚠️ ПРЕВЫШЕНИЕ ВРЕМЕНИ!\n\n⏱ Лимит: ${limit} мин\n⏱ Фактически: ${actualMinutes} мин\n⏱ Превышение: ${overtime} мин`
    }
    
    // Отправляем уведомление о завершении с фактическим временем
    sendTelegramNotification(employeeName, breakType, actualMinutes, "конец", message)
    
    // Сбрасываем интерфейс
    activeBreak = null
    document.getElementById("activeBreak").style.display = "none"
    document.getElementById("employeeBreakCard").style.display = "block"
    document.getElementById("timerDisplay").style.color = "#667eea"
    
    // Обновляем историю
    renderBreakHistory()
    
    let alertMsg = "✅ Перерыв завершён!"
    if (overtime > 0) {
        alertMsg += `\n\n⚠️ Внимание! Превышен лимит на ${overtime} мин`
    }
    alert(alertMsg)
}
    
// Изменить перерыв (завершить текущий и начать новый)
function changeBreak() {
    if (!activeBreak) return
    
    let confirmChange = confirm("Вы хотите изменить перерыв? Текущий будет завершён.")
    if (!confirmChange) return
    
    let employeeName = activeBreak.name
    let breakType = activeBreak.type
    
    // Завершаем текущий перерыв (без сохранения в историю - сотрудник может передумать)
    if (breakTimer) {
        clearInterval(breakTimer)
        breakTimer = null
    }
    
    // Удаляем из списка активных перерывов
    let breaks = getActiveBreaks()
    breaks = breaks.filter(b => b.name !== employeeName || b.type !== breakType || b.startTimestamp !== activeBreak.startTimestamp)
    saveActiveBreaks(breaks)
    
    // Удаляем активный перерыв (для конкретного сотрудника)
    if (employeeName) {
        localStorage.removeItem("activeBreak_" + employeeName)
    }
    activeBreak = null
    
    // Сбрасываем интерфейс
    document.getElementById("activeBreak").style.display = "none"
    document.getElementById("employeeBreakCard").style.display = "block"
    document.getElementById("timerDisplay").style.color = "#667eea"
}

function sendTelegramNotification(employeeName, breakType, minutes, moment, extraMessage = "") {
    let emoji = moment === "начало" ? "🔔" : "✅"
    let text = moment === "начало" ? "ВЗЯЛ" : moment === "Превышение лимита!" ? "⚠️ ПРЕВЫШЕНИЕ!" : "ЗАВЕРШИЛ"
    
    let workType = getEmployeeWorkType(employeeName)
    let limit = WORK_TYPES[workType]?.breakMinutes || 105
    
    // Показываем фактическое время или запланированное
    let timeText = moment === "начало" ? `⏱ Планировал: ${minutes} минут` : `⏱ Фактически: ${minutes} минут`
    
    let message = `${emoji} *Перерыв ${text}*\n\n` +
        `👤 Сотрудник: ${employeeName}\n` +
        `🍽 Тип: ${breakType}\n` +
        `${timeText}\n` +
        `📏 Лимит: ${limit} мин\n` +
        `🕐 Время: ${new Date().toLocaleString("ru-RU")}`
    
    if (extraMessage) {
        message += `\n\n${extraMessage}`
    }
    
    let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?` +
        `chat_id=${TELEGRAM_CHAT_ID}&` +
        `text=${encodeURIComponent(message)}&` +
        `parse_mode=Markdown`
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                console.log("✅ Уведомление отправлено в Telegram")
            } else {
                console.log("❌ Ошибка Telegram:", data.description)
            }
        })
        .catch(err => {
            console.log("❌ Ошибка отправки:", err.message)
        })
}

// Отправить итоговый отчёт за день
function sendDailyReport() {
    if (employeeBreaks.length === 0) {
        alert("Нет данных о перерывах за сегодня")
        return
    }
    
    // Фильтруем за сегодня
    let today = new Date().toLocaleDateString("ru-RU")
    let todayBreaks = employeeBreaks.filter(b => b.endTime && b.endTime.includes(today))
    
    if (todayBreaks.length === 0) {
        alert("Нет перерывов за сегодня")
        return
    }
    
    let totalBreakTime = todayBreaks.reduce((sum, b) => sum + (b.actualMinutes || b.plannedDuration || b.duration || 0), 0)
    let limit = getEmployeeBreakLimit(currentEmployee.name)
    let workHours = WORK_TYPES[getEmployeeWorkType(currentEmployee.name)]?.workHours || 9
    
    let message = `📊 *ИТОГ РАБОЧЕГО ДНЯ*\n\n` +
        `👤 Сотрудник: ${currentEmployee.name}\n` +
        `📅 Дата: ${today}\n` +
        `⏱ Рабочее время: ${workHours} ч\n` +
        `📊 Перерывов: ${todayBreaks.length}\n` +
        `⏰ Общее время перерывов: ${totalBreakTime} мин\n` +
        `📏 Норма перерыва: ${limit} мин\n`
    
    if (totalBreakTime > limit) {
        message += `\n⚠️ ПРЕВЫШЕНИЕ: +${totalBreakTime - limit} мин`
    } else {
        message += `\n✅ В норме: ${limit - totalBreakTime} мин в запасе`
    }
    
    let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?` +
        `chat_id=${TELEGRAM_CHAT_ID}&` +
        `text=${encodeURIComponent(message)}&` +
        `parse_mode=Markdown`
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                alert("✅ Отчёт отправлен в Telegram!")
            }
        })
        .catch(err => alert("Ошибка отправки: " + err.message))
}

function saveEmployeeBreaks() {
    // Загружаем все перерывы
    let saved = localStorage.getItem("employeeBreaks")
    let allBreaks = []
    if (saved) {
        try {
            allBreaks = JSON.parse(saved)
        } catch (e) {
            allBreaks = []
        }
    }
    
    // Удаляем старые перерывы текущего сотрудника
    if (currentEmployee && currentEmployee.name) {
        allBreaks = allBreaks.filter(b => b.name !== currentEmployee.name)
    }
    
    // Добавляем перерывы текущего сотрудника
    allBreaks = allBreaks.concat(employeeBreaks)
    
    localStorage.setItem("employeeBreaks", JSON.stringify(allBreaks))
}

// Сохранить активный перерыв (для конкретного сотрудника)
function saveActiveBreak() {
    if (activeBreak && currentEmployee && currentEmployee.name) {
        // Сохраняем с уникальным ключём для каждого сотрудника
        let key = "activeBreak_" + currentEmployee.name
        localStorage.setItem(key, JSON.stringify(activeBreak))
    }
}

// Загрузить активный перерыв (для конкретного сотрудника)
function loadEmployeeActiveBreak() {
    if (!currentEmployee || !currentEmployee.name) {
        document.getElementById("employeeBreakCard").style.display = "block"
        document.getElementById("activeBreak").style.display = "none"
        return
    }
    
    let key = "activeBreak_" + currentEmployee.name
    let saved = localStorage.getItem(key)
    
    if (!saved) {
        // Нет активного перерыва - показываем кнопки
        document.getElementById("employeeBreakCard").style.display = "block"
        document.getElementById("activeBreak").style.display = "none"
        return
    }
    
    try {
        let breakData = JSON.parse(saved)
        let now = new Date().getTime()
        
        // Если перерыв ещё не истёк - восстанавливаем
        if (breakData.endTime > now) {
            activeBreak = breakData
            document.getElementById("employeeBreakCard").style.display = "none"
            document.getElementById("activeBreak").style.display = "block"
            document.getElementById("breakTypeDisplay").textContent = activeBreak.type + " (взято: " + activeBreak.duration + " мин)"
            startTimer()
        } else {
            // Перерыв истёк - удаляем
            localStorage.removeItem(key)
            document.getElementById("employeeBreakCard").style.display = "block"
            document.getElementById("activeBreak").style.display = "none"
        }
    } catch (e) {
        localStorage.removeItem(key)
        document.getElementById("employeeBreakCard").style.display = "block"
        document.getElementById("activeBreak").style.display = "none"
    }
}

function loadEmployeeBreaks() {
    // Если сотрудник не вошёл, очищаем историю
    if (!currentEmployee || !currentEmployee.name) {
        employeeBreaks = []
        renderBreakHistory()
        return
    }

    let saved = localStorage.getItem("employeeBreaks")
    if (saved) {
        try {
            let allBreaks = JSON.parse(saved)
            // Фильтруем только перерывы текущего сотрудника
            employeeBreaks = allBreaks.filter(b => b.name === currentEmployee.name)
        } catch (e) {
            employeeBreaks = []
        }
    } else {
        employeeBreaks = []
    }
    renderBreakHistory()
}

function renderBreakHistory() {
    let list = document.getElementById("breaksList")
    if (!list || !currentEmployee) return
    
    // Фильтруем перерывы только для текущего сотрудника
    let myBreaks = employeeBreaks.filter(b => b.name === currentEmployee.name)
    
    if (myBreaks.length === 0) {
        list.innerHTML = "<p style='color:#666;text-align:center;'>Пока нет перерывов</p>"
        return
    }
    
    // Показываем последние 10 перерывов (новые сверху)
    let recentBreaks = myBreaks.slice(-10).reverse()
    
    list.innerHTML = recentBreaks.map(b => {
        // Показываем фактическое время, если есть
        let actual = b.actualMinutes || b.plannedDuration || b.duration
        let wasOvertime = b.overtime > 0
        let timeDisplay = wasOvertime ? 
            `<span style="color:#e74c3c;">${actual} мин</span>` : 
            `${actual} мин`
        
        return `
        <div class="break-item">
            <span class="break-type">${getBreakIcon(b.type)} ${b.type} (${timeDisplay})</span>
            <span class="break-time">${b.endTime}</span>
        </div>
    `}).join("")
}

function getBreakIcon(type) {
    let icons = {
        "Обед": "🍽",
        "Короткий перерыв": "☕",
        "Перекур": "🚬",
        "Личные дела": "👤"
    }
    return icons[type] || "⏰"
}

// Управление логинами/паролями сотрудников
function manageEmployeeCreds() {
    if (role !== "admin") { alert("Нет доступа"); return }
    
    let currentCreds = employeeCredentials
    let list = Object.entries(currentCreds).map(([login, data]) =>
        `${login}: ${data.password} (${data.name})`
    ).join("\n")
    
    let newCreds = prompt(`Сотрудники (логин:пароль:имя):\n\n${list}\n\nВведите логин, пароль и имя через двоеточие (например: user1:123:Имя):`)
    
    if (!newCreds) return

    let parts = newCreds.split(":")
    if (parts.length < 3) {
        alert("Неверный формат! Нужно: логин:пароль:имя")
        return
    }
    
    let login = parts[0].trim()
    let password = parts[1].trim()
    let name = parts.slice(2).join(":").trim()

    if (!login || !password || !name) {
        alert("Все поля обязательны!")
        return
    }
    
    employeeCredentials[login] = { password, name }
    localStorage.setItem("employeeCredentials", JSON.stringify(employeeCredentials))
    
    // Сохраняем в облако сразу после добавления
    saveToCloud()
    
    alert(`Сотрудник ${name} добавлен!\nТеперь данные синхронизированы с облаком.`)
}

// Тема (день/ночь)
function toggleTheme() {
    document.body.classList.toggle('night')
    let isNight = document.body.classList.contains('night')
    localStorage.setItem('theme', isNight ? 'night' : 'day')
}

// Загрузка темы при старте
function loadTheme() {
    let savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'night') {
        document.body.classList.add('night')
    }
}

// Вызываем при загрузке
loadTheme()

// IndexedDB - более надежное хранилище (50-100MB вместо 5MB)
const DB_NAME = "HR_Database"
const DB_VERSION = 2
const STORE_NAME = "employees"
const ABSENCES_STORE = "absences" // Хранилище для отсутствий

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        
        request.onerror = () => reject("Ошибка открытия БД")
        
        request.onsuccess = (event) => {
            db = event.target.result
            resolve(db)
        }
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: "id" })
            }
            // Создаём хранилище для отсутствий
            if (!database.objectStoreNames.contains(ABSENCES_STORE)) {
                database.createObjectStore(ABSENCES_STORE, { keyPath: "id", autoIncrement: true })
            }
        }
    })
}

// ============= ТИПЫ РАБОТЫ И СМЕНЫ =============

// Типы рабочего времени
const WORK_TYPES = {
    "standard": { name: "9 часов (1ч 45мин перерыв)", workHours: 9, breakMinutes: 105, color: "#27ae60" },
    "long": { name: "12 часов (2ч 20мин перерыв)", workHours: 12, breakMinutes: 140, color: "#e67e22" }
}

// Смены (максимум 4 человека в смене)
let shifts = JSON.parse(localStorage.getItem("shifts")) || {
    "Смена 1": [],
    "Смена 2": [],
    "Смена 3": [],
    "Смена 4": []
}

// Получить тип работы сотрудника
function getEmployeeWorkType(empName) {
    let saved = localStorage.getItem("employeeWorkType_" + empName)
    return saved || "standard"
}

// Установить тип работы сотрудника
function setEmployeeWorkType(empName, workType) {
    localStorage.setItem("employeeWorkType_" + empName, workType)
}

// Получить норму перерыва для сотрудника
function getEmployeeBreakLimit(empName) {
    let workType = getEmployeeWorkType(empName)
    return WORK_TYPES[workType]?.breakMinutes || 105
}

// Добавить сотрудника в смену
function addToShift(empName, shiftName) {
    if (!shifts[shiftName]) {
        alert("Смена не найдена!")
        return
    }
    
    // Проверяем лимит
    if (shifts[shiftName].length >= 4) {
        alert("В смене максимум 4 человека!")
        return
    }
    
    // Проверяем не добавлен ли уже
    if (shifts[shiftName].includes(empName)) {
        alert("Сотрудник уже в этой смене!")
        return
    }

    // Удаляем из других смен
    for (let s in shifts) {
        shifts[s] = shifts[s].filter(e => e !== empName)
    }
    
    shifts[shiftName].push(empName)
    localStorage.setItem("shifts", JSON.stringify(shifts))
    alert(`✅ ${empName} добавлен в ${shiftName}`)
    renderShiftInfo()
}

// Удалить сотрудника из смены
function removeFromShift(empName) {
    for (let s in shifts) {
        shifts[s] = shifts[s].filter(e => e !== empName)
    }
    localStorage.setItem("shifts", JSON.stringify(shifts))
    renderShiftInfo()
}

// Получить смену сотрудника
function getEmployeeShift(empName) {
    for (let s in shifts) {
        if (shifts[s].includes(empName)) return s
    }
    return null
}

// Получить всех в смене
function getShiftMembers(shiftName) {
    return shifts[shiftName] || []
}

// Показать модальное управление сменами
function manageShifts() {
    let modal = document.createElement("div")
    modal.className = "modal-overlay"
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:10000;"
    modal.onclick = function(e) { if (e.target === modal) modal.remove() }
    
    let shiftHtml = Object.entries(shifts).map(([name, members]) => {
        let memberOptions = employees.map(e => 
            `<option value="${e.name}" ${members.includes(e.name) ? "selected" : ""}>${e.name}</option>`
        ).join("")
        
        return `
            <div style="background:white;padding:15px;border-radius:10px;margin-bottom:10px;">
                <h4 style="margin:0 0 10px;color:#667eea;">${name} (${members.length}/4)</h4>
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">
                    ${members.length > 0 ? members.map(m => 
                        `<span style="background:#667eea;color:white;padding:5px 10px;border-radius:20px;font-size:12px;">${m} <span style="cursor:pointer;margin-left:5px;" onclick="removeFromShift('${m}');manageShifts();">✕</span></span>`
                    ).join("") : "<span style='color:#999;'>Нет сотрудников</span>"}
                </div>
                <select onchange="if(this.value){addToShift(this.value,'${name}');this.value='';}" style="padding:8px;border-radius:5px;width:100%;">
                    <option value="">➕ Добавить сотрудника</option>
                    ${employees.filter(e => !Object.values(shifts).flat().includes(e.name)).map(e => 
                        `<option value="${e.name}">${e.name}</option>`
                    ).join("")}
                </select>
            </div>
        `
    }).join("")
    
    modal.innerHTML = `
        <div style="background:white;padding:25px;border-radius:15px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">
            <h3 style="margin:0 0 20px;color:#667eea;">👥 Управление сменами</h3>
            <p style="color:#666;font-size:14px;">В каждой смене максимум 4 человека. Только 1 может выйти на перерыв.</p>
            ${shiftHtml}
            <button onclick="document.body.removeChild(document.querySelector('.modal-overlay'))" style="width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:10px;cursor:pointer;margin-top:15px;">Закрыть</button>
        </div>
    `
    document.body.appendChild(modal)
}

// Отобразить информацию о смене
function renderShiftInfo() {
    let shift = getEmployeeShift(currentEmployee?.name)
    if (!shift) return
    
    let shiftInfo = document.getElementById("shiftInfo")
    if (shiftInfo) {
        let members = getShiftMembers(shift)
        shiftInfo.innerHTML = `
            <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:15px;border-radius:10px;margin-bottom:15px;">
                <div style="font-weight:bold;">${shift}</div>
                <div style="font-size:12px;opacity:0.9;">👥 ${members.length}/4 человек в смене</div>
                <div style="font-size:12px;margin-top:5px;">
                    ${members.map(m => {
                        let isOnBreak = activeBreak && activeBreak.name === m
                        let icon = isOnBreak ? "☕" : "👤"
                        return `<span style="margin-right:8px;">${icon} ${m}</span>`
                    }).join("")}
                </div>
            </div>
        `
    }
}

// ============= ОТСУТСТВИЯ (Больничные, отпуска, отгулы и т.д.) =============
let absences = []

// Типы отсутствий
const ABSENCE_TYPES = {
    "Больничный": { icon: "🏥", color: "#e74c3c" },
    "Отпуск": { icon: "🏖️", color: "#3498db" },
    "Отгул": { icon: "🏠", color: "#9b59b6" },
    "Командировка": { icon: "✈️", color: "#f39c12" },
    "Учёба": { icon: "📚", color: "#1abc9c" },
    "Декрет": { icon: "👶", color: "#e91e63" },
    "Армия": { icon: "🎖️", color: "#607d8b" },
    "Без содержания": { icon: "💰", color: "#795548" },
    "Прочее": { icon: "📋", color: "#9e9e9e" }
}

// Загрузить все отсутствия из IndexedDB
function loadAbsencesFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ABSENCES_STORE], "readonly")
        const store = transaction.objectStore(ABSENCES_STORE)
        const request = store.getAll()
        
        request.onsuccess = () => {
            absences = request.result || []
            resolve(absences)
        }
        request.onerror = () => reject("Ошибка загрузки отсутствий")
    })
}

// Сохранить отсутствие в IndexedDB
function saveAbsenceToDB(absence) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ABSENCES_STORE], "readwrite")
        const store = transaction.objectStore(ABSENCES_STORE)
        
        // Если есть id - обновляем, иначе добавляем
        if (absence.id) {
            store.put(absence)
        } else {
            store.add(absence)
        }
        
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject("Ошибка сохранения отсутствия")
    })
}

// Удалить отсутствие из IndexedDB
function deleteAbsenceFromDB(absenceId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ABSENCES_STORE], "readwrite")
        const store = transaction.objectStore(ABSENCES_STORE)
        store.delete(absenceId)
        
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject("Ошибка удаления отсутствия")
    })
}

// Добавить новое отсутствие
function addAbsence(employeeName, type, dateFrom, dateTo, reason) {
    let absence = {
        employeeName: employeeName,
        type: type,
        dateFrom: dateFrom,
        dateTo: dateTo,
        reason: reason || "",
        createdAt: new Date().toLocaleString("ru-RU"),
        createdBy: role
    }
    
    absences.push(absence)
    
    // Сохраняем в IndexedDB
    saveAbsenceToDB(absence).then(() => {
        console.log("✅ Отсутствие сохранено")
        // Обновляем UI если открыто
        if (document.getElementById("absencesList")) {
            renderAbsences()
            renderAbsencesSummary()
        }
    }).catch(err => console.error("Ошибка сохранения:", err))
    
    return absence
}

// Получить отсутствия конкретного сотрудника
function getAbsencesForEmployee(employeeName) {
    return absences.filter(a => a.employeeName === employeeName)
}

// Удалить отсутствие
function removeAbsence(absenceId) {
    if (!confirm("Удалить это отсутствие?")) return
    
    absences = absences.filter(a => a.id !== absenceId)
    deleteAbsenceFromDB(absenceId).then(() => {
        renderAbsences()
        renderAbsencesSummary()
    })
}

// Показать модальное окно добавления отсутствия
function showAddAbsenceModal(employeeName = "") {
    let modal = document.createElement("div")
    modal.className = "modal-overlay"
    modal.id = "absenceModal"
    modal.innerHTML = `
        <div class="modal-content" style="background:white;padding:30px;border-radius:15px;max-width:450px;width:90%;">
            <h3 style="margin-top:0;color:#667eea;">📋 Добавить отсутствие</h3>
            
            <div style="margin-bottom:15px;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;">Сотрудник:</label>
                <input id="absenceEmployee" value="${employeeName}" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;">
            </div>
            
            <div style="margin-bottom:15px;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;">Тип отсутствия:</label>
                <select id="absenceType" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;">
                    ${Object.entries(ABSENCE_TYPES).map(([key, val]) => 
                        `<option value="${key}">${val.icon} ${key}</option>`
                    ).join("")}
                </select>
            </div>
            
            <div style="display:flex;gap:10px;margin-bottom:15px;">
                <div style="flex:1;">
                    <label style="display:block;margin-bottom:5px;font-weight:bold;">С:</label>
                    <input id="absenceDateFrom" type="date" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;">
                </div>
                <div style="flex:1;">
                    <label style="display:block;margin-bottom:5px;font-weight:bold;">По:</label>
                    <input id="absenceDateTo" type="date" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;">
                </div>
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;">Причина (необязательно):</label>
                <textarea id="absenceReason" placeholder="Комментарий..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;min-height:60px;resize:vertical;"></textarea>
            </div>
            
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button onclick="document.getElementById('absenceModal').remove()" style="padding:10px 20px;border:1px solid #ddd;background:white;border-radius:8px;cursor:pointer;">Отмена</button>
                <button onclick="submitAbsence()" style="padding:10px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;">Добавить</button>
            </div>
        </div>
    `
    document.body.appendChild(modal)
}

// Отправить форму отсутствия
function submitAbsence() {
    let employeeName = document.getElementById("absenceEmployee").value.trim()
    let type = document.getElementById("absenceType").value
    let dateFrom = document.getElementById("absenceDateFrom").value
    let dateTo = document.getElementById("absenceDateTo").value
    let reason = document.getElementById("absenceReason").value.trim()
    
    if (!employeeName) {
        alert("Выберите сотрудника!")
        return
    }
    if (!dateFrom || !dateTo) {
        alert("Выберите даты!")
        return
    }
    if (new Date(dateTo) < new Date(dateFrom)) {
        alert("Дата окончания не может быть раньше даты начала!")
        return
    }
    
    addAbsence(employeeName, type, dateFrom, dateTo, reason)
    
    // Закрываем модалку
    document.getElementById("absenceModal").remove()
    
    alert("✅ Отсутствие добавлено!")
    
    // Если открыт раздел отсутствий - обновляем
    if (document.getElementById("absencesSection") && !document.getElementById("absencesSection").classList.contains("hidden")) {
        renderAbsences()
    }
}

// Показать историю отсутствий всех сотрудников (для админа)
function showAbsencesSection() {
    let section = document.getElementById("absencesSection")
    if (section && !section.classList.contains("hidden")) {
        section.classList.add("hidden")
        return
    }
    
    // Создаём секцию если её нет
    if (!section) {
        let container = document.querySelector("#mainPage .container")
        let absencesSection = document.createElement("div")
        absencesSection.id = "absencesSection"
        absencesSection.className = "hidden"
        absencesSection.innerHTML = `
            <div style="margin:30px 0;">
                <h3 style="color:#667eea;">📋 История отсутствий</h3>
                <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
                    <button onclick="showAddAbsenceModal()" style="background:#27ae60;color:white;border:none;padding:12px 20px;border-radius:10px;cursor:pointer;">➕ Добавить отсутствие</button>
                    <select id="absenceFilter" onchange="renderAbsences()" style="padding:10px;border-radius:8px;border:1px solid #ddd;">
                        <option value="">Все типы</option>
                        ${Object.keys(ABSENCE_TYPES).map(t => `<option value="${t}">${ABSENCE_TYPES[t].icon} ${t}</option>`).join("")}
                    </select>
                    <input id="absenceSearch" placeholder="Поиск сотрудника..." onkeyup="renderAbsences()" style="padding:10px;border-radius:8px;border:1px solid #ddd;">
                </div>
                
                <!-- Сводка по сотрудникам -->
                <div id="absencesSummary" style="margin-bottom:30px;"></div>
                
                <div id="absencesList"></div>
            </div>
        `
        // Вставляем после кнопок управления
        let addBtn = document.getElementById("addBtn")
        if (addBtn && addBtn.nextElementSibling) {
            container.insertBefore(absencesSection, addBtn.nextElementSibling.nextElementSibling)
        } else {
            container.appendChild(absencesSection)
        }
    }
    
    section = document.getElementById("absencesSection")
    section.classList.remove("hidden")
    renderAbsencesSummary()
    renderAbsences()
}

// Сводка по отсутствиям для каждого сотрудника
function renderAbsencesSummary() {
    let container = document.getElementById("absencesSummary")
    if (!container) return
    
    if (absences.length === 0) {
        container.innerHTML = ""
        return
    }
    
    // Группируем по сотрудникам
    let employeeStats = {}
    absences.forEach(a => {
        if (!employeeStats[a.employeeName]) {
            employeeStats[a.employeeName] = {}
        }
        let days = Math.ceil((new Date(a.dateTo) - new Date(a.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
        if (!employeeStats[a.employeeName][a.type]) {
            employeeStats[a.employeeName][a.type] = 0
        }
        employeeStats[a.employeeName][a.type] += days
    })
    
    // Сортируем по общему количеству дней
    let sortedEmployees = Object.entries(employeeStats).sort((a, b) => {
        let totalA = Object.values(a[1]).reduce((s, v) => s + v, 0)
        let totalB = Object.values(b[1]).reduce((s, v) => s + v, 0)
        return totalB - totalA
    })
    
    container.innerHTML = `
        <div style="background:white;padding:20px;border-radius:15px;box-shadow:0 5px 20px rgba(0,0,0,0.1);">
            <h4 style="margin-top:0;color:#667eea;margin-bottom:15px;">📊 Сводка по сотрудникам</h4>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead>
                        <tr style="background:#f8f9fa;">
                            <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">👤 Сотрудник</th>
                            ${Object.keys(ABSENCE_TYPES).map(t => 
                                `<th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;">${ABSENCE_TYPES[t].icon} ${t}</th>`
                            ).join("")}
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #ddd;background:#667eea;color:white;">📈 Всего дней</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedEmployees.map(([name, types]) => {
                            let total = Object.values(types).reduce((s, v) => s + v, 0)
                            return `
                                <tr style="border-bottom:1px solid #eee;">
                                    <td style="padding:12px;font-weight:bold;">${name}</td>
                                    ${Object.keys(ABSENCE_TYPES).map(t => {
                                        let days = types[t] || 0
                                        return `<td style="padding:12px;text-align:center;${days > 0 ? 'background:#f0f8ff;font-weight:bold;' : 'color:#ccc;'}">${days || '-'}</td>`
                                    }).join("")}
                                    <td style="padding:12px;text-align:center;font-weight:bold;color:#667eea;background:#f8f9fa;">${total}</td>
                                </tr>
                            `
                        }).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `
}

// Отобразить список отсутствий
function renderAbsences() {
    let list = document.getElementById("absencesList")
    if (!list) return
    
    let filter = document.getElementById("absenceFilter")?.value || ""
    let search = document.getElementById("absenceSearch")?.value.toLowerCase() || ""
    
    // Фильтруем
    let filtered = absences.filter(a => {
        let matchesType = !filter || a.type === filter
        let matchesSearch = !search || a.employeeName.toLowerCase().includes(search)
        return matchesType && matchesSearch
    })
    
    // Сортируем по дате (новые сверху)
    filtered.sort((a, b) => new Date(b.dateFrom) - new Date(a.dateFrom))
    
    if (filtered.length === 0) {
        list.innerHTML = "<p style='color:#666;text-align:center;padding:30px;'>Нет данных об отсутствиях</p>"
        return
    }
    
    list.innerHTML = filtered.map(a => {
        let typeInfo = ABSENCE_TYPES[a.type] || ABSENCE_TYPES["Прочее"]
        let dates = `${formatDate(a.dateFrom)} - ${formatDate(a.dateTo)}`
        
        // Вычисляем количество дней
        let days = Math.ceil((new Date(a.dateTo) - new Date(a.dateFrom)) / (1000 * 60 * 60 * 24)) + 1
        
        return `
            <div style="background:white;padding:15px;margin-bottom:10px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border-left:4px solid ${typeInfo.color};">
                <div style="display:flex;justify-content:space-between;align-items:start;">
                    <div>
                        <strong style="font-size:16px;">${a.employeeName}</strong>
                        <div style="color:#666;margin-top:5px;">
                            <span style="color:${typeInfo.color};">${typeInfo.icon} ${a.type}</span>
                            <span style="margin-left:15px;">📅 ${dates}</span>
                            <span style="margin-left:15px;">📊 ${days} дн.</span>
                        </div>
                        ${a.reason ? `<div style="margin-top:5px;color:#888;font-size:13px;">💬 ${a.reason}</div>` : ""}
                    </div>
                    ${role === "admin" ? `
                        <button onclick="removeAbsence(${a.id})" style="background:#e74c3c;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:12px;">🗑</button>
                    ` : ""}
                </div>
            </div>
        `
    }).join("")
}

// Формат даты
function formatDate(dateStr) {
    if (!dateStr) return ""
    let d = new Date(dateStr)
    return d.toLocaleDateString("ru-RU")
}

function loadEmployeesFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.getAll()
        
        request.onsuccess = () => {
            employees = request.result || []
            // Сортировка по алфавиту
            employees.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
            resolve(employees)
        }
        request.onerror = () => reject("Ошибка загрузки")
    })
}

function saveEmployeesToDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite")
        const store = transaction.objectStore(STORE_NAME)
        
        // Очищаем и перезаписываем
        store.clear()
        employees.forEach((emp, index) => {
            emp.id = index + 1
            store.add(emp)
        })
        
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject("Ошибка сохранения")
    })
}

// Загрузка при старте
initDB().then(() => {
    loadEmployeesFromDB().then(() => {
        renderEmployees()
    })
    // Загружаем отсутствия
    loadAbsencesFromDB().then(() => {
        console.log("✅ Загружено отсутствий:", absences.length)
    })
}).catch(err => console.error(err))

// Переменные для элементов формы (будут определены при загрузке)
let newOperator, newAddress, newDate, newGender, newStatus, newPhoto

// Автологин при загрузке страницы
window.onload = function() {
    // Определяем переменные после загрузки DOM
    login = document.getElementById("login")
    password = document.getElementById("password")
    newName = document.getElementById("newName")
    newPhone = document.getElementById("newPhone")
    newOperator = document.getElementById("newOperator")
    newAddress = document.getElementById("newAddress")
    newDate = document.getElementById("newDate")
    newGender = document.getElementById("newGender")
    newStatus = document.getElementById("newStatus")
    newPhoto = document.getElementById("newPhoto")
    search = document.getElementById("search")
    loginPage = document.getElementById("loginPage")
    mainPage = document.getElementById("mainPage")
    
    // Обработка Enter для входа
    login.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            password.focus()
        }
    })
    password.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            loginUser()
        }
    })
    
    // Обработка Enter для входа сотрудников
    let empLogin = document.getElementById("empLogin")
    let empPassword = document.getElementById("empPassword")
    if (empLogin && empPassword) {
        empLogin.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                empPassword.focus()
            }
        })
        empPassword.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                loginEmployee()
            }
        })
    }
        
    // Инициализируем IndexedDB и загружаем данные
    initDB().then(() => {
        loadEmployeesFromDB().then(() => {
            renderEmployees()
        })
        
        let savedLogin = localStorage.getItem("savedLogin")
        let savedPassword = localStorage.getItem("savedPassword")
        if (savedLogin && savedPassword) {
            let loginEl = document.getElementById("login")
            let passwordEl = document.getElementById("password")
            if (loginEl && passwordEl) {
                loginEl.value = savedLogin
                passwordEl.value = savedPassword
                loginUser()
            }
        }
    })
}

// Google Таблица настройка (резервный)
// let googleScriptUrl = "https://script.google.com/macros/s/AKfycbwhd1fLT75cHlR5omEO9dNfulFuQO3T10zvEeVrg-_QOizu-98POZo9sLtxXNMkTry7zg/exec"

// JSONBin.io - работает с CORS
let jsonBinApiKey = "$2a$10$djcbr7IRhAv9dzcz.Wjb8OjIZoxkUvtZwmw1Z0TkVLG3821AFviRu"
let jsonBinId = "699e07e3ae596e708f465718"

// Автосинхронизация при каждом изменении
function autoSync() {
    saveToGoogleSheet()
}

// Сохранение в облако (JSONBin.io) - включая отсутствия
function saveToCloud() {
    // Всегда сохраняем локально в localStorage как резервную копию
    let localData = { 
        employees: employees, 
        globalPhoto: globalPhoto,
        absences: absences,
        employeeCredentials: employeeCredentials,
        chatMessages: chatMessages,
        lastSaved: new Date().toISOString()
    }
    localStorage.setItem("hrDataBackup", JSON.stringify(localData))
    console.log("✅ Резервная копия сохранена в localStorage")
    
    if (employees.length === 0 && absences.length === 0 && Object.keys(employeeCredentials).length === 0) return
    
    let data = { 
        employees: employees, 
        globalPhoto: globalPhoto,
        absences: absences,
        employeeCredentials: employeeCredentials,
        chatMessages: chatMessages
    }
    let jsonStr = JSON.stringify(data)
    
    showAutoSaveStatus(true)
    
    // Если JSONBin настроен - используем его
    if (isJsonBinConfigured()) {
        fetch("https://api.jsonbin.io/v3/b/" + jsonBinId, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": jsonBinApiKey
            },
            body: jsonStr
        })
        .then(response => {
            if (!response.ok) throw new Error("HTTP " + response.status)
            console.log("✅ Сохранено в JSONBin (сотрудники + отсутствия)")
        })
        .catch(err => console.log("❌ Ошибка сохранения в JSONBin:", err.message))
    } else {
        // Сохраняем только локально
        console.log("ℹ️ JSONBin не настроен. Данные сохранены локально в браузере.")
    }
}
    
// Загрузка из облака (включая отсутствия)
function loadFromCloud() {
    // Если JSONBin настроен - загружаем
    if (isJsonBinConfigured()) {
        fetch("https://api.jsonbin.io/v3/b/" + jsonBinId + "/latest", {
            method: "GET",
            headers: {
                "X-Master-Key": jsonBinApiKey
            }
        })
        .then(response => {
            if (!response.ok) throw new Error("HTTP " + response.status)
            return response.json()
        })
        .then(data => {
            if (data.record) {
                if (data.record.employees) {
                    employees = data.record.employees
                    saveEmployeesToDB()
                    renderEmployees()
                    console.log("✅ Загружено сотрудников:", employees.length)
                }
                if (data.record.absences) {
                    absences = data.record.absences
                    // Сохраняем в IndexedDB
                    absences.forEach(a => saveAbsenceToDB(a))
                    console.log("✅ Загружено отсутствий:", absences.length)
                }
                // Загружаем логины сотрудников из облака
                if (data.record.employeeCredentials) {
                    employeeCredentials = data.record.employeeCredentials
                    localStorage.setItem("employeeCredentials", JSON.stringify(employeeCredentials))
                    console.log("✅ Загружены логины сотрудников")
                }
                // Загружаем сообщения чата из облака
                if (data.record.chatMessages) {
                    chatMessages = data.record.chatMessages
                    localStorage.setItem("chatMessages", JSON.stringify(chatMessages))
                    renderChatMessages()
                    console.log("✅ Загружены сообщения чата")
                }
                console.log(`Загрузка завершена: ${employees.length} сотрудников, ${absences.length} отсутствий`)
            }
        })
        .catch(err => console.log("❌ Ошибка загрузки из JSONBin:", err.message))
        } else {
            // Пробуем загрузить из localStorage резервную копию
            let backup = localStorage.getItem("hrDataBackup")
            if (backup) {
                try {
                    let data = JSON.parse(backup)
                    if (data.employees) {
                        employees = data.employees
                        saveEmployeesToDB()
                        renderEmployees()
                    }
                    if (data.absences) {
                        absences = data.absences
                    }
                    console.log(`Загружено из резервной копии: ${employees.length} сотрудников`)
                } catch(e) {
                    console.log("Ошибка загрузки резервной копии")
                }
            } else {
                console.log("JSONBin не настроен, используем локальные данные")
            }
        }
}

// Функция проверки настроек JSONBin
function isJsonBinConfigured() {
    return jsonBinApiKey && jsonBinId && 
           jsonBinApiKey.trim() !== "" && 
           jsonBinId.trim() !== "" &&
           jsonBinApiKey !== "YOUR_API_KEY"
}

// Загрузка настроек JSONBin при старте
function loadJsonBinSettings() {
    let savedApiKey = localStorage.getItem("jsonBinApiKey")
    let savedBinId = localStorage.getItem("jsonBinId")
    
    // Если есть сохранённые настройки - используем их
    if (savedApiKey && savedBinId) {
        jsonBinApiKey = savedApiKey
        jsonBinId = savedBinId
    } else {
        // Иначе сохраняем текущие (по умолчанию)
        localStorage.setItem("jsonBinApiKey", jsonBinApiKey)
        localStorage.setItem("jsonBinId", jsonBinId)
    }
    
    console.log("✅ JSONBin настроен: " + jsonBinId)
}

// Вызываем при старте
loadJsonBinSettings()

// Сохранение в Google Таблицу (оставлено для совместимости)
function saveToGoogleSheet() {
    saveToCloud()
}

// Загрузка из Google Таблицы
function loadFromGoogleSheet() {
    loadFromCloud()
}

// Удаление тестовых сотрудников при первом запуске
function clearTestEmployees() {
    if (employees.length > 0 && employees[0].name && employees[0].name.startsWith("Сотрудник ")) {
        employees = []
        saveData()
        alert("Тестовые сотрудники удалены!")
        renderEmployees()
    }
}

function clearAllData() {
    if (!confirm("Вы уверены? Все сотрудники будут удалены!")) return
    
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    store.clear()
    
    employees = []
    renderEmployees()
    alert("Все данные очищены!")
}

// Очистить данные перерывов (для сотрудников)
function clearBreaksData() {
    if (!confirm("Очистить всю историю перерывов? Это действие нельзя отменить.")) return
    
    localStorage.removeItem("employeeBreaks")
    localStorage.removeItem("activeBreak")
    localStorage.removeItem("activeBreaks")
    
    employeeBreaks = []
    activeBreak = null
    
    alert("История перерывов очищена!")
    renderBreakHistory()
}

// Восстановить данные из резервной копии
function restoreFromBackup() {
    let backup = localStorage.getItem("hrDataBackup")
    if (!backup) {
        alert("Нет резервной копии!")
        return
    }
    
    if (!confirm("Восстановить данные из резервной копии? Текущие данные будут заменены.")) return
    
    try {
        let data = JSON.parse(backup)
        
        if (data.employees) {
            employees = data.employees
            saveEmployeesToDB()
            renderEmployees()
        }
        
        if (data.absences) {
            absences = data.absences
            // Пересохраняем в IndexedDB
            absences.forEach(a => {
                if (!a.id) saveAbsenceToDB(a)
            })
        }
        
        if (data.globalPhoto) {
            globalPhoto = data.globalPhoto
            localStorage.setItem("globalPhoto", globalPhoto)
        }
        
        // Восстанавливаем логины сотрудников
        if (data.employeeCredentials) {
            employeeCredentials = data.employeeCredentials
            localStorage.setItem("employeeCredentials", JSON.stringify(employeeCredentials))
        }
        
        // Восстанавливаем сообщения чата
        if (data.chatMessages) {
            chatMessages = data.chatMessages
            localStorage.setItem("chatMessages", JSON.stringify(chatMessages))
        }
        
        alert(`✅ Восстановлено!\n👥 Сотрудников: ${employees.length}\n📋 Отсутствий: ${absences.length}\n🔐 Логинов: ${Object.keys(employeeCredentials).length}\n💬 Сообщений: ${chatMessages.length}\n🕐 Дата backup: ${data.lastSaved ? new Date(data.lastSaved).toLocaleString("ru-RU") : "неизвестно"}`)
    } catch (e) {
        alert("Ошибка восстановления: " + e.message)
    }
}

// Показать информацию о резервной копии
function showBackupInfo() {
    let backup = localStorage.getItem("hrDataBackup")
    if (!backup) {
        alert("Резервная копия не найдена")
        return
    }
    
    try {
        let data = JSON.parse(backup)
        alert(`📦 Информация о резервной копии:\n\n👥 Сотрудников: ${data.employees?.length || 0}\n📋 Отсутствий: ${data.absences?.length || 0}\n🕐 Сохранено: ${data.lastSaved ? new Date(data.lastSaved).toLocaleString("ru-RU") : "неизвестно"}`)
    } catch (e) {
        alert("Ошибка чтения backup")
    }
}

let autoSaveTimeout = null

function showAutoSaveStatus(show) {
    let statusEl = document.getElementById("autoSaveStatus")
    if (statusEl) {
        statusEl.style.display = show ? "inline" : "none"
        if (show) {
            statusEl.textContent = "💾 Сохранение..."
            setTimeout(() => { statusEl.textContent = "✅ Сохранено" }, 1500)
            setTimeout(() => { statusEl.style.display = "none" }, 3000)
        }
    }
}

function saveData() {
    // Сохраняем в IndexedDB (лимит 50-100MB)
    saveEmployeesToDB().then(() => {
        // Также сохраняем глобальное фото в localStorage (оно маленькое)
        localStorage.setItem("globalPhoto", globalPhoto)
        
        // Показываем статус
        showAutoSaveStatus(true)
        
        // Сохраняем в облако СРАЗУ (без задержки) для мгновенной синхронизации
        saveToCloud()
        console.log("✅ Данные сохранены в облако")
        
    }).catch(err => {
        alert("Ошибка сохранения: " + err.message)
    })
}

// Сохранение при закрытии вкладки
window.addEventListener("beforeunload", function() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout)
    saveToGoogleSheet()
})
    
// ============= УСИЛЕННАЯ ЗАЩИТА ДАННЫХ =============

// Автосохранение каждые 30 секунд
setInterval(function() {
    if (employees.length > 0) {
        console.log("🔄 Автосохранение данных...")
        saveToCloud()
    }
    // Также загружаем из облака чтобы видеть изменения с других компьютеров
    loadFromCloudQuiet()
}, 30000)

// Тихо загрузить из облака (без уведомлений)
function loadFromCloudQuiet() {
    if (!isJsonBinConfigured()) return
    
    fetch("https://api.jsonbin.io/v3/b/" + jsonBinId + "/latest", {
        method: "GET",
        headers: { "X-Master-Key": jsonBinApiKey }
    })
    .then(response => response.json())
    .then(data => {
        if (data.record) {
            let cloudEmployees = data.record.employees || []
            let cloudAbsences = data.record.absences || []
            let cloudCreds = data.record.employeeCredentials || {}
            let cloudChat = data.record.chatMessages || []
            
            // Если в облаке есть новые данные - обновляем
            if (cloudEmployees.length !== employees.length || cloudAbsences.length !== absences.length) {
                console.log("🔄 Загружены обновления из облака")
                employees = cloudEmployees
                absences = cloudAbsences
                saveEmployeesToDB()
                renderEmployees()
            }
            
            // Обновляем логины сотрудников
            if (Object.keys(cloudCreds).length > 0) {
                employeeCredentials = cloudCreds
                localStorage.setItem("employeeCredentials", JSON.stringify(employeeCredentials))
            }
            
            // Обновляем сообщения чата
            if (cloudChat.length > 0 && JSON.stringify(cloudChat) !== JSON.stringify(chatMessages)) {
                chatMessages = cloudChat
                localStorage.setItem("chatMessages", JSON.stringify(chatMessages))
                renderChatMessages()
            }
        }
    })
    .catch(err => console.log("Ошибка проверки облака:", err.message))
}

// Сохранение при любых изменениях данных
let originalSaveData = saveData
saveData = function() {
    originalSaveData()
    // Дублируем в localStorage с временной меткой
    let backup = {
        employees: employees,
        absences: absences,
        globalPhoto: globalPhoto,
        employeeCredentials: employeeCredentials,
        chatMessages: chatMessages,
        lastSaved: new Date().toISOString(),
        version: "2.0"
    }
    localStorage.setItem("hrDataEmergency", JSON.stringify(backup))
    console.log("✅ Данные сохранены в резервный буфер")
}

// Функция экстренного восстановления
function emergencyRestore() {
    // Пробуем разные источники
    let sources = [
        { name: "Резервная копия (hrDataBackup)", data: localStorage.getItem("hrDataBackup") },
        { name: "Экстренный буфер (hrDataEmergency)", data: localStorage.getItem("hrDataEmergency") },
        { name: "JSONBin облако", data: null } // обработаем отдельно
    ]
    
    for (let source of sources) {
        if (source.name === "JSONBin облако") {
            // Пробуем загрузить из облака
            if (isJsonBinConfigured()) {
                fetch("https://api.jsonbin.io/v3/b/" + jsonBinId + "/latest", {
                    method: "GET",
                    headers: { "X-Master-Key": jsonBinApiKey }
                })
                .then(r => r.json())
                .then(data => {
                    if (data.record && (data.record.employees?.length > 0 || data.record.absences?.length > 0)) {
                        applyEmergencyData(data.record, "JSONBin")
                    }
                })
            }
            continue
        }
        
        if (source.data) {
            try {
                let parsed = JSON.parse(source.data)
                if (parsed.employees?.length > 0 || parsed.absences?.length > 0) {
                    applyEmergencyData(parsed, source.name)
                    return
                }
            } catch(e) {}
        }
    }
    
    alert("Резервные копии не найдены или пусты")
}

// Применить экстренные данные
function applyEmergencyData(data, sourceName) {
    if (!confirm(`Найдена резервная копия в: ${sourceName}\n\nПрименить эти данные? Текущие данные будут заменены.`)) {
        return
    }

    if (data.employees) {
        employees = data.employees
        saveEmployeesToDB()
    }
    if (data.absences) {
        absences = data.absences
    }
    if (data.globalPhoto) {
        globalPhoto = data.globalPhoto
    }
    if (data.employeeCredentials) {
        employeeCredentials = data.employeeCredentials
        localStorage.setItem("employeeCredentials", JSON.stringify(employeeCredentials))
    }
    if (data.chatMessages) {
        chatMessages = data.chatMessages
        localStorage.setItem("chatMessages", JSON.stringify(chatMessages))
    }
    
    renderEmployees()
    alert(`✅ Данные восстановлены!\n👥 Сотрудников: ${employees.length}\n📋 Отсутствий: ${absences.length}\n🔐 Логинов: ${Object.keys(employeeCredentials).length}`)
}

// Экспорт данных в файл
function exportDataToFile() {
    let data = {
        employees: employees,
        absences: absences,
        globalPhoto: globalPhoto,
        employeeCredentials: employeeCredentials,
        chatMessages: chatMessages,
        exportedAt: new Date().toISOString(),
        version: "2.0"
    }
    
    let blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    let url = URL.createObjectURL(blob)
    let a = document.createElement("a")
    a.href = url
    a.download = "hr_backup_" + new Date().toISOString().slice(0,10) + ".json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    alert("✅ Данные экспортированы в файл!\nСохраните файл в безопасном месте.")
}

// Импорт данных из файла
function importDataFromFile() {
    let input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = function(e) {
        let file = e.target.files[0]
        if (!file) return
        
        let reader = new FileReader()
        reader.onload = function(event) {
            try {
                let data = JSON.parse(event.target.result)
                
                if (!data.employees && !data.absences) {
                    alert("❌ Неверный формат файла")
                    return
                }
                
                if (!confirm(`Импортировать данные из файла?\n\n👥 Сотрудников: ${data.employees?.length || 0}\n📋 Отсутствий: ${data.absences?.length || 0}\n\nВНИМАНИЕ: Текущие данные будут заменены!`)) {
                    return
                }
                
                if (data.employees) {
                    employees = data.employees
                    saveEmployeesToDB()
                }
                if (data.absences) {
                    absences = data.absences
                }
                if (data.globalPhoto) {
                    globalPhoto = data.globalPhoto
                }
                if (data.employeeCredentials) {
                    employeeCredentials = data.employeeCredentials
                    localStorage.setItem("employeeCredentials", JSON.stringify(employeeCredentials))
                }
                if (data.chatMessages) {
                    chatMessages = data.chatMessages
                    localStorage.setItem("chatMessages", JSON.stringify(chatMessages))
                }
                
                renderEmployees()
                saveToCloud()
                alert("✅ Данные импортированы!")
            } catch(err) {
                alert("❌ Ошибка чтения файла: " + err.message)
            }
        }
        reader.readAsText(file)
    }
    input.click()
}

// Показать статус защиты данных
function showDataProtectionStatus() {
    let backup = localStorage.getItem("hrDataBackup")
    let emergency = localStorage.getItem("hrDataEmergency")
    let backupTime = "нет"
    let emergencyTime = "нет"
    
    if (backup) {
        try {
            let d = JSON.parse(backup)
            backupTime = d.lastSaved ? new Date(d.lastSaved).toLocaleString("ru-RU") : "неизвестно"
        } catch(e) {}
    }
    
    if (emergency) {
        try {
            let d = JSON.parse(emergency)
            emergencyTime = d.lastSaved ? new Date(d.lastSaved).toLocaleString("ru-RU") : "неизвестно"
        } catch(e) {}
    }
    
    alert(`🛡 СТАТУС ЗАЩИТЫ ДАННЫХ\n\n` +
        `💾 Резервная копия: ${backupTime}\n` +
        `⚡ Экстренный буфер: ${emergencyTime}\n` +
        `👥 Сотрудников: ${employees.length}\n` +
        `📋 Отсутствий: ${absences.length}\n` +
        `☁️ JSONBin: ${isJsonBinConfigured() ? "подключён" : "не настроен"}`)
}
    
// Проверка использования памяти IndexedDB
function getDataSize() {
    let data = JSON.stringify({ employees: employees, globalPhoto: globalPhoto })
    return new Blob([data]).size
}

function showStorageInfo() {
    let size = getDataSize()
    let usedMB = (size / 1024 / 1024).toFixed(2)
    let limitMB = 50 // Примерный лимит IndexedDB
    alert(`📊 Использование памяти:\n\nИспользовано: ${usedMB} MB\nПримерный лимит: ~${limitMB} MB\nСотрудников: ${employees.length}`)
}

function loginUser() {
    // Инициализируем элементы
    let loginPageEl = document.getElementById("loginPage")
    let mainPageEl = document.getElementById("mainPage")
    let loginInput = document.getElementById("login")
    let passwordInput = document.getElementById("password")
    
    if (!loginInput || !passwordInput) {
        alert("Ошибка: страница не загружена. Обновите страницу.")
        return
    }
    
    let loginVal = loginInput.value.trim()
    let passwordVal = passwordInput.value.trim()
    
    if (!loginVal || !passwordVal) {
        alert("Введите логин и пароль!")
        return
    }
    
    console.log("Логин:", loginVal, "Пароль:", passwordVal)
    
    // Проверка логина и пароля
    let loginLower = loginVal.toLowerCase().trim()
    let passwordTrim = passwordVal.trim()
    
    if (loginLower === "zayniddin" && passwordTrim === "3020") { 
        role = "admin" 
    } else if (loginLower === "supervisor" && passwordTrim === "supervisor") { 
        role = "supervisor" 
    } else if (loginLower === "admin" && passwordTrim === "admin") {
        // Дополнительный вариант для админа
        role = "admin"
    } else {
        alert("Ошибка: неверный логин или пароль") 
        return
    }
    
    // Сохраняем логин
    localStorage.setItem("savedLogin", loginVal)
    localStorage.setItem("savedPassword", passwordVal)
    
    // Загружаем глобальное фото
    let savedPhoto = localStorage.getItem("globalPhoto")
    if (savedPhoto) globalPhoto = savedPhoto
    
    // Загружаем сотрудников из IndexedDB
    loadEmployeesFromDB().then(() => {
        loginPageEl.classList.add("hidden")
        mainPageEl.classList.remove("hidden")
        if (role === "admin") {
            document.getElementById("addBtn").style.display = "inline-block"
            document.getElementById("headerChartsBtn").style.display = "inline-block"
            document.getElementById("headerDiagramsBtn").style.display = "inline-block"
            document.getElementById("headerSidebarToggle").style.display = "inline-block"
            document.getElementById("shiftBtn").style.display = "inline-block"
            document.getElementById("globalPhotoBtn").style.display = "inline-block"
            document.getElementById("syncBtn").style.display = "inline-block"
            document.getElementById("clearAllBtn").style.display = "inline-block"
            document.querySelector(".export").style.display = "inline-block"
            document.getElementById("employeeCredsBtn").style.display = "inline-block"
            document.getElementById("exportBtn").style.display = "inline-block"
            document.getElementById("importBtn").style.display = "inline-block"
            document.getElementById("protectBtn").style.display = "inline-block"
            document.getElementById("userRole").textContent = " | Admin"
            
            // Автоматическая загрузка из облака при входе (чтобы видеть изменения с других компьютеров)
            setTimeout(() => {
                loadFromCloud()
            }, 1000)
        } else if (role === "supervisor") {
            document.getElementById("userRole").textContent = " | Supervazer"
            document.getElementById("headerChartsBtn").style.display = "inline-block"
            document.getElementById("headerDiagramsBtn").style.display = "inline-block"
            document.getElementById("headerSidebarToggle").style.display = "inline-block"
            clearTestEmployees()
            // Автоматическая загрузка из облака для супервизора
            loadFromCloud()
        } else {
            document.querySelector(".export").style.display = "none"
            document.getElementById("userRole").textContent = " | Supervazer"
        }
        
        // Инициализируем чат после входа
        initChatWhenReady()
        renderEmployees()
    })
}

function toggleAdd() {
    let addSection = document.getElementById("addSection")
    let addBtn = document.getElementById("addBtn")
    if (addSection.classList.contains("hidden")) {
        addSection.classList.remove("hidden")
        addBtn.textContent = "✕ Скрыть форму"
    } else {
        addSection.classList.add("hidden")
        addBtn.textContent = "+ Добавить сотрудника"
    }
}

function toggleExtraFields() {
    let extraFields = document.getElementById("extraFields")
    if (extraFields.style.display === "none") {
        extraFields.style.display = "block"
    } else {
        extraFields.style.display = "none"
    }
}

function toggleEmployeeExtra(i) {
    let extraDiv = document.getElementById("extra-" + i)
    if (extraDiv.style.display === "none") {
        extraDiv.style.display = "block"
    } else {
        extraDiv.style.display = "none"
    }
}

function toggleDateRange() {
    let status = document.getElementById("newStatus").value
    let dateRangeFields = document.getElementById("dateRangeFields")
    let firedDateField = document.getElementById("firedDateField")
    if (status === "Учёба" || status === "Отпуск" || status === "Больничный" || status === "Декрет" || status === "Армия") {
        dateRangeFields.style.display = "block"
        firedDateField.style.display = "none"
    } else if (status === "Увольнение") {
        dateRangeFields.style.display = "none"
        firedDateField.style.display = "block"
    } else {
        dateRangeFields.style.display = "none"
        firedDateField.style.display = "none"
    }
}

function setGlobalPhoto() {
    if (role !== "admin") { alert("Нет доступа"); return }
    let newPhotoUrl = prompt("Введите URL фото для всех сотрудников:", globalPhoto)
    if (newPhotoUrl === null) return
    globalPhoto = newPhotoUrl
    localStorage.setItem("globalPhoto", globalPhoto)
    // Обновляем фото у всех существующих сотрудников
    employees.forEach(emp => {
        emp.photo = globalPhoto
    })
    saveData()
    renderEmployees()
    alert("Фото установлено для всех сотрудников!")
}

function handleGlobalPhotoUpload(event) {
    if (role !== "admin") { alert("Нет доступа"); return }
    let file = event.target.files[0]
    if (!file) return
    // Проверка размера файла (макс 500KB)
    if (file.size > 500000) {
        alert("Файл слишком большой! Максимум 500KB. Выберите меньше фото.")
        return
    }
    let reader = new FileReader()
    reader.onload = function (e) {
        globalPhoto = e.target.result
        try {
            localStorage.setItem("globalPhoto", globalPhoto)
        } catch (e) {
            alert("Файл слишком большой для сохранения!")
            return
        }
        // Обновляем фото у всех сотрудников
        employees.forEach(emp => {
            emp.photo = globalPhoto
        })
        saveData()
        renderEmployees()
        alert("Фото установлено для всех сотрудников!")
    }
    reader.readAsDataURL(file)
    event.target.value = ""
}
    
function logout() {
    // Сохраняем данные перед выходом
    saveToGoogleSheet()
    
    // Удаляем сохранённый логин и пароль
    localStorage.removeItem("savedLogin")
    localStorage.removeItem("savedPassword")
    
    // Сбрасываем роль
    role = ""
    
    // Перезагружаем страницу
    location.reload()
}

function addEmployee() {
    if (role !== "admin") { alert("Нет доступа"); return }
    
    let nameValue = (newName?.value || "").trim()
    if (!nameValue) {
        alert("Введите ФИО сотрудника")
        return
    }
    
    let phoneValue = (newPhone?.value || "").trim()
    if (phoneValue && !phoneValue.startsWith("+998") && !phoneValue.startsWith("998")) {
        phoneValue = "+998" + phoneValue.replace(/^0+/, '')
    }
    
    let operatorEl = document.getElementById("newOperator")
    let addressEl = document.getElementById("newAddress")
    let dateEl = document.getElementById("newDate")
    let birthdayEl = document.getElementById("newBirthday")
    let photoEl = document.getElementById("newPhoto")
    let statusEl = document.getElementById("newStatus")
    let genderEl = document.getElementById("newGender")
    
    let photoUrl = photoEl?.value?.trim() || ""
    let status = statusEl?.value || "На работе"
    let dateFrom = document.getElementById("newDateFrom")?.value || ""
    let dateTo = document.getElementById("newDateTo")?.value || ""
    let firedDate = document.getElementById("newFiredDate")?.value || ""
    let dateRange = ""
    
    if ((status === "Учёба" || status === "Отпуск" || status === "Больничный" || status === "Декрет" || status === "Армия") && dateFrom && dateTo) {
        dateRange = dateFrom + " - " + dateTo
    } else if (status === "Увольнение" && firedDate) {
        dateRange = "Уволен: " + firedDate
    }
    
    employees.push({
        name: nameValue,
        phone: phoneValue,
        operator: operatorEl?.value?.trim() || "",
        address: addressEl?.value?.trim() || "",
        date: dateEl?.value?.trim() || "",
        birthday: birthdayEl?.value?.trim() || "",
        status: status,
        photo: photoUrl,
        gender: genderEl?.value || "male",
        dateRange: dateRange
    })
    
    employees.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    saveData()
    renderEmployees()
    
    newName.value = ""
    newPhone.value = ""
    if (operatorEl) operatorEl.value = ""
    if (addressEl) addressEl.value = ""
    if (dateEl) dateEl.value = ""
    if (photoEl) photoEl.value = ""
    if (birthdayEl) birthdayEl.value = ""
    let dateFromEl = document.getElementById("newDateFrom")
    let dateToEl = document.getElementById("newDateTo")
    let firedDateEl = document.getElementById("newFiredDate")
    if (dateFromEl) dateFromEl.value = ""
    if (dateToEl) dateToEl.value = ""
    if (firedDateEl) firedDateEl.value = ""
    if (statusEl) statusEl.value = "На работе"
    if (genderEl) genderEl.value = "male"
    toggleDateRange()
}

function deleteEmployee(i) {
    employees.splice(i, 1)
    saveData()
    renderEmployees()
}

function changeStatus(i, newStatus) {
    if (role !== "admin") { alert("Нет доступа"); return }
    employees[i].status = newStatus
    if (newStatus === "Учёба" || newStatus === "Отпуск" || newStatus === "Больничный" || newStatus === "Декрет" || newStatus === "Армия") {
        let currentRange = employees[i].dateRange || ""
        let dates = currentRange.split(" - ")
        let dateFrom = dates[0] || ""
        let dateTo = dates[1] || ""
        let newFrom = prompt("Дата С:", dateFrom)
        if (newFrom === null) return
        let newTo = prompt("Дата По:", dateTo)
        if (newTo === null) return
        employees[i].dateRange = newFrom && newTo ? newFrom + " - " + newTo : ""
    } else if (newStatus === "Увольнение") {
        let currentFired = employees[i].dateRange || ""
        let firedDate = currentFired.replace("Уволен: ", "")
        let newFired = prompt("Дата увольнения:", firedDate)
        if (newFired === null) return
        employees[i].dateRange = newFired ? "Уволен: " + newFired : ""
    } else {
        employees[i].dateRange = ""
    }
    saveData()
    renderEmployees()
}

function changeGender(i, newGender) {
    if (role !== "admin") { alert("Нет доступа"); return }
    employees[i].gender = newGender
    saveData()
    renderEmployees()
}

function editField(i, field) {
    if (role !== "admin") { alert("Нет доступа"); return }
    let emp = employees[i]
    let current = emp[field]
    let label = field === "phone" ? "Телефон" : field === "address" ? "Адрес" : field === "date" ? "Дата приёма" : field === "birthday" ? "Дата рождения" : field === "operator" ? "Оператор" : "Пол"
    let newValue = prompt("Изменить " + label + ":", current)
    if (newValue === null || newValue === current) return
    if (field === "gender") { newValue = newValue.toLowerCase().includes("муж") ? "male" : "female" }
    emp[field] = newValue
    saveData()
    renderEmployees()
}

let currentEditingPhotoIndex = -1

function editPhoto(i) {
    if (role !== "admin") { alert("Нет доступа"); return }
    currentEditingPhotoIndex = i
    document.getElementById("employeePhotoInput").click()
}

function handleEmployeePhotoUpload(event) {
    let file = event.target.files[0]
    if (!file || currentEditingPhotoIndex < 0) return
    // Проверка размера файла (макс 500KB)
    if (file.size > 500000) {
        alert("Файл слишком большой! Максимум 500KB. Выберите меньше фото.")
        event.target.value = ""
        return
    }
    let reader = new FileReader()
    reader.onload = function (e) {
        employees[currentEditingPhotoIndex].photo = e.target.result
        saveData()
        renderEmployees()
        alert("Фото обновлено!")
    }
    reader.readAsDataURL(file)
    currentEditingPhotoIndex = -1
    event.target.value = ""
}
    
function editEmployee(i) {
    if (role !== "admin") { alert("Нет доступа"); return }
    let emp = employees[i]
    let newName = prompt("ФИО:", emp.name)
    if (newName === null) return
    let newPhone = prompt("Телефон:", emp.phone)
    if (newPhone === null) return
    let newAddress = prompt("Адрес:", emp.address)
    if (newAddress === null) return
    let newDate = prompt("Дата приема:", emp.date)
    if (newDate === null) return
    let newPhoto = prompt("URL фото:", emp.photo)
    if (newPhoto === null) return
    let newGender = prompt("Пол (male/female):", emp.gender)
    if (newGender === null) return
    employees[i] = { name: newName, phone: newPhone, operator: emp.operator, address: newAddress, date: newDate, birthday: emp.birthday, status: emp.status, photo: newPhoto, gender: newGender, dateRange: emp.dateRange }
    saveData()
    renderEmployees()
}

function renderEmployees() {
    let list = document.getElementById("employeeList")
    let genderFilter = document.getElementById("genderFilter")?.value || ""
    let searchQuery = search?.value?.toLowerCase() || ""
    if (!list) return

    list.innerHTML = ""

    employees
        .filter(emp => {
            let matchName = (emp.name || "").toLowerCase().includes(searchQuery)
            let matchPhone = (emp.phone || "").toLowerCase().includes(searchQuery)
            let matchOperator = (emp.operator || "").toLowerCase().includes(searchQuery)
            let matchGender = !genderFilter || emp.gender === genderFilter
            return (matchName || matchPhone || matchOperator) && matchGender
        })
        .forEach((emp, i) => {
            let div = document.createElement("div")
            div.className = "employee " + getClass(emp.status || "На работе")

            let dateRangeHtml = emp.dateRange ? `<p style="color:#e74c3c;font-weight:bold;margin:5px 0;">📅 Период: ${emp.dateRange}</p>` : ""
            let photoHtml = emp.photo && emp.photo.length > 10
                ? `<img src="${emp.photo}" onerror="this.style.display='none'">`
                : `<div class="avatar-placeholder ${emp.gender || ''}">${(emp.name || '?').charAt(0).toUpperCase()}</div>`
            let shiftName = getEmployeeShift(emp.name)
            let shiftHtml = shiftName ? `<p style="margin:6px 0;color:#667eea;font-weight:600;">👥 ${shiftName}</p>` : ""
            let workType = getEmployeeWorkType(emp.name)
            let workTypeInfo = WORK_TYPES[workType] || WORK_TYPES.standard
            let safeName = String(emp.name || "").replace(/'/g, "\\'")
            let workTypeHtml = role === "admin"
                ? `<div style="margin-top:10px;"><label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Перерыв / смена</label><select onchange="setEmployeeWorkType('${safeName}', this.value); saveToCloud(); showWorkTypeConfirm(this, '${safeName}');" style="padding:8px;border-radius:8px;min-width:220px;"><option value="standard" ${workType === "standard" ? "selected" : ""}>9 часов / 105 мин</option><option value="long" ${workType === "long" ? "selected" : ""}>12 часов / 140 мин</option></select><span id="confirm-${safeName.replace(/\\/g, '')}" style="display:none;color:#27ae60;font-size:12px;margin-top:4px;">✅ Сохранено</span></div>`
                : `<p style="margin:6px 0;color:#16a085;font-weight:600;">⏱ ${workTypeInfo.name}</p>`

            div.innerHTML = `
                <div class="employee-header">
                    <div class="employee-info">
                        ${photoHtml}
                        <div>
                            <h3>${emp.name || "Без имени"}</h3>
                            ${role === "admin"
                                ? `<select class="status-select ${getClass(emp.status || "На работе")}" onchange="changeStatus(${i},this.value)">
                                    <option value="На работе" ${(emp.status || "На работе") === "На работе" ? "selected" : ""}>На работе</option>
                                    <option value="Учёба" ${emp.status === "Учёба" ? "selected" : ""}>Учёба</option>
                                    <option value="Отпуск" ${emp.status === "Отпуск" ? "selected" : ""}>Отпуск</option>
                                    <option value="Больничный" ${emp.status === "Больничный" ? "selected" : ""}>Больничный</option>
                                    <option value="Без содержания" ${emp.status === "Без содержания" ? "selected" : ""}>Без содержания</option>
                                    <option value="Декрет" ${emp.status === "Декрет" ? "selected" : ""}>Декрет</option>
                                    <option value="Армия" ${emp.status === "Армия" ? "selected" : ""}>Армия</option>
                                    <option value="Увольнение" ${emp.status === "Увольнение" ? "selected" : ""}>Увольнение</option>
                                </select>`
                                : `<span class="status-view ${getClass(emp.status || "На работе")}">${emp.status || "На работе"}</span>`}
                            <p class="editable-field" onclick="inlineEdit(${i}, 'operator', this)" style="cursor:pointer;">🧾 Оператор: <span class="field-value">${emp.operator || "—"}</span></p>
                            <button class="more-btn" onclick="toggleEmployeeDetails(this)" style="margin:8px 0;background:#667eea;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">📋 Подробнее</button>
                            <div class="employee-details" style="display:none;">
                                <p class="editable-field" onclick="inlineEdit(${i}, 'phone', this)" style="cursor:pointer;">📞 Телефон: <span class="field-value">${emp.phone || "—"}</span></p>
                                <p class="editable-field" onclick="inlineEdit(${i}, 'address', this)" style="cursor:pointer;">🏠 Адрес: <span class="field-value">${emp.address || "—"}</span></p>
                                <p class="editable-field" onclick="inlineEdit(${i}, 'date', this)" style="cursor:pointer;">📅 Дата приёма: <span class="field-value">${emp.date || "—"}</span></p>
                                <p class="editable-field" onclick="inlineEdit(${i}, 'birthday', this)" style="cursor:pointer;">🎂 Дата рождения: <span class="field-value">${emp.birthday || "—"}</span></p>
                                ${dateRangeHtml}
                                ${shiftHtml}
                                ${workTypeHtml}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;">
                        ${role === "admin" ? `
                            <button class="edit" onclick="editEmployee(${i})">✏️ Изменить</button>
                            <button class="edit" onclick="editPhoto(${i})">📷 Фото</button>
                            <button class="delete" onclick="deleteEmployee(${i})">🗑 Удалить</button>
                        ` : ""}
                    </div>
                </div>
            `
            list.appendChild(div)
        })

    updateStats()
}

function toggleEmployeeDetails(btn) {
    let detailsDiv = btn.nextElementSibling
    if (!detailsDiv) return

    if (detailsDiv.style.display === "none") {
        detailsDiv.style.display = "block"
        btn.textContent = "🔽 Скрыть"
        btn.style.background = "#95a5a6"
    } else {
        detailsDiv.style.display = "none"
        btn.textContent = "📋 Подробнее"
        btn.style.background = "#667eea"
    }
}

function inlineEdit(index, field, element) {
    if (role !== "admin") { alert("Нет доступа"); return }

    let emp = employees[index]
    if (!emp) return

    let currentValue = emp[field] || ""
    let fieldLabels = {
        operator: "Оператор",
        phone: "Телефон",
        address: "Адрес",
        date: "Дата приёма",
        birthday: "Дата рождения"
    }

    let newValue = prompt("Изменить " + (fieldLabels[field] || field) + ":", currentValue)
    if (newValue === null || newValue === currentValue) return

    emp[field] = newValue
    saveData()
    renderEmployees()
}

function getClass(status) {
    if (status === "На работе") return "work"
    if (status === "Учёба") return "study"
    if (status === "Отпуск") return "vacation"
    if (status === "Больничный") return "sick"
    if (status === "Без содержания") return "unpaid"
    if (status === "Декрет") return "maternity"
    if (status === "Армия") return "army"
    if (status === "Увольнение") return "fired"
    return "work"
}

function updateStats() {
    let stats = document.getElementById("stats")
    if (!stats) return

    let total = employees.length
    let atWork = employees.filter(e => (e.status || "На работе") === "На работе").length
    let onStudy = employees.filter(e => e.status === "Учёба").length
    let onVacation = employees.filter(e => e.status === "Отпуск").length
    let onSick = employees.filter(e => e.status === "Больничный").length
    let onUnpaid = employees.filter(e => e.status === "Без содержания").length
    let onMaternity = employees.filter(e => e.status === "Декрет").length
    let onArmy = employees.filter(e => e.status === "Армия").length
    let fired = employees.filter(e => e.status === "Увольнение").length

    stats.innerHTML = `
        <div class="stats-header" onclick="toggleStatsDetails()" style="cursor:pointer;">
            <span style="font-size:18px;font-weight:bold;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">📊 Статистика</span>
            <span id="statsToggleIcon" style="color:#667eea;font-size:14px;">▼</span>
        </div>
        <div id="statsDetails" class="stats-grid">
            <div class="stat-mini" style="border-left:4px solid #667eea;">
                <span class="stat-num">${total}</span>
                <span class="stat-label">Всего</span>
            </div>
            <div class="stat-mini" style="border-left:4px solid #00c853;">
                <span class="stat-num">${atWork}</span>
                <span class="stat-label">👔 На работе</span>
            </div>
            <div class="stat-mini" style="border-left:4px solid #00bcd4;">
                <span class="stat-num">${onStudy}</span>
                <span class="stat-label">📚 Учёба</span>
            </div>
            <div class="stat-mini" style="border-left:4px solid #2196f3;">
                <span class="stat-num">${onVacation}</span>
                <span class="stat-label">🏖 Отпуск</span>
            </div>
            <div class="stat-mini" style="border-left:4px solid #f44336;">
                <span class="stat-num">${onSick}</span>
                <span class="stat-label">🤒 Больничный</span>
            </div>
            <div class="stat-mini" style="border-left:4px solid #757575;">
                <span class="stat-num">${onUnpaid}</span>
                <span class="stat-label">❌ Без содержания</span>
            </div>
            <div class="stat-mini" style="border-left:4px solid #e91e63;">
                <span class="stat-num">${onMaternity}</span>
                <span class="stat-label">👶 Декрет</span>
            </div>
            <div class="stat-mini" style="border-left:4px solid #00bfa5;">
                <span class="stat-num">${onArmy}</span>
                <span class="stat-label">🎖 Армия</span>
            </div>
            <div class="stat-mini" style="border-left:4px solid #5e35b1;">
                <span class="stat-num">${fired}</span>
                <span class="stat-label">🚫 Уволено</span>
            </div>
        </div>
    `
}

function toggleStatsDetails() {
    let details = document.getElementById("statsDetails")
    let icon = document.getElementById("statsToggleIcon")
    if (!details) return

    if (details.style.display === "none") {
        details.style.display = "grid"
        if (icon) icon.textContent = "▼"
    } else {
        details.style.display = "none"
        if (icon) icon.textContent = "▶"
    }
}

function showTemplates() {
    alert("Раздел шаблонов отключён")
}

let chatMessages = JSON.parse(localStorage.getItem("chatMessages") || "[]")
let chatUnread = 0
let lastReadMessageId = localStorage.getItem("lastReadMessageId") || null

function initChat() {
    renderChatMessages()
    updateChatBadge()

    window.addEventListener("storage", function(e) {
        if (e.key === "chatMessages") {
            try {
                chatMessages = JSON.parse(localStorage.getItem("chatMessages") || "[]")
                renderChatMessages()
                calculateUnreadMessages()
            } catch (err) {
                console.log("Ошибка обновления чата:", err.message)
            }
        }
    })
}

function calculateUnreadMessages() {
    if (!lastReadMessageId || chatMessages.length === 0) {
        chatUnread = chatMessages.length
        updateChatBadge()
        return
    }

    let lastIndex = chatMessages.findIndex(m => m.id === lastReadMessageId)
    if (lastIndex >= 0 && lastIndex < chatMessages.length - 1) {
        chatUnread = chatMessages.length - 1 - lastIndex
    } else if (lastIndex < 0) {
        chatUnread = chatMessages.length
    } else {
        chatUnread = 0
    }
    updateChatBadge()
}

function sendChatMessage() {
    let input = document.getElementById("chatInput")
    if (!input) return

    let text = input.value.trim()
    if (!text) return

    let senderName = role === "admin" ? "Админ" : role === "supervisor" ? "Супервайзер" : (currentEmployee?.name || "Сотрудник")
    let message = {
        id: Date.now().toString() + Math.random().toString(16).slice(2),
        text: text,
        author: senderName,
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now()
    }

    chatMessages.push(message)
    saveChatToLocal()
    renderChatMessages()
    input.value = ""

    let messagesDiv = document.getElementById("chatMessages")
    if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight

    setTimeout(() => saveToCloud(), 0)
}

function saveChatToLocal() {
    localStorage.setItem("chatMessages", JSON.stringify(chatMessages))
}

function toggleChat() {
    let panel = document.getElementById("chatPanel")
    if (!panel) return

    let isOpen = panel.classList.contains("open")
    if (isOpen) {
        panel.classList.remove("open")
        panel.classList.add("hidden")
    } else {
        panel.classList.remove("hidden")
        panel.classList.add("open")
        chatUnread = 0
        updateChatBadge()
        renderChatMessages()

        if (chatMessages.length > 0) {
            let lastMsg = chatMessages[chatMessages.length - 1]
            lastReadMessageId = lastMsg.id
            localStorage.setItem("lastReadMessageId", lastReadMessageId)
        }

        requestAnimationFrame(() => {
            let messagesDiv = document.getElementById("chatMessages")
            if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight
        })
    }
}

function handleChatKeypress(event) {
    if (event.key === "Enter") sendChatMessage()
}

function renderChatMessages() {
    let container = document.getElementById("chatMessages")
    if (!container) return

    if (chatMessages.length === 0) {
        container.innerHTML = '<div class="chat-empty">💬 Начните общение!<br>Сообщений пока нет.</div>'
        return
    }

    let currentUser = currentEmployee ? currentEmployee.name : (role === "supervisor" ? "Супервайзер" : "Админ")
    container.innerHTML = chatMessages.map(msg => {
        let isOwn = msg.author === currentUser
        return `
            <div class="chat-message ${isOwn ? 'own' : 'other'}">
                ${!isOwn ? `<div class="msg-author">${msg.author}</div>` : ''}
                <div class="msg-text">${escapeHtml(msg.text)}</div>
                <div class="msg-time">${msg.time}</div>
            </div>
        `
    }).join("")
}

function updateChatBadge() {
    let badges = document.querySelectorAll(".chat-badge")
    badges.forEach(badge => {
        if (chatUnread > 0) {
            badge.textContent = chatUnread > 9 ? "9+" : chatUnread
            badge.style.display = "flex"
        } else {
            badge.style.display = "none"
        }
    })
}

function escapeHtml(text) {
    let div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}

function initChatWhenReady() {
    if (document.getElementById("chatPanel")) {
        initChat()
    } else {
        setTimeout(initChatWhenReady, 100)
    }
}

initChatWhenReady()

function showWorkTypeConfirm(selectEl, empName) {
    let confirmSpan = document.getElementById("confirm-" + empName.replace(/\\/g, ""))
    if (!confirmSpan) return

    selectEl.style.borderColor = "#27ae60"
    selectEl.style.background = "#e8f5e9"

    confirmSpan.style.display = "inline"

    setTimeout(() => {
        confirmSpan.style.display = "none"
        selectEl.style.borderColor = ""
        selectEl.style.background = ""
    }, 1500)
}

function toggleSidebar(forceState = null) {
    let sidebar = document.getElementById("actionSidebar")
    if (!sidebar) return

    if (forceState === "open") {
        sidebar.classList.remove("collapsed")
        return
    }

    if (forceState === "close") {
        sidebar.classList.add("collapsed")
        return
    }

    sidebar.classList.toggle("collapsed")
}

document.addEventListener("click", function(event) {
    let sidebar = document.getElementById("actionSidebar")
    let toggleBtn = document.getElementById("headerSidebarToggle")
    if (!sidebar || !toggleBtn) return

    if (sidebar.classList.contains("collapsed")) return

    let clickedInsideSidebar = sidebar.contains(event.target)
    let clickedToggle = toggleBtn.contains(event.target)

    if (!clickedInsideSidebar && !clickedToggle) {
        toggleSidebar("close")
    }
})

function requestNotificationPermission() {
    return true
}

function showBrowserNotification(title, body, icon = "💬") {
    console.log(title, body, icon)
}

setInterval(function() {
    let panel = document.getElementById("chatPanel")
    if (panel && panel.classList.contains("open")) return

    try {
        let newMessages = JSON.parse(localStorage.getItem("chatMessages") || "[]")
        if (newMessages.length !== chatMessages.length) {
            chatMessages = newMessages
            renderChatMessages()
            calculateUnreadMessages()
        }
    } catch (e) {}
}, 1000)

function checkIn() {
    if (!currentEmployee) return
    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    workDays.push({ name: currentEmployee.name, type: "in", time: new Date().toLocaleString("ru-RU"), date: new Date().toLocaleDateString("ru-RU") })
    localStorage.setItem("workDays", JSON.stringify(workDays))
    alert("✅ Приход отмечен")
}

function checkOut() {
    if (!currentEmployee) return
    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    workDays.push({ name: currentEmployee.name, type: "out", time: new Date().toLocaleString("ru-RU"), date: new Date().toLocaleDateString("ru-RU") })
    localStorage.setItem("workDays", JSON.stringify(workDays))
    alert("✅ Уход отмечен")
}

function showTimeSheet() {
    if (!currentEmployee) return
    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    let myDays = workDays.filter(w => w.name === currentEmployee.name)
    if (myDays.length === 0) return alert("Нет записей табеля")
    alert(myDays.map(w => `${w.date} | ${w.type === 'in' ? 'Приход' : 'Уход'} | ${w.time}`).join("\n"))
}

function showBreakStats() {
    if (!currentEmployee) return
    let myBreaks = employeeBreaks.filter(b => b.name === currentEmployee.name)
    let total = myBreaks.reduce((sum, b) => sum + (b.actualMinutes || b.plannedDuration || b.duration || 0), 0)
    alert(`Перерывов: ${myBreaks.length}\nОбщее время: ${total} мин`)
}

function showAdminTimeSheet() {
    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    if (workDays.length === 0) return alert("Нет данных табеля")
    alert(workDays.map(w => `${w.name} | ${w.date} | ${w.type === 'in' ? 'Приход' : 'Уход'} | ${w.time}`).join("\n"))
}

// ============= СТАТИСТИКА =============
let statusChart = null
let genderChart = null

function toggleCharts() {
    let section = document.getElementById("chartsSection")
    if (!section) return

    if (section.style.display === "none") {
        section.style.display = "block"
        renderCharts()
    } else {
        section.style.display = "none"
    }
}

function renderCharts() {
    // Подсчёт данных
    let statusCounts = {
        "На работе": 0,
        "Учёба": 0,
        "Отпуск": 0,
        "Больничный": 0,
        "Без содержания": 0,
        "Декрет": 0,
        "Армия": 0,
        "Увольнение": 0
    }

    let genderCounts = {
        "male": 0,
        "female": 0
    }

    employees.forEach(emp => {
        let status = emp.status || "На работе"
        if (statusCounts.hasOwnProperty(status)) {
            statusCounts[status]++
        }
        let gender = emp.gender || "male"
        if (genderCounts.hasOwnProperty(gender)) {
            genderCounts[gender]++
        }
    })

    // График по статусам
    let statusCanvas = document.getElementById("statusChart")
    if (statusCanvas) {
        if (statusChart) statusChart.destroy()
        let ctx = statusCanvas.getContext("2d")
        statusChart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: [
                        "#00c853", "#00bcd4", "#2196f3", "#f44336",
                        "#757575", "#e91e63", "#00bfa5", "#5e35b1"
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "bottom" }
                }
            }
        })
    }

    // График по полу
    let genderCanvas = document.getElementById("genderChart")
    if (genderCanvas) {
        if (genderChart) genderChart.destroy()
        let ctx = genderCanvas.getContext("2d")
        genderChart = new Chart(ctx, {
            type: "pie",
            data: {
                labels: ["Мужской", "Женский"],
                datasets: [{
                    data: [genderCounts.male, genderCounts.female],
                    backgroundColor: ["#4facfe", "#f093fb"]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "bottom" }
                }
            }
        })
    }
}

// ============= ЭКСПОРТ В EXCEL =============
function exportExcel() {
    if (employees.length === 0) {
        alert("Нет данных для экспорта")
        return
    }

    let choice = prompt("Выберите тип экспорта:\n1 - Только женщины\n2 - Только мужчины\n3 - Общий экспорт\n\nВведите номер (1, 2 или 3):")

    if (!choice) return

    let filteredEmployees = []
    let fileName = ""

    if (choice === "1") {
        filteredEmployees = employees.filter(e => e.gender === "female")
        fileName = "employees_female"
    } else if (choice === "2") {
        filteredEmployees = employees.filter(e => e.gender === "male")
        fileName = "employees_male"
    } else if (choice === "3") {
        filteredEmployees = employees
        fileName = "employees_all"
    } else {
        alert("Неверный выбор. Введите 1, 2 или 3")
        return
    }

    if (filteredEmployees.length === 0) {
        alert("Нет сотрудников для выбранного типа экспорта")
        return
    }

    try {
        let data = filteredEmployees.map(emp => ({
            "ФИО": emp.name || "",
            "Телефон": emp.phone || "",
            "Статус": emp.status || "На работе",
            "Пол": emp.gender === "male" ? "Мужской" : "Женский",
            "Оператор": emp.operator || "",
            "Адрес": emp.address || "",
            "Дата приёма": emp.date || "",
            "Дата рождения": emp.birthday || "",
            "Период": emp.dateRange || "",
            "Смена": getEmployeeShift(emp.name) || "",
            "Режим": (WORK_TYPES[getEmployeeWorkType(emp.name)] || {}).name || ""
        }))

        let ws = XLSX.utils.json_to_sheet(data)
        let wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Сотрудники")
        XLSX.writeFile(wb, fileName + "_" + new Date().toISOString().slice(0,10) + ".xlsx")

        console.log("Экспорт в Excel выполнен:", fileName)
    } catch (e) {
        console.error("Ошибка экспорта:", e)
        alert("Ошибка экспорта: " + e.message)
    }
}

// Показать/скрыть статистику из шапки
function toggleStats() {
    let stats = document.getElementById("stats")
    let arrow = document.getElementById("statsToggleArrow")
    if (!stats) return

    if (stats.style.display === "none") {
        stats.style.display = "block"
        if (arrow) arrow.textContent = "▼"
    } else {
        stats.style.display = "none"
        if (arrow) arrow.textContent = "▶"
    }
}

// Показать/скрыть диаграммы
function toggleDiagrams() {
    let section = document.getElementById("chartsSection")
    if (!section) return

    if (section.style.display === "none") {
        section.style.display = "block"
        renderCharts()
    } else {
        section.style.display = "none"
    }
}
