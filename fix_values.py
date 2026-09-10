import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Fix getElementById().value
js = re.sub(r"document\.getElementById\('([^']+)'\)\.value\s*=", r"const el_\1 = document.getElementById('\1'); if (el_\1) el_\1.value =", js)

with open('public/script.js', 'w') as f:
    f.write(js)
