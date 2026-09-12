const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const newRoutes = `
app.get('/api/superadmin/app-info', verifyToken, requireSuperadmin, (req, res) => {
    res.json({
        appName: 'Archer NVR',
        version: '8.9 (SupremeTOTO V47)',
        nodeVersion: process.version,
        platform: require('os').platform(),
        arch: require('os').arch(),
        databaseFile: nvrDbFile,
        recordingsBaseDir: baseStoragePath,
        mediaMtxConfig: '/root/mediamtx.yml',
        appDirectory: process.cwd()
    });
});

app.post('/api/superadmin/factory-reset', verifyToken, requireSuperadmin, (req, res) => {
    try {
        const initial = getDefaultDb();
        saveNvrDb(initial);
        settings = getSettings();
        sysLog('WARNING', 'SuperAdmin triggered a Factory Reset.');
        res.json({ message: 'Factory reset completed successfully. Please login again.' });
    } catch(err) {
        res.status(500).json({ error: 'Failed to factory reset' });
    }
});
`;

code = code.replace("app.get('/api/superadmin/admins'", newRoutes + "\napp.get('/api/superadmin/admins'");

fs.writeFileSync('server.js', code);
console.log('Fixed superadmin routes');
