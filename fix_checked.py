import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = re.sub(r"document\.getElementById\('([^']+)'\)\.checked\s*=", r"const el2_\1 = document.getElementById('\1'); if (el2_\1) el2_\1.checked =", js)

with open('public/script.js', 'w') as f:
    f.write(js)
