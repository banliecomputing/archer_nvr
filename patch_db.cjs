const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const newSave = `
let isSavingDb = false;
let pendingDbSave = false;
function saveNvrDb(data) {
    cachedDb = data;
    scheduleDbSave();
}

function scheduleDbSave() {
    if (isSavingDb) {
        pendingDbSave = true;
        return;
    }
    isSavingDb = true;
    setTimeout(() => {
        try {
            const jsonStr = JSON.stringify(cachedDb, null, 2);
            // Atomic writes to prevent corruption on armbian
            const tmpFile = nvrDbFile + '.tmp';
            fs.writeFileSync(tmpFile, jsonStr);
            fs.renameSync(tmpFile, nvrDbFile);
            
            const backupFile = path.join(dataDir, 'nvr.db.json');
            fs.writeFileSync(backupFile + '.tmp', jsonStr);
            fs.renameSync(backupFile + '.tmp', backupFile);
        } catch(e) {
            console.error('Error saving DB:', e);
        }
        isSavingDb = false;
        if (pendingDbSave) {
            pendingDbSave = false;
            scheduleDbSave();
        }
    }, 200);
}
`;

// Replace the original saveNvrDb
code = code.replace(/function saveNvrDb\(data\) \{[\s\S]*?\n\}/, newSave.trim());

fs.writeFileSync('server.js', code);
console.log('Patched saveNvrDb');
