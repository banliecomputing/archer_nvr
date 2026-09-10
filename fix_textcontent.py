import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Fix textContent
js = re.sub(r'([a-zA-Z0-9_]+)\.textContent\s*=', r'if (\1) \1.textContent =', js)

with open('public/script.js', 'w') as f:
    f.write(js)
