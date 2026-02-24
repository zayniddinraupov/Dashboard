let role=""
let employees=JSON.parse(localStorage.getItem("employees"))||[]
let globalPhoto=localStorage.getItem("globalPhoto")||""

// Удаление тестовых сотрудников при первом запуске
function clearTestEmployees(){
if(employees.length>0 && employees[0].name && employees[0].name.startsWith("Сотрудник ")){
employees=[]
saveData()
alert("Тестовые сотрудники удалены!")
renderEmployees()
}
}

function saveData(){
localStorage.setItem("employees",JSON.stringify(employees))
}

function autoRefresh(){
let stored=JSON.parse(localStorage.getItem("employees"))||[]
if(JSON.stringify(stored)!==JSON.stringify(employees)){
employees=stored
renderEmployees()
}
}
setInterval(autoRefresh,3000)

function loginUser(){
if(login.value==="Zayniddin"&&password.value==="3020"){role="admin"}
else if(login.value==="supervisor"&&password.value==="12345"){role="supervisor"}
else{alert("Ошибка");return}
loginPage.classList.add("hidden")
mainPage.classList.remove("hidden")
if(role==="admin"){
document.getElementById("addBtn").style.display="inline-block"
document.getElementById("globalPhotoBtn").style.display="inline-block"
document.querySelector(".export").style.display="inline-block"
clearTestEmployees()
}else{
document.querySelector(".export").style.display="none"
}
renderEmployees()
}

function toggleAdd(){
let addSection=document.getElementById("addSection")
let addBtn=document.getElementById("addBtn")
if(addSection.classList.contains("hidden")){
addSection.classList.remove("hidden")
addBtn.textContent="✕ Скрыть форму"
}else{
addSection.classList.add("hidden")
addBtn.textContent="+ Добавить сотрудника"
}
}

function toggleDateRange(){
let status=document.getElementById("newStatus").value
let dateRangeFields=document.getElementById("dateRangeFields")
let firedDateField=document.getElementById("firedDateField")
if(status==="Учёба" || status==="Отпуск" || status==="Больничный"){
dateRangeFields.style.display="block"
firedDateField.style.display="none"
}else if(status==="Увольнение"){
dateRangeFields.style.display="none"
firedDateField.style.display="block"
}else{
dateRangeFields.style.display="none"
firedDateField.style.display="none"
}
}

function setGlobalPhoto(){
if(role!=="admin"){alert("Нет доступа");return}
let newPhotoUrl=prompt("Введите URL фото для всех сотрудников:",globalPhoto)
if(newPhotoUrl===null)return
globalPhoto=newPhotoUrl
localStorage.setItem("globalPhoto",globalPhoto)
// Обновляем фото у всех существующих сотрудников
employees.forEach(emp=>{
emp.photo=globalPhoto
})
saveData()
renderEmployees()
alert("Фото установлено для всех сотрудников!")
}

function handleGlobalPhotoUpload(event){
if(role!=="admin"){alert("Нет доступа");return}
let file=event.target.files[0]
if(!file)return
let reader=new FileReader()
reader.onload=function(e){
globalPhoto=e.target.result
localStorage.setItem("globalPhoto",globalPhoto)
// Обновляем фото у всех сотрудников
employees.forEach(emp=>{
emp.photo=globalPhoto
})
saveData()
renderEmployees()
alert("Фото установлено для всех сотрудников!")
}
reader.readAsDataURL(file)
event.target.value=""
}

function logout(){location.reload()}

function addEmployee(){
if(role!=="admin"){alert("Нет доступа");return}
let photoUrl=globalPhoto||"/images/default.jpg"
let status=newStatus.value
let dateFrom=document.getElementById("newDateFrom").value
let dateTo=document.getElementById("newDateTo").value
let firedDate=document.getElementById("newFiredDate").value
let dateRange=""
if((status==="Учёба" || status==="Отпуск" || status==="Больничный") && dateFrom && dateTo){
dateRange=dateFrom+" - "+dateTo
}else if(status==="Увольнение" && firedDate){
dateRange="Уволен: "+firedDate
}
employees.push({
name:newName.value,
phone:newPhone.value,
operator:newOperator.value,
address:newAddress.value,
date:newDate.value,
status:status,
photo:photoUrl,
gender:newGender.value,
dateRange:dateRange
})
saveData()
renderEmployees()
newName.value=""
newPhone.value=""
newOperator.value=""
newAddress.value=""
newDate.value=""
newPhoto.value=""
document.getElementById("newDateFrom").value=""
document.getElementById("newDateTo").value=""
document.getElementById("newFiredDate").value=""
}

function deleteEmployee(i){
employees.splice(i,1)
saveData()
renderEmployees()
}

function changeStatus(i,newStatus){
if(role!=="admin"){alert("Нет доступа");return}
employees[i].status=newStatus
if(newStatus==="Учёба" || newStatus==="Отпуск" || newStatus==="Больничный"){
let currentRange=employees[i].dateRange||""
let dates=currentRange.split(" - ")
let dateFrom=dates[0]||""
let dateTo=dates[1]||""
let newFrom=prompt("Дата С:",dateFrom)
if(newFrom===null)return
let newTo=prompt("Дата По:",dateTo)
if(newTo===null)return
employees[i].dateRange=newFrom && newTo ? newFrom+" - "+newTo : ""
}else if(newStatus==="Увольнение"){
let currentFired=employees[i].dateRange||""
let firedDate=currentFired.replace("Уволен: ","")
let newFired=prompt("Дата увольнения:",firedDate)
if(newFired===null)return
employees[i].dateRange=newFired ? "Уволен: "+newFired : ""
}else{
employees[i].dateRange=""
}
saveData()
renderEmployees()
}

function changeGender(i,newGender){
if(role!=="admin"){alert("Нет доступа");return}
employees[i].gender=newGender
saveData()
renderEmployees()
}

function editField(i,field){
if(role!=="admin"){alert("Нет доступа");return}
let emp=employees[i]
let current=emp[field]
let label=field==="phone"?"Телефон":field==="address"?"Адрес":field==="date"?"Дата":field==="operator"?"Оператор":"Пол"
let newValue=prompt("Изменить "+label+":",current)
if(newValue===null||newValue===current)return
if(field==="gender"){newValue=newValue.toLowerCase().includes("муж")?"male":"female"}
emp[field]=newValue
saveData()
renderEmployees()
}

let currentEditingPhotoIndex=-1

function editPhoto(i){
if(role!=="admin"){alert("Нет доступа");return}
currentEditingPhotoIndex=i
document.getElementById("employeePhotoInput").click()
}

function handleEmployeePhotoUpload(event){
let file=event.target.files[0]
if(!file||currentEditingPhotoIndex<0)return
let reader=new FileReader()
reader.onload=function(e){
employees[currentEditingPhotoIndex].photo=e.target.result
saveData()
renderEmployees()
alert("Фото обновлено!")
}
reader.readAsDataURL(file)
currentEditingPhotoIndex=-1
event.target.value=""
}

function editEmployee(i){
if(role!=="admin"){alert("Нет доступа");return}
let emp=employees[i]
let newName=prompt("ФИО:",emp.name)
if(newName===null)return
let newPhone=prompt("Телефон:",emp.phone)
if(newPhone===null)return
let newAddress=prompt("Адрес:",emp.address)
if(newAddress===null)return
let newDate=prompt("Дата приема:",emp.date)
if(newDate===null)return
let newPhoto=prompt("URL фото:",emp.photo)
if(newPhoto===null)return
let newGender=prompt("Пол (male/female):",emp.gender)
if(newGender===null)return
employees[i]={name:newName,phone:newPhone,operator:emp.operator,address:newAddress,date:newDate,status:emp.status,photo:newPhoto,gender:newGender,dateRange:emp.dateRange}
saveData()
renderEmployees()
}

function renderEmployees(){
let list=document.getElementById("employeeList")
list.innerHTML=""
employees.filter(e=>e.name.toLowerCase().includes(search.value.toLowerCase()))
.forEach((emp,i)=>{
let div=document.createElement("div")
div.className="employee "+getClass(emp.status)
let dateRangeHtml=emp.dateRange?`<p style="color:#e74c3c;font-weight:bold;margin:5px 0;">📅 Период: ${emp.dateRange}</p>`:""
div.innerHTML=`
<div class="employee-header">
<div class="employee-info">
<img src="${emp.photo}">
<div>
<h3>${emp.name}</h3>
${role==="admin"?`
<select class="status-select ${getClass(emp.status)}" onchange="changeStatus(${i},this.value)">
<option value="На работе" ${emp.status==="На работе"?"selected":""}>На работе</option>
<option value="Учёба" ${emp.status==="Учёба"?"selected":""}>Учёба</option>
<option value="Отпуск" ${emp.status==="Отпуск"?"selected":""}>Отпуск</option>
<option value="Больничный" ${emp.status==="Больничный"?"selected":""}>Больничный</option>
<option value="Без содержания" ${emp.status==="Без содержания"?"selected":""}>Без содержания</option>
<option value="Увольнение" ${emp.status==="Увольнение"?"selected":""}>Увольнение</option>
</select>
`:`<span class="status-view ${getClass(emp.status)}">${emp.status}</span>`}
${dateRangeHtml}
</div>
</div>
<div>
${role==="admin"?`
<button class="edit" onclick="editEmployee(${i})">Редактировать</button>
<button class="edit" onclick="editPhoto(${i})">Изменить фото</button>
<button class="delete" onclick="deleteEmployee(${i})">Удалить</button>
`:""}
</div>
</div>
<p><b class="editable" onclick="editField(${i},'phone')">Телефон:</b> ${emp.phone}</p>
<p><b class="editable" onclick="editField(${i},'operator')">Оператор:</b> ${emp.operator||"Нет"}</p>
<p><b class="editable" onclick="editField(${i},'address')">Адрес:</b> ${emp.address}</p>
<p><b class="editable" onclick="editField(${i},'date')">Дата:</b> ${emp.date}</p>
<p><b class="editable" onclick="editField(${i},'gender')">Пол:</b> ${emp.gender==="male"?"👨 Мужской":"👩 Женский"}</p>
`
list.appendChild(div)
})
updateStats()
}

function getClass(status){
return{
"На работе":"work",
"Учёба":"study",
"Отпуск":"vacation",
"Больничный":"sick",
"Без содержания":"unpaid",
"Увольнение":"fired"
}[status]
}

function updateStats(){
let stats={"На работе":0,"Учёба":0,"Отпуск":0,"Больничный":0,"Без содержания":0,"Увольнение":0}
let male=0,female=0
employees.forEach(e=>{
stats[e.status]++
if(e.gender==="male")male++
if(e.gender==="female")female++
})
document.getElementById("stats").innerHTML=`
<div class="stat-box">Всего: ${employees.length}</div>
<div class="stat-box">Мужчин: ${male}</div>
<div class="stat-box">Женщин: ${female}</div>
<div class="stat-box">На работе: ${stats["На работе"]}</div>
<div class="stat-box">Отпуск: ${stats["Отпуск"]}</div>
<div class="stat-box">Больничный: ${stats["Больничный"]}</div>
`
}

function exportExcel(){
if(typeof XLSX === "undefined"){
alert("Загрузка библиотеки...")
let script=document.createElement("script")
script.src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"
script.onload=function(){performExport()}
document.head.appendChild(script)
return
}
performExport()
}

function performExport(){
try{
let data=employees.map(e=>({
"ФИО":e.name,
"Телефон":e.phone,
"Оператор":e.operator,
"Адрес":e.address,
"Дата приёма":e.date,
"Статус":e.status,
"Период":e.dateRange||"",
"Пол":e.gender==="male"?"Мужской":"Женский"
}))
let wb=XLSX.utils.book_new()
let ws=XLSX.utils.json_to_sheet(data)
XLSX.utils.book_append_sheet(wb,ws,"Сотрудники")
XLSX.writeFile(wb,"HR_Report.xlsx")
}catch(err){
alert("Ошибка: "+err.message)
}
}

// Сброс данных (раскомментируйте для сброса)
// localStorage.removeItem("employees"); location.reload();