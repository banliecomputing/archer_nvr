const fs = require('fs');

let backup = fs.readFileSync('public/script_backup.js', 'utf8');
let current = fs.readFileSync('public/script.js', 'utf8');

// The playback logic starts roughly around `let recordingsMap = {};` and ends before `async function updateSystemStats()` or `function initAdminDashboard()`.
// I'll extract it using regex or index.

let startIndex = backup.indexOf('let recordingsMap = {};');
let endIndex = backup.indexOf('    // --- Armbian Real-time System Monitoring Engine ---');

if (startIndex !== -1 && endIndex !== -1) {
    let playbackCode = backup.substring(startIndex, endIndex);
    
    // Now I need to inject this into script.js just before `function destroyHlsPlayers()` or somewhere safe.
    let targetIndex = current.indexOf('    function destroyHlsPlayers() {');
    
    if (targetIndex !== -1) {
        let newContent = current.substring(0, targetIndex) + 
                         '\n    // --- PLAYBACK ENGINE RESTORED ---\n' + 
                         playbackCode + 
                         '\n    // --- END PLAYBACK ENGINE ---\n\n' + 
                         current.substring(targetIndex);
                         
        fs.writeFileSync('public/script.js', newContent);
        console.log('Playback engine restored successfully.');
    } else {
        console.log('Target index not found in script.js');
    }
} else {
    console.log('Source bounds not found in backup');
}
