import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Fix selectEl innerHTML and value
js = js.replace("selectEl.innerHTML = '';", "if (selectEl) selectEl.innerHTML = '';")
js = js.replace("selectEl.appendChild(optionEl);", "if (selectEl) selectEl.appendChild(optionEl);")
js = js.replace("selectEl.value = 'disabled';", "if (selectEl) selectEl.value = 'disabled';")
js = js.replace("selectEl.value = currentSettings.globalStoragePath;", "if (selectEl) selectEl.value = currentSettings.globalStoragePath;")

with open('public/script.js', 'w') as f:
    f.write(js)
