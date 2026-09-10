import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Fix null addEventListener
js = re.sub(r'([a-zA-Z0-9_]+)\.addEventListener\(', r'if(\1) \1.addEventListener(', js)

with open('public/script.js', 'w') as f:
    f.write(js)
