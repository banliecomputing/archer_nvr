import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = js.replace("scrollArea.style.width =", "if (scrollArea) scrollArea.style.width =")

with open('public/script.js', 'w') as f:
    f.write(js)
