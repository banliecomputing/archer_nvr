const fs = require('fs');
let script = fs.readFileSync('public/script.js', 'utf8');
let target = '    // Mulai Eksekusi Autentikasi';
let newScript = script.replace(target, 
    "    if (btnFetchRecordings) btnFetchRecordings.addEventListener('click', fetchRecordings);\n" + 
    "    if (mBtnFetchRecordings) mBtnFetchRecordings.addEventListener('click', fetchRecordings);\n" + 
    target);
fs.writeFileSync('public/script.js', newScript);
