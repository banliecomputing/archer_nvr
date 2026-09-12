const fs = require('fs');

let script = fs.readFileSync('public/script.js', 'utf8');

const ids = [
    'authForm', 'btnMobileMenu', 'sidebarOverlay', 'btnReloadStreams', 
    'btnScrollToForm', 'cameraForm', 'globalStorageForm', 'btnRefreshStorage'
];

ids.forEach(id => {
    const regex = new RegExp(`(?<!if \\(${id}\\) )${id}\\.addEventListener`, 'g');
    script = script.replace(regex, `if (${id}) ${id}.addEventListener`);
});

fs.writeFileSync('public/script.js', script);
console.log('Fixed all listeners');
