import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Fix value
js = re.sub(r'([a-zA-Z0-9_]+)\.value\s*=', r'if (\1) \1.value =', js)
js = re.sub(r'if \(([a-zA-Z0-9_]+)\) if \(\1\)', r'if (\1)', js) # just in case

with open('public/script.js', 'w') as f:
    f.write(js)
