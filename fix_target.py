import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = js.replace("document.getElementById(btn.getAttribute('data-target')).classList.add('active');", 
                "const target = document.getElementById(btn.getAttribute('data-target')); if (target) target.classList.add('active');")

with open('public/script.js', 'w') as f:
    f.write(js)
