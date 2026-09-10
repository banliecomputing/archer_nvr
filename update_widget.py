import re

with open('public/script.js', 'r') as f:
    js = f.read()

widget_logic = """
            // 1. CPU Usage (%)
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
            
            // Full Sidebar Widget (legacy if exists)
            const sideCpuTemp = document.getElementById('sideCpuTemp');
            if (sideCpuTemp) sideCpuTemp.textContent = `${cpuPct}% | ${tempC}°C`;

            // 4. Storage Usage (%)
            const wStorage = document.getElementById('wStorage');
            const sideStorage = document.getElementById('sideStorage');
            const sideStorageIf = document.getElementById('sideStorageIf');
            if (data.storage) {
                const sPct = data.storage.usePercent || 0;
                if (wStorage) wStorage.textContent = `${sPct}%`;
                if (sideStorage) sideStorage.textContent = `${sPct}% (${data.storage.usedGB}GB / ${data.storage.sizeGB}GB)`;
                if (sideStorageIf) sideStorageIf.textContent = data.storage.mountedOn || '/';
            }

            // 5. Network Interface & Speed
            const topNetVal = document.getElementById('topNetVal');
            const wNetIf = document.getElementById('wNetIf');
            const wNetDown = document.getElementById('wNetDown');
            const wNetUp = document.getElementById('wNetUp');
            
            if (data.network) {
                let netFace = data.network.interface || 'eth0';
                const downStr = data.network.downSpeedStr || '0 KB/s';
                const upStr = data.network.upSpeedStr || '0 KB/s';
                
                if (topNetVal) topNetVal.textContent = `↓ ${downStr} ↑ ${upStr}`;
                if (wNetIf) wNetIf.textContent = netFace;
                if (wNetDown) wNetDown.textContent = downStr;
                if (wNetUp) wNetUp.textContent = upStr;
                
                const sideNetIf = document.getElementById('sideNetIf');
                const sideNetStatus = document.getElementById('sideNetStatus');
                if (sideNetIf) sideNetIf.textContent = netFace;
                if (sideNetStatus) sideNetStatus.textContent = data.network.status || 'OK';
            }
"""

js = re.sub(r'// 1\. CPU Usage \(%\).*?// --- Fetch Cameras ---', widget_logic + '\n        } catch (e) {\n            console.error(\'Error update stats:\', e);\n        }\n    }\n\n    // --- Fetch Cameras ---', js, flags=re.DOTALL)

with open('public/script.js', 'w') as f:
    f.write(js)
