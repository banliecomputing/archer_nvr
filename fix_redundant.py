import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Fix redundant ifs
js = re.sub(r'if\s*\(([a-zA-Z0-9_]+)\)\s*if\s*\(\1\)', r'if (\1)', js)
js = js.replace("document.getElementById('formTitle').textContent =", "const formTitle = document.getElementById('formTitle'); if(formTitle) formTitle.textContent =")

with open('public/script.js', 'w') as f:
    f.write(js)
