import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = js.replace('logsContainer.scrollTop = logsContainer.scrollHeight;', 'if (logsContainer) logsContainer.scrollTop = logsContainer.scrollHeight;')

with open('public/script.js', 'w') as f:
    f.write(js)
