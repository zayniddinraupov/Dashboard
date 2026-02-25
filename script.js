let role = ""
let employees = []
let globalPhoto = "https://i.ibb.co/cVn0mgx/photo-2024-12-01-12-00-00.jpg"
let db = null

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
const DB_VERSION = 1
const STORE_NAME = "employees"

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
        }
    })
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
}).catch(err => console.error(err))

// Переменные (будут определены при загрузке)
let login, password, newName, newPhone, newOperator, newAddress, newDate, newGender, newStatus, search, loginPage, mainPage

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
    
    // Инициализируем IndexedDB и загружаем данные
    initDB().then(() => {
        loadEmployeesFromDB().then(() => {
            renderEmployees()
        })
        
        let savedLogin = localStorage.getItem("savedLogin")
        let savedPassword = localStorage.getItem("savedPassword")
        if (savedLogin && savedPassword && login && password) {
            login.value = savedLogin
            password.value = savedPassword
            loginUser()
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

// Сохранение в облако (JSONBin.io)
function saveToCloud() {
    if (employees.length === 0) return
    
    let data = { employees: employees, globalPhoto: globalPhoto }
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
            console.log("✅ Сохранено в JSONBin")
        })
        .catch(err => console.log("❌ Ошибка сохранения в JSONBin:", err.message))
    } else {
        // Сохраняем только локально
        console.log("ℹ️ JSONBin не настроен. Данные сохранены локально в браузере.")
    }
}

// Загрузка из облака
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
            if (data.record && data.record.employees) {
                employees = data.record.employees
                saveEmployeesToDB()
                renderEmployees()
                console.log("✅ Загружено из JSONBin: " + employees.length + " сотрудников")
            }
        })
        .catch(err => console.log("❌ Ошибка загрузки из JSONBin:", err.message))
    } else {
        alert("JSONBin не настроен! Нажмите 'Настроить JSONBin' для настройки облачного хранилища.")
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
        
        // Автосинхронизация в облако с задержкой 2 секунды
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout)
        autoSaveTimeout = setTimeout(() => {
            saveToCloud()
            console.log("Автосохранение в облако выполнено")
        }, 2000)
    }).catch(err => {
        alert("Ошибка сохранения: " + err)
    })
}

// Сохранение при закрытии вкладки
window.addEventListener("beforeunload", function() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout)
    saveToGoogleSheet()
})
    
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
    // Проверяем, что элементы найдены
    if (!login || !password) {
        alert("Ошибка: страница не загружена. Обновите страницу.")
        return
    }
    
    if (login.value === "Zayniddin" && password.value === "3020") { role = "admin" }
    else if (login.value === "supervisor" && password.value === "12345") { role = "supervisor" }
    else { alert("Ошибка: неверный логин или пароль"); return }
    
    // Сохраняем логин
    localStorage.setItem("savedLogin", login.value)
    localStorage.setItem("savedPassword", password.value)
    
    // Загружаем глобальное фото
    let savedPhoto = localStorage.getItem("globalPhoto")
    if (savedPhoto) globalPhoto = savedPhoto
    
    // Загружаем сотрудников из IndexedDB
    loadEmployeesFromDB().then(() => {
        loginPage.classList.add("hidden")
        mainPage.classList.remove("hidden")
        if (role === "admin") {
            document.getElementById("addBtn").style.display = "inline-block"
            document.getElementById("templateBtn").style.display = "inline-block"
            document.getElementById("chartsBtn").style.display = "inline-block"
            document.getElementById("globalPhotoBtn").style.display = "inline-block"
            document.getElementById("syncBtn").style.display = "inline-block"
            document.getElementById("clearAllBtn").style.display = "inline-block"
            document.querySelector(".export").style.display = "inline-block"
            document.getElementById("userRole").textContent = " | Admin"
        } else if (role === "supervisor") {
            document.getElementById("userRole").textContent = " | Supervazer"
            clearTestEmployees()
            // Автоматическая загрузка из облака для супервизора
            loadFromCloud()
        } else {
            document.querySelector(".export").style.display = "none"
            document.getElementById("userRole").textContent = " | Supervazer"
        }
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
    
    // Удаляем сохранённый логин
    localStorage.removeItem("savedLogin")
    localStorage.removeItem("savedPassword")
    
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
    if (newPhoto) newPhoto.value = ""
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
        let matchGender = !genderFilter || e.gender === genderFilter
        return matchName && matchGender
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
<p><b class="editable" onclick="editField(${i},'phone')">Телефон:</b> ${emp.phone}</p>
<button class="toggle-extra-btn" onclick="toggleEmployeeExtra(${i})">📋 Подробнее</button>
<div id="extra-${i}" style="display:none">
<p><b class="editable" onclick="editField(${i},'operator')">Оператор:</b> ${emp.operator || "Нет"}</p>
<p><b class="editable" onclick="editField(${i},'address')">Адрес:</b> ${emp.address || "Нет"}</p>
<p><b class="editable" onclick="editField(${i},'date')">Дата приёма:</b> ${emp.date || "Нет"}</p>
<p><b class="editable" onclick="editField(${i},'birthday')">Дата рождения:</b> ${emp.birthday || "Нет"}</p>
<p><b class="editable" onclick="editField(${i},'gender')">Пол:</b> ${emp.gender === "male" ? "👨 Мужской" : "👩 Женский"}</p>
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
        stats[e.status]++
        if (e.gender === "male") male++
        if (e.gender === "female") female++
    })
    document.getElementById("stats").innerHTML = `
<div class="stat-box">Всего<span>${employees.length}</span></div>
<div class="stat-box">Мужчин<span>${male}</span></div>
<div class="stat-box">Женщин<span>${female}</span></div>
<div class="stat-box">На работе<span>${stats["На работе"]}</span></div>
<div class="stat-box">Отпуск<span>${stats["Отпуск"]}</span></div>
<div class="stat-box">Больничный<span>${stats["Больничный"]}</span></div>
<div class="stat-box">Без содержания<span>${stats["Без содержания"]}</span></div>
<div class="stat-box">Декрет<span>${stats["Декрет"]}</span></div>
<div class="stat-box">Армия<span>${stats["Армия"]}</span></div>
`
}

function exportExcel() {
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
        
    // Показываем уведомления
    let notifDiv = document.getElementById("notifications")
    if (notifications.length > 0) {
        notifDiv.innerHTML = notifications.map(n => `<div class="notif-item">${n}</div>`).join("")
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

// Конец файла
