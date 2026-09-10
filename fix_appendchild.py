import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = re.sub(r'([a-zA-Z0-9_]+)\.appendChild\s*\(', r'if (\1) \1.appendChild(', js)

with open('public/script.js', 'w') as f:
    f.write(js)
