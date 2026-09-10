import re

with open('public/script.js', 'r') as f:
    js = f.read()

sidebar_logic = """
    function updateCameraSidebar() {
        const lblActiveCams = document.getElementById('lblActiveCams');
        const menuCameraList = document.getElementById('menuCameraList');
        
        let activeCount = cameras.filter(c => c.enabled).length;
        if(lblActiveCams) lblActiveCams.textContent = `${activeCount} Kamera Aktif`;

        if (menuCameraList) {
            menuCameraList.innerHTML = '';
            if (cameras.length === 0) {
                menuCameraList.innerHTML = '<span style="padding: 0.5rem 1.5rem 0.5rem 3rem; color:var(--text-muted); font-size:0.8rem; display:block;">Belum ada kamera</span>';
                return;
            }
            cameras.forEach(cam => {
                const a = document.createElement('a');
                a.href = '#';
                a.className = 'nav-subitem';
                a.innerHTML = `<span style="color:${cam.enabled ? 'var(--success)' : 'var(--accent)'}; margin-right:5px;">●</span> ${cam.name}`;
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Fokus ke single layout untuk kamera ini
                    document.querySelector('.layout-btn[data-grid="1"]').click();
                    // Wait briefly for grid to render then select camera if possible
                    setTimeout(() => {
                        // Normally we would select it in the UI, but let's just make it visually selected
                        document.querySelectorAll('.nav-subitem').forEach(i => i.classList.remove('active'));
                        a.classList.add('active');
                        // And force the single grid to show this camera (if possible, this requires more logic, for now just go to view-live)
                    }, 100);
                });
                menuCameraList.appendChild(a);
            });
        }
        
        // Fallback to legacy cameraListEl if exists
        if(cameraListEl) {
            cameraListEl.innerHTML = '';
            cameras.forEach(cam => {
                const li = document.createElement('li');
                if (!cam.enabled) li.classList.add('disabled');
                li.innerHTML = `<span class="pulse-dot ${cam.enabled ? '' : 'offline'}"></span> ${cam.name}`;
                cameraListEl.appendChild(li);
            });
        }
    }
"""

js = re.sub(r'function updateCameraSidebar\(\) \{.*?\n    \}', sidebar_logic.strip(), js, flags=re.DOTALL)

with open('public/script.js', 'w') as f:
    f.write(js)
