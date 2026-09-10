import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Fix sidebar, sidebarOverlay, modal, tabRegisterBtn, tabLoginBtn
for var in ['sidebar', 'sidebarOverlay', 'modal', 'tabRegisterBtn', 'tabLoginBtn']:
    js = re.sub(fr'{var}\.classList', fr'if ({var}) {var}.classList', js)
    js = re.sub(fr'if \({var}\) if \({var}\)', fr'if ({var})', js) # just in case

with open('public/script.js', 'w') as f:
    f.write(js)
