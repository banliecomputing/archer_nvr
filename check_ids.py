import re

with open('public/script.js', 'r') as f:
    js = f.read()

with open('public/index.html', 'r') as f:
    html = f.read()

js_ids = set(re.findall(r"document\.getElementById\('([^']+)'\)", js))
html_ids = set(re.findall(r'id="([^"]+)"', html))

missing = js_ids - html_ids
for m in missing:
    print(m)
