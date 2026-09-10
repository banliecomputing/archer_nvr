import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = js.replace("scrubber.style.left =", "if (scrubber) scrubber.style.left =")

with open('public/script.js', 'w') as f:
    f.write(js)
