import re

with open('public/script.js', 'r') as f:
    js = f.read()

# 1. Update checking auth for lblUsername
js = js.replace("""            } else {
                // Authenticated
                authOverlay.style.display = 'none';
                mainApp.style.display = 'flex';
                initializeApp();
            }""", """            } else {
                // Authenticated
                authOverlay.style.display = 'none';
                mainApp.style.display = 'flex';
                const lblUsername = document.getElementById('lblUsername');
                if(lblUsername) lblUsername.textContent = data.username || 'Admin';
                initializeApp();
            }""")


# 2. Replace updateCameraSidebar to populate the new nav subitem as well
js = re.sub(r'function updateCameraSidebar\(\) \{.*?\n    \}', """function updateCameraSidebar() {
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
                    // switch to view-live 1x1
                    const layoutBtn1 = document.querySelector('.layout-btn[data-grid="1"]');
                    if (layoutBtn1) layoutBtn1.click();
                    setTimeout(() => {
                        document.querySelectorAll('.nav-subitem').forEach(i => i.classList.remove('active'));
                        a.classList.add('active');
                    }, 100);
                });
                menuCameraList.appendChild(a);
            });
        }
        
        // legacy
        if(cameraListEl) {
            cameraListEl.innerHTML = '';
            cameras.forEach(cam => {
                const li = document.createElement('li');
                if (!cam.enabled) li.classList.add('disabled');
                li.innerHTML = `<span class="pulse-dot ${cam.enabled ? '' : 'offline'}"></span> ${cam.name}`;
                cameraListEl.appendChild(li);
            });
        }
    }""", js, flags=re.DOTALL)


# 3. Widget logic update in updateSystemStats
js = re.sub(r'// 1\. CPU Usage \(%\).*?// 5\. Network Interface & Speed\n', """            // 1. CPU Usage (%)
            const topCpuVal = document.getElementById('topCpuVal');
            const wCpu = document.getElementById('wCpu');
            let cpuPct = 0;
            if (data.cpu) {
                cpuPct = data.cpu.usagePercent || 0;
                if (topCpuVal) topCpuVal.textContent = `${cpuPct}%`;
                if (wCpu) wCpu.textContent = `${cpuPct}%`;
            }

            // 2. RAM Usage (%)
            const topRamVal = document.getElementById('topRamVal');
            const wRam = document.getElementById('wRam');
            if (data.ram) {
                const ramPct = (data.ram.usagePercent !== undefined ? data.ram.usagePercent : data.ram.usedPercent) || 0;
                if (topRamVal) topRamVal.textContent = `${ramPct}%`;
                if (wRam) wRam.textContent = `${ramPct}%`;
            }

            // 3. SoC Temperature (°C)
            const wTemp = document.getElementById('wTemp');
            let tempC = 0;
            if (data.cpu && data.cpu.temperatureC) {
                tempC = parseFloat(data.cpu.temperatureC).toFixed(1);
                if (wTemp) wTemp.textContent = `${tempC}°C`;
            } else {
                if (wTemp) wTemp.textContent = `N/A`;
            }

            // 4. Storage Usage (%)
            const wStorage = document.getElementById('wStorage');
            if (data.storage) {
                const sPct = data.storage.usePercent || 0;
                if (wStorage) wStorage.textContent = `${sPct}%`;
            }

            // 5. Network Interface & Speed\n""", js, flags=re.DOTALL)

js = js.replace("""            if (data.network) {
                let netFace = data.network.interface || 'eth0';
                const downStr = data.network.downSpeedStr || '0 KB/s';
                const upStr = data.network.upSpeedStr || '0 KB/s';
                
                if (topNetVal) topNetVal.textContent = `↓ ${downStr} ↑ ${upStr}`;
                
                const sideNetIf = document.getElementById('sideNetIf');
                const sideNetStatus = document.getElementById('sideNetStatus');
                if (sideNetIf) sideNetIf.textContent = netFace;
                if (sideNetStatus) sideNetStatus.textContent = data.network.status || 'OK';
            }""", """            if (data.network) {
                let netFace = data.network.interface || 'eth0';
                const downStr = data.network.downSpeedStr || '0 KB/s';
                const upStr = data.network.upSpeedStr || '0 KB/s';
                
                if (topNetVal) topNetVal.textContent = `↓ ${downStr} ↑ ${upStr}`;
                
                const wNetIf = document.getElementById('wNetIf');
                const wNetDown = document.getElementById('wNetDown');
                const wNetUp = document.getElementById('wNetUp');
                if (wNetIf) wNetIf.textContent = netFace;
                if (wNetDown) wNetDown.textContent = downStr;
                if (wNetUp) wNetUp.textContent = upStr;
            }""")

with open('public/script.js', 'w') as f:
    f.write(js)
