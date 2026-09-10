import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = js.replace("scale.appendChild(mark);", "if (scale) scale.appendChild(mark);")

with open('public/script.js', 'w') as f:
    f.write(js)
