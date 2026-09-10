import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = js.replace("    if(btnCloseSettings) btnCloseSettings.addEventListener('click', () => {", "    if(btnCloseSettings && modal) btnCloseSettings.addEventListener('click', () => {")

with open('public/script.js', 'w') as f:
    f.write(js)
