# HR Dashboard - PythonAnywhere sozlanishi

## Qadam 1: PythonAnywhere hisob ochish
1. Bor: https://www.pythonanywhere.com/
2. "Start running Python online in less than a minute" tugmasini bos
3. Ro'yxatdan o't (bepul)

## Qadam 2: Web app sozlash
1. **Files** bo'limiga o't
2. **Go to directory** -> `/home/USERNAME/` (username o'zgartir)
3. **New directory** -> nomi: `HRDashboard`
4. Shu papkaga quyidagi fayllarni yukla:
   - `app_pythonanywhere.py` (nomini `app.py` ga o'zgartir)
   - `index.html`
   - `stayl.css`
   - `script_new.js`

## Qadam 3: Webni sozlash
1. **Web** bo'limiga o't
2. **Add a new web app** tugmasini bos
3. **Manual configuration** -> **Flask** -> **Python 3.9** yoki **3.12**
4. So'ngra:
   - **Source code**: `/home/USERNAME/HRDashboard/`
   - **Working directory**: `/home/USERNAME/HRDashboard/`

## Qadam 4: WSGI sozlash
1. **WSGI configuration file** (link top) ni bos
2. Quyidagini yoz:

```python
import sys
path = '/home/USERNAME/HRDashboard'
if path not in sys.path:
    sys.path.insert(0, path)

from app import app as application
```

3. **Save** va orqaga qayt

## Qadam 5: Virtualenv (Flask o'rnatish)
1. Consolga kir:
   ```
   mkvirtualenv venv
   pip install flask flask-cors pyotp
   ```

## Qadam 6: Saytni ishga tushirish
1. **Web** bo'limida **Reload** tugmasini bos
2. Sayt ishga tushadi!

## Manzil
Sayt quyidagi manzilda bo'ladi:
```
https://YOUR_USERNAME.pythonanywhere.com
```

## Muhim eslatma
- Telegram bot ishlashi uchun `script_new.js` dagi `API_URL` ni o'zgartir:
  ```javascript
  const API_URL = "https://YOUR_USERNAME.pythonanywhere.com/api"
  ```

- Foydalanuvchi: `zayniddin`
- Parol: `3020`
