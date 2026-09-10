import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = js.replace("tracks.appendChild(block);", "if (tracks) tracks.appendChild(block);")

with open('public/script.js', 'w') as f:
    f.write(js)
