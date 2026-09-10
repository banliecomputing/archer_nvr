import re

with open('public/script.js', 'r') as f:
    js = f.read()

auth_logic = """
            } else {
                // Authenticated
                authOverlay.style.display = 'none';
                mainApp.style.display = 'flex';
                const lblUsername = document.getElementById('lblUsername');
                if(lblUsername) lblUsername.textContent = data.username || 'Admin';
                initializeApp();
            }
"""

js = re.sub(r'\} else \{\n\s+// Authenticated\n\s+authOverlay\.style\.display = \'none\';\n\s+mainApp\.style\.display = \'flex\';\n\s+initializeApp\(\);\n\s+\}', auth_logic.strip(), js, flags=re.DOTALL)

with open('public/script.js', 'w') as f:
    f.write(js)
