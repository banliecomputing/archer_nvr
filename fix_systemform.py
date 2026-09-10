import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = js.replace("document.getElementById('systemForm').addEventListener('submit'", "const systemForm = document.getElementById('systemForm'); if(systemForm) systemForm.addEventListener('submit'")

with open('public/script.js', 'w') as f:
    f.write(js)
