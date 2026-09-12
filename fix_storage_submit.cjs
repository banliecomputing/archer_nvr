const fs = require('fs');

let script = fs.readFileSync('public/script.js', 'utf8');

const oldSubmit = `        if (globalStorageForm) globalStorageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                targetDevice: document.getElementById('sysStorageDevice') ? document.getElementById('sysStorageDevice').value : '',
                customPath: document.getElementById('sysCustomStoragePath') ? document.getElementById('sysCustomStoragePath').value : '',
                mode: document.getElementById('sysGlobalStorageMode') ? document.getElementById('sysGlobalStorageMode').value : 'split',
                quality: document.getElementById('sysRecordingQuality') ? document.getElementById('sysRecordingQuality').value : 'original'
            };
            try {
                const res = await authFetch('/api/settings/storage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Gagal update storage');
                alert('Pengaturan storage berhasil disimpan');
            } catch (err) {
                alert(err.message);
            }
        });`;

const newSubmit = `        if (globalStorageForm) globalStorageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const storageDevice = document.getElementById('sysStorageDevice') ? document.getElementById('sysStorageDevice').value : '';
            const customPath = document.getElementById('sysCustomStoragePath') ? document.getElementById('sysCustomStoragePath').value : '';
            const finalPath = storageDevice === 'custom' ? customPath : storageDevice;
            
            const payload = {
                globalStorageMode: document.getElementById('sysGlobalStorageMode') ? document.getElementById('sysGlobalStorageMode').value : 'enabled',
                recordingQuality: document.getElementById('sysRecordingQuality') ? document.getElementById('sysRecordingQuality').value : 'main',
                globalStoragePath: finalPath
            };
            try {
                const res = await authFetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Gagal menyimpan pengaturan storage');
                
                // Juga panggil storage-devices/select jika finalPath valid agar di-bind sbg default NVR 
                if (finalPath && finalPath !== 'custom') {
                    await authFetch('/api/system/storage-devices/select', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ storagePath: finalPath })
                    });
                }
                
                alert('Pengaturan storage berhasil disimpan');
            } catch (err) {
                alert(err.message);
            }
        });`;

// Try exact replace first, otherwise regex
if (script.includes(oldSubmit)) {
    script = script.replace(oldSubmit, newSubmit);
} else {
    script = script.replace(/if \(globalStorageForm\) globalStorageForm\.addEventListener\('submit', async \(e\) => \{[\s\S]*?\}\);/, newSubmit);
}

fs.writeFileSync('public/script.js', script);
console.log('Fixed globalStorageForm submit');
