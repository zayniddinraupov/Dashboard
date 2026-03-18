let role = ""
let employees = []
let globalPhoto = "https://i.ibb.co/cVn0mgx/photo-2024-12-01-12-00-00.jpg"
let db = null

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
    "bahodir": { password: "2222", name: "Баходир" }
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
    
    // Устанавливаем текущего сотрудника
    currentEmployee = { login: login, name: empData.name }
    
    // Загружаем историю перерывов для ЭТОГО сотрудника
    loadEmployeeBreaks()
    
    // Загружаем активный перерыв для ЭТОГО сотрудника
    loadEmployeeActiveBreak()
    
    document.getElementById("employeeLoginPage").style.display = "none"
    document.getElementById("employeeDashboard").classList.remove("hidden")
    document.getElementById("empName").textContent = " | " + empData.name
    
    // Устанавливаем тип работы
    let workType = getEmployeeWorkType(empData.name)
    document.getElementById("workTypeSelect").value = workType
    
    // Показываем информацию о смене
    renderShiftInfo()
    
    // Показываем кто на перерыве
    showOtherBreaks()
    
    // Применяем тему
    loadTheme()
}

// Изменить тип рабочего времени
function changeWorkType() {
    if (!currentEmployee || !currentEmployee.name) return
    
    let workType = document.getElementById("workTypeSelect").value
    setEmployeeWorkType(currentEmployee.name, workType)
    
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
                alert(`Загрузка завершена!\n👥 Сотрудников: ${employees.length}\n📋 Отсутствий: ${absences.length}`)
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
                alert(`Загружено из резервной копии:\n👥 Сотрудников: ${employees.length}\n📋 Отсутствий: ${absences.length}`)
            } catch(e) {
                alert("Ошибка загрузки резервной копии")
            }
        } else {
            alert("JSONBin не настроен! Нажмите 'Настроить JSONBin' для настройки облачного хранилища.")
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
            document.getElementById("templateBtn").style.display = "inline-block"
            document.getElementById("chartsBtn").style.display = "inline-block"
            document.getElementById("timesheetBtn").style.display = "inline-block"
            document.getElementById("absencesBtn").style.display = "inline-block"
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
            document.getElementById("chartsBtn").style.display = "inline-block"
            document.getElementById("timesheetBtn").style.display = "inline-block"
            document.getElementById("absencesBtn").style.display = "inline-block"
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
    
    // Добавляем +998 если номер не начинается с него
    let phoneValue = newPhone.value.trim()
    if (phoneValue && !phoneValue.startsWith("+998") && !phoneValue.startsWith("998")) {
        phoneValue = "+998" + phoneValue.replace(/^0+/, '')
    }
    
    // Не добавляем фото автоматически - только если явно установлено
    // Это экономит место для 50+ сотрудников
    let photoUrl = "" // Пустое фото по умолчанию
    let status = newStatus.value
    let dateFrom = document.getElementById("newDateFrom").value
    let dateTo = document.getElementById("newDateTo").value
    let firedDate = document.getElementById("newFiredDate").value
    let dateRange = ""
    if ((status === "Учёба" || status === "Отпуск" || status === "Больничный") && dateFrom && dateTo) {
        dateRange = dateFrom + " - " + dateTo
    } else if (status === "Увольнение" && firedDate) {
        dateRange = "Уволен: " + firedDate
    }
    employees.push({
        name: newName.value,
        phone: phoneValue,
        operator: newOperator.value,
        address: newAddress.value,
        date: newDate.value,
        birthday: document.getElementById("newBirthday").value,
        status: status,
        photo: photoUrl,
        gender: newGender.value,
        dateRange: dateRange
    })
    
    // Сортировка по алфавиту по имени
    employees.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    
    saveData()
    renderEmployees()
    newName.value = ""
    newPhone.value = ""
    newOperator.value = ""
    newAddress.value = ""
    newDate.value = ""
    document.getElementById("newPhoto").value = ""
    document.getElementById("newBirthday").value = ""
    document.getElementById("newDateFrom").value = ""
    document.getElementById("newDateTo").value = ""
    document.getElementById("newFiredDate").value = ""
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
    list.innerHTML = ""
    employees.filter(e => {
        let matchName = e.name.toLowerCase().includes(searchQuery)
        let matchPhone = e.phone?.toLowerCase().includes(searchQuery)
        let matchOperator = e.operator?.toLowerCase().includes(searchQuery)
        let matchGender = !genderFilter || e.gender === genderFilter
        return (matchName || matchPhone || matchOperator) && matchGender
    })
        .forEach((emp, i) => {
            let div = document.createElement("div")
            div.className = "employee " + getClass(emp.status)
            let dateRangeHtml = emp.dateRange ? `<p style="color:#e74c3c;font-weight:bold;margin:5px 0;">📅 Период: ${emp.dateRange}</p>` : ""
            // Показываем заглушку если фото пустое
            let photoHtml = emp.photo && emp.photo.length > 10 
                ? `<img src="${emp.photo}" onerror="this.style.display='none'">` 
                : `<div class="avatar-placeholder">${emp.name.charAt(0).toUpperCase()}</div>`
            div.innerHTML = `
<div class="employee-header">
<div class="employee-info">
${photoHtml}
<div>
<h3>${emp.name}</h3>
${role === "admin" ? `
<select class="status-select ${getClass(emp.status)}" onchange="changeStatus(${i},this.value)">
<option value="На работе" ${emp.status === "На работе" ? "selected" : ""}>На работе</option>
<option value="Учёба" ${emp.status === "Учёба" ? "selected" : ""}>Учёба</option>
<option value="Отпуск" ${emp.status === "Отпуск" ? "selected" : ""}>Отпуск</option>
<option value="Больничный" ${emp.status === "Больничный" ? "selected" : ""}>Больничный</option>
<option value="Без содержания" ${emp.status === "Без содержания" ? "selected" : ""}>Без содержания</option>
<option value="Декрет" ${emp.status === "Декрет" ? "selected" : ""}>Декрет</option>
<option value="Армия" ${emp.status === "Армия" ? "selected" : ""}>Армия</option>
<option value="Увольнение" ${emp.status === "Увольнение" ? "selected" : ""}>Увольнение</option>
</select>
`: `<span class="status-view ${getClass(emp.status)}">${emp.status}</span>`}
${dateRangeHtml}
</div>
</div>
<div>
${role === "admin" ? `
<button class="edit" onclick="editEmployee(${i})">Редактировать</button>
<button class="edit" onclick="editPhoto(${i})">Изменить фото</button>
<button class="delete" onclick="deleteEmployee(${i})">Удалить</button>
`: ""}
</div>
</div>
<p><b class="editable" onclick="editField(${i},'operator')">Оператор:</b> ${emp.operator || "Нет"}</p>
<button class="toggle-extra-btn" onclick="toggleEmployeeExtra(${i})">📋 Подробнее</button>
<div id="extra-${i}" style="display:none">
<p><b class="editable" onclick="editField(${i},'phone')">📱 Телефон:</b> ${emp.phone}</p>
<p><b class="editable" onclick="editField(${i},'address')">🏠 Адрес:</b> ${emp.address || "Нет"}</p>
<p><b class="editable" onclick="editField(${i},'date')">📅 Дата приёма:</b> ${emp.date || "Нет"}</p>
<p><b class="editable" onclick="editField(${i},'birthday')">🎂 Дата рождения:</b> ${emp.birthday || "Нет"}</p>
<p><b class="editable" onclick="editField(${i},'gender')">👤 Пол:</b> ${emp.gender === "male" ? "👨‍💼 Мужской" : "👩‍💼 Женский"}</p>
</div>
`
            list.appendChild(div)
        })
    updateStats()
}

function getClass(status) {
    return {
        "На работе": "work",
        "Учёба": "study",
        "Отпуск": "vacation",
        "Больничный": "sick",
        "Без содержания": "unpaid",
        "Декрет": "maternity",
        "Армия": "army",
        "Увольнение": "fired"
    }[status]
}

function updateStats() {
    let stats = { "На работе": 0, "Учёба": 0, "Отпуск": 0, "Больничный": 0, "Без содержания": 0, "Декрет": 0, "Армия": 0, "Увольнение": 0 }
    let male = 0, female = 0
    employees.forEach(e => {
        let status = e.status || "На работе"
        stats[status]++
        if (e.gender === "male") male++
        if (e.gender === "female") female++
    })
    document.getElementById("stats").innerHTML = `
<div class="stat-box" onclick="filterByStat('all')" style="cursor:pointer" title="Показать всех">Всего<span>${employees.length}</span></div>
<div class="stat-box" onclick="filterByStat('male')" style="cursor:pointer" title="Показать мужчин">Мужчин<span>${male}</span></div>
<div class="stat-box" onclick="filterByStat('female')" style="cursor:pointer" title="Показать женщин">Женщин<span>${female}</span></div>
<div class="stat-box" onclick="filterByStat('На работе')" style="cursor:pointer" title="Показать на работе">На работе<span>${stats["На работе"]}</span></div>
<div class="stat-box" onclick="filterByStat('Учёба')" style="cursor:pointer" title="Показать на учёбе">Учёба<span>${stats["Учёба"]}</span></div>
<div class="stat-box" onclick="filterByStat('Отпуск')" style="cursor:pointer" title="Показать в отпуске">Отпуск<span>${stats["Отпуск"]}</span></div>
<div class="stat-box" onclick="filterByStat('Больничный')" style="cursor:pointer" title="Показать на больничном">Больничный<span>${stats["Больничный"]}</span></div>
<div class="stat-box" onclick="filterByStat('Без содержания')" style="cursor:pointer" title="Показать без содержания">Без содержания<span>${stats["Без содержания"]}</span></div>
<div class="stat-box" onclick="filterByStat('Декрет')" style="cursor:pointer" title="Показать в декрете">Декрет<span>${stats["Декрет"]}</span></div>
<div class="stat-box" onclick="filterByStat('Армия')" style="cursor:pointer" title="Показать в армии">Армия<span>${stats["Армия"]}</span></div>
`
}

// Показать сотрудников по фильтру
function filterByStat(filter) {
    let filtered = []
    let title = ""
    
    if (filter === 'all') {
        filtered = [...employees]
        title = "👥 Все сотрудники"
    } else if (filter === 'male') {
        filtered = employees.filter(e => e.gender === 'male')
        title = "👨 Мужчины"
    } else if (filter === 'female') {
        filtered = employees.filter(e => e.gender === 'female')
        title = "👩 Женщины"
    } else {
        filtered = employees.filter(e => e.status === filter)
        let icons = {
            "На работе": "💼",
            "Учёба": "📚",
            "Отпуск": "🏖️",
            "Больничный": "🏥",
            "Без содержания": "💰",
            "Декрет": "👶",
            "Армия": "🎖️",
            "Увольнение": "❌"
        }
        title = `${icons[filter] || "📋"} ${filter}`
    }
    
    if (filtered.length === 0) {
        alert("Нет сотрудников по этому критерию!")
        return
    }
    
    // Создаём модальное окно
    let modal = document.createElement("div")
    modal.className = "modal-overlay"
    modal.id = "filterModal"
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:10000;"
    modal.onclick = function(e) {
        if (e.target === modal) modal.remove()
    }
    
    let listHtml = filtered.map(emp => {
        let statusClass = getClass(emp.status)
        return `
            <div style="display:flex;align-items:center;gap:15px;padding:15px;background:white;border-radius:10px;margin-bottom:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <div style="width:50px;height:50px;border-radius:50%;background:#667eea;color:white;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;">
                    ${emp.name.charAt(0).toUpperCase()}
                </div>
                <div style="flex:1;">
                    <div style="font-weight:bold;font-size:16px;">${emp.name}</div>
                    <div style="color:#666;font-size:13px;">📱 ${emp.phone || "нет"}</div>
                </div>
                <div>
                    <span class="status-view ${statusClass}" style="padding:5px 12px;border-radius:20px;font-size:13px;">${emp.status}</span>
                </div>
            </div>
        `
    }).join("")
    
    modal.innerHTML = `
        <div style="background:white;padding:25px;border-radius:15px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="margin:0;color:#667eea;">${title}</h3>
                <button onclick="document.getElementById('filterModal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;">✕</button>
            </div>
            <div style="margin-bottom:15px;color:#666;">
                📊 Показано: ${filtered.length} из ${employees.length} сотрудников
            </div>
            ${listHtml}
            <button onclick="document.getElementById('filterModal').remove()" style="margin-top:15px;width:100%;padding:12px;background:#667eea;color:white;border:none;border-radius:10px;cursor:pointer;font-size:14px;">Закрыть</button>
        </div>
    `
    document.body.appendChild(modal)
}

function exportExcel() {
    if (role !== "admin") { alert("Нет доступа"); return }
    
    // Спросить что экспортировать
    let choice = prompt("Выберите категорию для экспорта:\n1 - Все сотрудники\n2 - Только мужчины\n3 - Только женщины\n\nВведите номер:")
    
    if (!choice) return
    
    let filteredEmployees = []
    if (choice === "1") {
        filteredEmployees = employees
    } else if (choice === "2") {
        filteredEmployees = employees.filter(e => e.gender === "male")
    } else if (choice === "3") {
        filteredEmployees = employees.filter(e => e.gender === "female")
    } else {
        alert("Неверный выбор!")
        return
    }
    
    if (filteredEmployees.length === 0) {
        alert("Нет сотрудников для экспорта!")
        return
    }
    
    if (typeof XLSX === "undefined") {
        alert("Загрузка библиотеки...")
        let script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"
        script.onload = function () { performExport(filteredEmployees) }
        document.head.appendChild(script)
        return
    }
    performExport(filteredEmployees)
}

function performExport(data) {
    try {
        let exportData = data.map(e => ({
            "ФИО": e.name,
            "Телефон": e.phone,
            "Оператор": e.operator,
            "Адрес": e.address,
            "Дата приёма": e.date,
            "Статус": e.status,
            "Период": e.dateRange || "",
            "Пол": e.gender === "male" ? "Мужской" : "Женский"
        }))
        let wb = XLSX.utils.book_new()
        let ws = XLSX.utils.json_to_sheet(exportData)
        XLSX.utils.book_append_sheet(wb, ws, "Сотрудники")
        XLSX.writeFile(wb, "HR_Report.xlsx")
    } catch (err) {
        alert("Ошибка: " + err.message)
    }
}

// ============= НОВЫЕ ФУНКЦИИ =============

// Графики
let statusChart = null
let genderChart = null
let chartsVisible = false

function toggleCharts() {
    let section = document.getElementById("chartsSection")
    chartsVisible = !chartsVisible
    section.style.display = chartsVisible ? "block" : "none"
    if (chartsVisible && employees.length > 0) {
        renderCharts()
    }
}

function renderCharts() {
    if (employees.length === 0) return
    
    // Статистика по статусам
    let statusStats = {}
    employees.forEach(emp => {
        let status = emp.status || "На работе"
        statusStats[status] = (statusStats[status] || 0) + 1
    })
    
    // Статистика по полу
    let male = employees.filter(e => e.gender === "male").length
    let female = employees.filter(e => e.gender === "female").length
    
    // График статусов
    let ctxStatus = document.getElementById("statusChart").getContext("2d")
    if (statusChart) statusChart.destroy()
    statusChart = new Chart(ctxStatus, {
        type: "doughnut",
        data: {
            labels: Object.keys(statusStats),
            datasets: [{
                data: Object.values(statusStats),
                backgroundColor: [
                    "#43e97b", "#a8edea", "#4facfe", "#fa709a", 
                    "#a8a8a8", "#f093fb", "#38f9d7", "#667eea"
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: "bottom" } }
        }
    })
    
    // График пола
    let ctxGender = document.getElementById("genderChart").getContext("2d")
    if (genderChart) genderChart.destroy()
    genderChart = new Chart(ctxGender, {
        type: "pie",
        data: {
            labels: ["Мужчины", "Женщины"],
            datasets: [{
                data: [male, female],
                backgroundColor: ["#667eea", "#f093fb"]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: "bottom" } }
        }
    })
}

// Уведомления
function checkNotifications() {
    if (employees.length === 0) return
    
    let today = new Date()
    let notifications = []
    
    employees.forEach(emp => {
        // Дни рождения
        if (emp.birthday) {
            let parts = emp.birthday.split(".")
            if (parts.length === 3) {
                let bday = new Date(parts[2], parts[1] - 1, parts[0])
                bday.setFullYear(today.getFullYear())
                
                let diffTime = bday - today
                let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                
                if (diffDays >= 0 && diffDays <= 7) {
                    notifications.push(`🎂 День рождения у ${emp.name} через ${diffDays} дн.`)
                }
            }
        }
        
        // Окончание отпуска
        if (emp.status === "Отпуск" && emp.dateRange) {
            let dates = emp.dateRange.split(" - ")
            if (dates.length === 2) {
                let dateTo = new Date(dates[1].split(".").reverse().join("-"))
                let diffTime = dateTo - today
                let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                
                if (diffDays >= 0 && diffDays <= 3) {
                    notifications.push(`📅 У ${emp.name} отпуск до ${dates[1]}`)
                }
            }
        }
    })
        
    // Показываем уведомления с кнопкой закрытия
    let notifDiv = document.getElementById("notifications")
    if (notifications.length > 0) {
        notifDiv.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:bold;">🔔 Уведомления</span>
                <button onclick="this.parentElement.parentElement.style.display='none'" style="background:none;border:none;cursor:pointer;font-size:18px;">✓</button>
            </div>
            ${notifications.map(n => `<div class="notif-item">${n}</div>`).join("")}`
        notifDiv.style.display = "block"
    } else {
        notifDiv.style.display = "none"
    }
}

// Показывать уведомления при загрузке
let originalRenderEmployees = renderEmployees
renderEmployees = function() {
    originalRenderEmployees()
    setTimeout(() => {
        checkNotifications()
    }, 100)
}

// ============= ШАБЛОНЫ =============
let templates = [
    { name: "Обычный сотрудник", status: "На работе" },
    { name: "В отпуске", status: "Отпуск", dateRange: "01.01.2025 - 15.01.2025" },
    { name: "На больничном", status: "Больничный", dateRange: "10.01.2025 - 14.01.2025" },
    { name: "Декрет", status: "Декрет", dateRange: "01.01.2025 - 31.12.2025" },
    { name: "Уволен", status: "Увольнение", dateRange: "Уволен: 31.12.2024" }
]

function showTemplates() {
    if (role !== "admin") { alert("Нет доступа"); return }
    
    let templateList = templates.map((t, i) => `${i + 1}. ${t.name} - ${t.status}`).join("\n")
    let choice = prompt(`Выберите шаблон:\n\n${templateList}\n\nВведите номер:`)
    
    if (!choice) return
    let index = parseInt(choice) - 1
    
    if (index >= 0 && index < templates.length) {
        let t = templates[index]
        document.getElementById("newStatus").value = t.status
        toggleDateRange()
        
        if (t.dateRange) {
            let dates = t.dateRange.split(" - ")
            if (dates.length === 2) {
                document.getElementById("newDateFrom").value = dates[0]
                document.getElementById("newDateTo").value = dates[1]
            } else if (t.dateRange.startsWith("Уволен:")) {
                document.getElementById("newFiredDate").value = t.dateRange.replace("Уволен: ", "")
            }
        }
        
        // Показываем форму
        let addSection = document.getElementById("addSection")
        addSection.classList.remove("hidden")
        document.getElementById("addBtn").textContent = "✕ Скрыть форму"
        
        alert(`Шаблон "${t.name}" применён! Заполните остальные поля.`)
    } else {
        alert("Неверный номер шаблона")
    }
}

// ============= ВНУТРЕННИЙ ЧАТ =============
let chatMessages = []
let chatUnread = 0
let lastReadMessageId = null

// Инициализация чата
function initChat() {
    console.log("initChat вызван!")
    // Загружаем ID последнего прочитанного сообщения
    lastReadMessageId = localStorage.getItem("lastReadMessageId")
    
    // Загружаем сообщения из localStorage
    loadChatFromLocal()
    
    // Слушаем изменения localStorage из других вкладок
    window.addEventListener('storage', function(e) {
        if (e.key === 'chatMessages') {
            try {
                let newMessages = JSON.parse(e.newValue)
                if (newMessages && JSON.stringify(newMessages) !== JSON.stringify(chatMessages)) {
                    let oldLength = chatMessages.length
                    chatMessages = newMessages
                    
                    // Если чат закрыт - показываем уведомление
                    let panel = document.getElementById("chatPanel")
                    if (panel && panel.classList.contains("hidden")) {
                        if (newMessages.length > oldLength) {
                            chatUnread++
                            updateChatBadge()
                            // Показываем визуальное уведомление
                            showNewMessageAlert()
                        }
                    }
                    
                    renderChatMessages()
                    updateUnreadCount()
                }
            } catch (err) {
                console.log("Ошибка чтения сообщений:", err)
            }
        }
    })
    
    // Запускаем периодическую проверку новых сообщений (для нескольких вкладок)
    setInterval(checkForNewMessages, 2000)
}

// Показать уведомление о новом сообщении
function showNewMessageAlert() {
    let lastMsg = chatMessages[chatMessages.length - 1]
    if (!lastMsg) return
    
    // Создаем временное уведомление
    let notification = document.createElement('div')
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `
    notification.innerHTML = `
        <div style="font-weight: bold;">💬 Новое сообщение</div>
        <div style="font-size: 13px; opacity: 0.9;">${lastMsg.author}: ${lastMsg.text.substring(0, 30)}${lastMsg.text.length > 30 ? '...' : ''}</div>
    `
    document.body.appendChild(notification)
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.remove()
    }, 3000)
}

// Загрузить сообщения из localStorage
function loadChatFromLocal() {
    let saved = localStorage.getItem("chatMessages")
    if (saved) {
        try {
            chatMessages = JSON.parse(saved)
        } catch (e) {
            chatMessages = []
        }
    }
    renderChatMessages()
    updateUnreadCount()
}

// Проверка новых сообщений (для синхронизации между вкладками)
function checkForNewMessages() {
    let saved = localStorage.getItem("chatMessages")
    if (saved) {
        try {
            let newMessages = JSON.parse(saved)
            if (JSON.stringify(newMessages) !== JSON.stringify(chatMessages)) {
                let oldLength = chatMessages.length
                chatMessages = newMessages
                
                // Если чат закрыт - показываем уведомление
                let panel = document.getElementById("chatPanel")
                if (panel && panel.classList.contains("hidden")) {
                    if (newMessages.length > oldLength) {
                        chatUnread++
                        updateChatBadge()
                    }
                }
                
                renderChatMessages()
                updateUnreadCount()
            }
        } catch (e) {
            console.log("Ошибка чтения сообщений:", e)
        }
    }
}

// Обновить счётчик непрочитанных
function updateUnreadCount() {
    if (!lastReadMessageId || chatMessages.length === 0) {
        chatUnread = 0
        updateChatBadge()
        return
    }

    // Считаем сообщения после последнего прочитанного
    let lastIndex = chatMessages.findIndex(m => m.id === lastReadMessageId)
    if (lastIndex >= 0 && lastIndex < chatMessages.length - 1) {
        chatUnread = chatMessages.length - 1 - lastIndex
    } else if (lastIndex < 0) {
        chatUnread = chatMessages.length
    }
    updateChatBadge()
}

// Отправить сообщение
function sendChatMessage() {
    let input = document.getElementById("chatInput")
    if (!input) return
    
    let text = input.value.trim()
    if (!text) return
    
    // Определяем имя отправителя
    let senderName = "Админ"
    if (currentEmployee) {
        senderName = currentEmployee.name
    }
    
    let message = {
        id: Date.now().toString(),
        text: text,
        author: senderName,
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now()
    }
    
    // Добавляем сообщение
    chatMessages.push(message)
    saveChatToLocal()
    renderChatMessages()
    
    input.value = ""
    
    // Прокрутить вниз
    setTimeout(() => {
        let messagesDiv = document.getElementById("chatMessages")
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight
        }
    }, 100)
}

// Сохранить сообщения в localStorage и облако
function saveChatToLocal() {
    localStorage.setItem("chatMessages", JSON.stringify(chatMessages))
    // Также сохраняем в облако для синхронизации между ПК
    saveToCloud()
}

// Переключить чат
function toggleChat() {
    console.log("toggleChat вызван!")
    let panel = document.getElementById("chatPanel")
    if (!panel) {
        console.log("Панель чата не найдена!")
        alert("Ошибка: панель чата не найдена")
        return
    }
    
    console.log("Панель найдена, текущий display:", panel.style.display, "класс hidden:", panel.classList.contains("hidden"))
    
    let isHidden = panel.style.display === "none" || panel.classList.contains("hidden")
    
    if (isHidden) {
        panel.classList.remove("hidden")
        panel.style.display = "flex"
        chatUnread = 0
        updateChatBadge()
        renderChatMessages()
        
        // Сохраняем ID последнего сообщения как прочитанное
        if (chatMessages.length > 0) {
            let lastMsg = chatMessages[chatMessages.length - 1]
            lastReadMessageId = lastMsg.id
            localStorage.setItem("lastReadMessageId", lastReadMessageId)
        }
        
        // Прокрутить вниз
        setTimeout(() => {
            let messagesDiv = document.getElementById("chatMessages")
            if (messagesDiv) {
                messagesDiv.scrollTop = messagesDiv.scrollHeight
            }
        }, 100)
    } else {
        panel.classList.add("hidden")
        panel.style.display = "none"
        // Сохраняем ID последнего сообщения как прочитанное
        if (chatMessages.length > 0) {
            let lastMsg = chatMessages[chatMessages.length - 1]
            lastReadMessageId = lastMsg.id
            localStorage.setItem("lastReadMessageId", lastReadMessageId)
        }
    }
}

// Обработка Enter в чате
function handleChatKeypress(event) {
    if (event.key === "Enter") {
        sendChatMessage()
    }
}

// Отобразить сообщения
function renderChatMessages() {
    let container = document.getElementById("chatMessages")
    if (!container) return
    
    if (chatMessages.length === 0) {
        container.innerHTML = '<div class="chat-empty">💬 Начните общение!<br>Сообщений пока нет.</div>'
        return
    }
    
    let currentUser = currentEmployee ? currentEmployee.name : "Админ"
    
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

// Обновить счётчик непрочитанных
function updateChatBadge() {
    let badges = document.querySelectorAll(".chat-badge")
    badges.forEach(badge => {
        if (chatUnread > 0) {
            badge.textContent = chatUnread > 9 ? "9+" : chatUnread
            badge.style.display = "block"
        } else {
            badge.style.display = "none"
        }
    })
}

// Защита от XSS
function escapeHtml(text) {
    let div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}

// Инициализация чата - вызываем сразу после загрузки скрипта
function initChatWhenReady() {
    if (document.getElementById("chatPanel")) {
        initChat()
    } else {
        setTimeout(initChatWhenReady, 100)
    }
}

// Запускаем проверку
initChatWhenReady()

// ============= 1. УВЕДОМЛЕНИЯ В БРАУЗЕРЕ =============
// Запросить разрешение на уведомления
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        alert("Этот браузер не поддерживает уведомления!")
        return
    }
    
    if (Notification.permission === "granted") {
        return true
    }
    
    if (Notification.permission !== "denied") {
        let permission = Notification.requestPermission()
        return permission === "granted"
    }
    
    return false
}

// Показать уведомление
function showBrowserNotification(title, body, icon = "💬") {
    if (Notification.permission === "granted") {
        new Notification(title, {
            body: body,
            icon: icon,
            badge: "/favicon.ico",
            tag: "hr-dashboard",
            requireInteraction: false
        })
    }
}

// Проверять уведомления каждую минуту
setInterval(function() {
    // Проверяем новые сообщения в чате
    let panel = document.getElementById("chatPanel")
    if (panel && !panel.classList.contains("hidden")) return // Если чат открыт - не уведомляем
    
    let saved = localStorage.getItem("chatMessages")
    if (saved && chatMessages.length > 0) {
        try {
            let newMessages = JSON.parse(saved)
            if (newMessages.length > chatMessages.length) {
                let lastMsg = newMessages[newMessages.length - 1]
                let currentUser = currentEmployee ? currentEmployee.name : "Админ"
                if (lastMsg.author !== currentUser) {
                    showBrowserNotification(
                        "💬 Новое сообщение",
                        `${lastMsg.author}: ${lastMsg.text.substring(0, 50)}`
                    )
                }
            }
        } catch (e) {}
    }
    
    // Проверяем когда сотрудник вернулся с перерыва
    let activeBreaks = getActiveBreaks()
    let now = Date.now()
    let savedReturned = localStorage.getItem("returnedBreaks") || "[]"
    try {
        let returned = JSON.parse(savedReturned)
        activeBreaks.forEach(brk => {
            if (brk.endTime <= now && !returned.includes(brk.name + brk.startTimestamp)) {
                // Сотрудник вернулся!
                showBrowserNotification(
                    "✅ Сотрудник вернулся",
                    `${brk.name} закончил перерыв (${brk.type})`
                )
                returned.push(brk.name + brk.startTimestamp)
            }
        })
        localStorage.setItem("returnedBreaks", JSON.stringify(returned))
    } catch (e) {}
        
}, 60000) // Каждую минуту

// ============= 2. СТАТИСТИКА ПЕРЕРЫВОВ ДЛЯ СОТРУДНИКА =============
// Добавить кнопку статистики в панель сотрудника
function showBreakStats() {
    if (!currentEmployee || !currentEmployee.name) {
        alert("Войдите как сотрудник!")
        return
    }
    
    let breaks = employeeBreaks
    if (breaks.length === 0) {
        alert("У вас пока нет перерывов!")
        return
    }
    
    // Подсчёт статистики
    let totalBreaks = breaks.length
    let totalMinutes = breaks.reduce((sum, b) => sum + (b.duration || 0), 0)
    let totalHours = (totalMinutes / 60).toFixed(1)
    
    // По типам
    let byType = {}
    breaks.forEach(b => {
        byType[b.type] = (byType[b.type] || 0) + 1
    })
    
    // За эту неделю
    let weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    let thisWeekBreaks = breaks.filter(b => b.timestamp && b.timestamp > weekAgo)
    let thisWeekMinutes = thisWeekBreaks.reduce((sum, b) => sum + (b.duration || 0), 0)
    
    // За этот месяц
    let monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    let thisMonthBreaks = breaks.filter(b => b.timestamp && b.timestamp > monthAgo)
    let thisMonthMinutes = thisMonthBreaks.reduce((sum, b) => sum + (b.duration || 0), 0)
    
    // Формируем сообщение
    let typeStats = Object.entries(byType).map(([type, count]) => 
        `${getBreakIcon(type)} ${type}: ${count} раз`
    ).join("\n")
    
    let statsText = `📊 ВАША СТАТИСТИКА ПЕРЕРЫВОВ

══════════════════════
📈 ОБЩАЯ СТАТИСТИКА
══════════════════════
Всего перерывов: ${totalBreaks}
Общее время: ${totalMinutes} мин (${totalHours} ч)

📅 ЭТА НЕДЕЛЯ:
Перерывов: ${thisWeekBreaks.length}
Время: ${thisWeekMinutes} мин

📆 ЭТОТ МЕСЯЦ:
Перерывов: ${thisMonthBreaks.length}
Время: ${thisMonthMinutes} мин (${(thisMonthMinutes/60).toFixed(1)} ч)

══════════════════════
🍽 ПО ТИПАМ ПЕРЕРЫВОВ:
══════════════════════
${typeStats}
`
    
    alert(statsText)
}

// ============= 3. ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ =============
// Отметить приход на работу
function checkIn() {
    if (!currentEmployee || !currentEmployee.name) {
        alert("Войдите как сотрудник!")
        return
    }
    
    let now = new Date()
    let checkInData = {
        name: currentEmployee.name,
        date: now.toLocaleDateString("ru-RU"),
        checkIn: now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        checkOut: null,
        timestamp: now.getTime()
    }
    
    // Сохраняем в localStorage
    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    workDays.push(checkInData)
    localStorage.setItem("workDays", JSON.stringify(workDays))
    
    alert(`✅ Вы отметились!\n\nДата: ${checkInData.date}\nПриход: ${checkInData.checkIn}`)
}

// Отметить уход с работы
function checkOut() {
    if (!currentEmployee || !currentEmployee.name) {
        alert("Войдите как сотрудник!")
        return
    }
    
    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    let today = new Date().toLocaleDateString("ru-RU")
    
    // Находим сегодняшнюю запись без ухода
    let todayEntry = workDays.find(d => d.date === today && d.name === currentEmployee.name && !d.checkOut)
    
    if (!todayEntry) {
        alert("Вы ещё не отмечали приход сегодня!")
        return
    }
    
    let now = new Date()
    todayEntry.checkOut = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    
    // Считаем отработанные часы
    let checkInTime = new Date(today + " " + todayEntry.checkIn).getTime()
    let checkOutTime = now.getTime()
    let workedMinutes = Math.round((checkOutTime - checkInTime) / 60000)
    let workedHours = (workedMinutes / 60).toFixed(1)
    
    todayEntry.workedMinutes = workedMinutes
    
    localStorage.setItem("workDays", JSON.stringify(workDays))
    
    alert(`✅ Уход отмечен!\n\nДата: ${todayEntry.date}\nПриход: ${todayEntry.checkIn}\nУход: ${todayEntry.checkOut}\nОтработано: ${workedHours} ч`)
}

// Показать табель за период
function showTimeSheet() {
    if (!currentEmployee || !currentEmployee.name) {
        alert("Войдите как сотрудник!")
        return
    }
    
    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    let myDays = workDays.filter(d => d.name === currentEmployee.name)
    
    if (myDays.length === 0) {
        alert("У вас пока нет записей о рабочем времени!")
        return
    }
    
    // За последние 30 дней
    let monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    let recentDays = myDays.filter(d => d.timestamp > monthAgo)
    
    // Подсчёт
    let totalMinutes = recentDays.reduce((sum, d) => sum + (d.workedMinutes || 0), 0)
    let totalHours = (totalMinutes / 60).toFixed(1)
    let daysWorked = recentDays.filter(d => d.checkOut).length
    
    // Список за последние 7 дней
    let weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    let weekDays = recentDays.filter(d => d.timestamp > weekAgo).slice(-7)
    
    let daysList = weekDays.map(d => {
        let hours = d.workedMinutes ? (d.workedMinutes / 60).toFixed(1) : "-"
        return `${d.date}: ${d.checkIn || "?"} - ${d.checkOut || "?"} (${hours} ч)`
    }).join("\n")
    
    let text = `📋 ВАШ ТАБЕЛЬ РАБОЧЕГО ВРЕМЕНИ

══════════════════════
📊 СТАТИСТИКА (30 дней)
══════════════════════
Отработано дней: ${daysWorked}
Общее время: ${totalHours} ч
Среднее в день: ${daysWorked > 0 ? (totalHours/daysWorked).toFixed(1) : 0} ч

══════════════════════
📅 ПОСЛЕДНИЕ 7 ДНЕЙ
══════════════════════
${daysList || "Нет данных"}

══════════════════════
📆 ЭКСПОРТ В EXCEL
══════════════════════
Нажмите "Экспорт табеля" для скачивания
`
    
    alert(text)
}

// Экспорт табеля в Excel
function exportTimeSheet() {
    if (!currentEmployee || !currentEmployee.name) {
        alert("Войдите как сотрудник!")
        return
    }
    
    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    let myDays = workDays.filter(d => d.name === currentEmployee.name)
    
    if (myDays.length === 0) {
        alert("Нет данных для экспорта!")
        return
    }
    
    if (typeof XLSX === "undefined") {
        alert("Загрузка библиотеки...")
        let script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"
        script.onload = function() { performTimeSheetExport(myDays) }
        document.head.appendChild(script)
        return
    }
    
    performTimeSheetExport(myDays)
}

function performTimeSheetExport(data) {
    try {
        let exportData = data.map(d => ({
            "Дата": d.date,
            "Приход": d.checkIn || "-",
            "Уход": d.checkOut || "-",
            "Отработано (ч)": d.workedMinutes ? (d.workedMinutes / 60).toFixed(1) : "-",
            "Сотрудник": d.name
        }))
        
        let wb = XLSX.utils.book_new()
        let ws = XLSX.utils.json_to_sheet(exportData)
        XLSX.utils.book_append_sheet(wb, ws, "Табель")
        
        let fileName = `Табель_${currentEmployee.name}_${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.xlsx`
        XLSX.writeFile(wb, fileName)
    } catch (err) {
        alert("Ошибка: " + err.message)
    }
}

// ============= ТАБЕЛЬ ДЛЯ АДМИНА =============
// Показать общий табель всех сотрудников
function showAdminTimeSheet() {
    if (role !== "admin") {
        alert("Нет доступа!")
        return
    }

    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    
    if (workDays.length === 0) {
        alert("Пока никто не отмечался в табеле!")
        return
    }
    
    // Группируем по сотрудникам
    let employeesData = {}
    workDays.forEach(d => {
        if (!employeesData[d.name]) {
            employeesData[d.name] = []
        }
        employeesData[d.name].push(d)
    })
    
    // Статистика по каждому сотруднику
    let stats = Object.entries(employeesData).map(([name, days]) => {
        let completed = days.filter(d => d.checkOut)
        let totalMinutes = completed.reduce((sum, d) => sum + (d.workedMinutes || 0), 0)
        let totalHours = (totalMinutes / 60).toFixed(1)
        let avgPerDay = completed.length > 0 ? (totalHours / completed.length).toFixed(1) : 0
        
        return {
            name: name,
            daysWorked: completed.length,
            totalHours: totalHours,
            avgPerDay: avgPerDay,
            lastCheckIn: days[days.length - 1]?.checkIn || "-",
            lastDate: days[days.length - 1]?.date || "-"
        }
    })
    
    // Сортируем по количеству отработанных часов
    stats.sort((a, b) => parseFloat(b.totalHours) - parseFloat(a.totalHours))
    
    // Формируем текст
    let totalHoursAll = stats.reduce((sum, s) => sum + parseFloat(s.totalHours), 0).toFixed(1)
    let totalDaysAll = stats.reduce((sum, s) => sum + s.daysWorked, 0)
    
    let tableRows = stats.map(s => 
        `${s.name}:\n   Дней: ${s.daysWorked}, Часов: ${s.totalHours}, Среднее: ${s.avgPerDay} ч/день\n   Последний: ${s.lastDate} (${s.lastCheckIn})`
    ).join("\n\n")
    
    let text = `📋 ОБЩИЙ ТАБЕЛЬ РАБОЧЕГО ВРЕМЕНИ

══════════════════════
📊 ИТОГО ЗА ВСЕХ
══════════════════════
Отработано дней: ${totalDaysAll}
Отработано часов: ${totalHoursAll}

══════════════════════
📋 ПО СОТРУДНИКАМ
══════════════════════

${tableRows}

══════════════════════
📆 ЭКСПОРТ
══════════════════════
Нажмите "Экспорт табеля" для скачивания Excel
`
    
    alert(text)
}

// Экспорт общего табеля для админа
function exportAdminTimeSheet() {
    if (role !== "admin") {
        alert("Нет доступа!")
        return
    }
    
    let workDays = JSON.parse(localStorage.getItem("workDays") || "[]")
    
    if (workDays.length === 0) {
        alert("Нет данных для экспорта!")
        return
    }
    
    if (typeof XLSX === "undefined") {
        alert("Загрузка библиотеки...")
        let script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"
        script.onload = function() { performAdminTimeSheetExport(workDays) }
        document.head.appendChild(script)
        return
    }
    
    performAdminTimeSheetExport(workDays)
}

function performAdminTimeSheetExport(data) {
    try {
        // Сортируем по дате и сотруднику
        let sorted = [...data].sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date)
            return a.name.localeCompare(b.name)
        })
        
        let exportData = sorted.map(d => ({
            "Дата": d.date,
            "Сотрудник": d.name,
            "Приход": d.checkIn || "-",
            "Уход": d.checkOut || "-",
            "Отработано (ч)": d.workedMinutes ? (d.workedMinutes / 60).toFixed(1) : "-"
        }))
        
        let wb = XLSX.utils.book_new()
        let ws = XLSX.utils.json_to_sheet(exportData)
        XLSX.utils.book_append_sheet(wb, ws, "Табель")
        
        let fileName = `Общий_табель_${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.xlsx`
        XLSX.writeFile(wb, fileName)
    } catch (err) {
        alert("Ошибка: " + err.message)
    }
}

