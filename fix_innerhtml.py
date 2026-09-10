import re

with open('public/script.js', 'r') as f:
    js = f.read()

# For lines assigning to innerHTML that are not wrapped in an if (e.g., `    element.innerHTML = `), we wrap them.
# First, find occurrences of `([a-zA-Z0-9_]+)\.innerHTML = `
# and replace with `if (\1) \1.innerHTML = `

# We have to be careful with `.innerHTML` on things that are properties of objects like `cell.innerHTML` where `cell` is a variable we know exists.
# But `if (cell) cell.innerHTML =` is always safe anyway.
js = re.sub(r'([a-zA-Z0-9_]+)\.innerHTML\s*=', r'if (\1) \1.innerHTML =', js)

with open('public/script.js', 'w') as f:
    f.write(js)
