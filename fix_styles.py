import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Fix styles
for var in ['authOverlay', 'mainApp', 'authForm', 'authTitle', 'tabRegisterBtn', 'tabLoginBtn', 'previewBox', 'btnCancelEdit', 'stateOverlay', 'confirmGroup']:
    js = re.sub(fr'{var}\.style', fr'if ({var}) {var}.style', js)
    js = re.sub(fr'if \({var}\) if \({var}\)', fr'if ({var})', js) # just in case

with open('public/script.js', 'w') as f:
    f.write(js)
