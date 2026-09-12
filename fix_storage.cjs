const fs = require('fs');

let script = fs.readFileSync('public/script.js', 'utf8');

// The faulty storage loading part:
const faultyPart = `    if (btnRefreshStorage) {
        if (btnRefreshStorage) btnRefreshStorage.addEventListener('click', async () => {
            try {
                const res = await authFetch('/api/system/storage_devices');
                if (!res.ok) return;
                const devs = await res.json();
                const sel = document.getElementById('sysStorageDevice');
                if (sel) {
                    sel.innerHTML = '<option value="">(Local Default) data/recordings</option>';
                    devs.forEach(d => {
                        sel.innerHTML += \`<option value="\${d.mount}">\${d.device} (\${d.mount}) - \${d.size}</option>\`;
                    });
                }
            } catch (err) {}
        });
    }`;

// Replacement with robust loadStorageDevices
const correctPart = `
    async function loadStorageDevices() {
        const selEl = document.getElementById('sysStorageDevice');
        const customInput = document.getElementById('sysCustomStoragePath');
        if (!selEl) return;

        try {
            selEl.innerHTML = '<option value="">Memindai drive penyimpanan...</option>';
            const res = await fetch('/api/system/storage-devices');
            if (!res.ok) throw new Error('Gagal memuat daftar perangkat penyimpanan');
            const data = await res.json();
            
            const detectedStorageDevices = data.devices || [];
            selEl.innerHTML = '';
            
            const currentPath = data.currentStoragePath || '';
            let customFound = true;
            
            if (detectedStorageDevices.length === 0) {
                selEl.innerHTML = '<option value="">Tidak ada media eksternal terdeteksi</option>';
            } else {
                let matchFound = false;
                detectedStorageDevices.forEach(dev => {
                    const opt = document.createElement('option');
                    opt.value = dev.mountPath;
                    
                    const icon = dev.category === 'External' ? '🔌 [USB/HDD]' : (dev.category === 'Internal' ? '💽 [Internal]' : '📁 [Kustom]');
                    opt.textContent = \`\${icon} \${dev.name} • Sisa: \${dev.freeGB} GB (\${dev.percentUsed}% terpakai)\`;
                    
                    if (dev.selected || dev.mountPath === currentPath) {
                        opt.selected = true;
                        matchFound = true;
                    }
                    selEl.appendChild(opt);
                });
                
                // Add Custom Path Option
                const optCustom = document.createElement('option');
                optCustom.value = "custom";
                optCustom.textContent = "⚙️ Jalur Kustom (Ketik manual)...";
                if (!matchFound && currentPath) {
                    optCustom.selected = true;
                    customFound = false;
                }
                selEl.appendChild(optCustom);
            }

            if (customInput) {
                if (!customFound && currentPath) {
                    customInput.style.display = 'block';
                    customInput.value = currentPath;
                } else {
                    customInput.style.display = 'none';
                    customInput.value = '';
                }
            }
        } catch (err) {
            console.error(err);
            selEl.innerHTML = '<option value="">Gagal memuat drive eksternal</option>';
        }
    }

    if (btnRefreshStorage) {
        btnRefreshStorage.addEventListener('click', loadStorageDevices);
    }
    
    const sysStorageDevice = document.getElementById('sysStorageDevice');
    const sysCustomStoragePath = document.getElementById('sysCustomStoragePath');
    if (sysStorageDevice && sysCustomStoragePath) {
        sysStorageDevice.addEventListener('change', () => {
            if (sysStorageDevice.value === 'custom') {
                sysCustomStoragePath.style.display = 'block';
                sysCustomStoragePath.focus();
            } else {
                sysCustomStoragePath.style.display = 'none';
            }
        });
    }

    // Call it on admin load if exists
    if (document.getElementById('sysStorageDevice')) {
        loadStorageDevices();
    }
`;

if (script.includes(faultyPart)) {
    script = script.replace(faultyPart, correctPart);
} else {
    // If not matching perfectly, just replace using regex
    script = script.replace(/if \(btnRefreshStorage\) \{[\s\S]*?\}\s*\}/, correctPart);
}

fs.writeFileSync('public/script.js', script);
console.log('Fixed storage load UI');
