import re

with open('public/script.js', 'r') as f:
    js = f.read()

js = js.replace("video.src = streamUrl;", "if (video) video.src = streamUrl;")

with open('public/script.js', 'w') as f:
    f.write(js)
