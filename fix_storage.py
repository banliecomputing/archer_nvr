import re

with open('public/script.js', 'r') as f:
    js = f.read()

# Fix wStorage to show free space
js = js.replace("""            // 4. Storage Usage (%)
            const wStorage = document.getElementById('wStorage');
            if (data.storage) {
                const sPct = data.storage.usePercent || 0;
                if(wStorage) wStorage.textContent = `${sPct}%`;
            }""", """            // 4. Storage Usage (%)
            const wStorage = document.getElementById('wStorage');
            if (data.storage) {
                const freeGB = data.storage.sizeGB - data.storage.usedGB;
                if(wStorage) wStorage.textContent = `${freeGB.toFixed(1)}GB Free`;
            }""")

with open('public/script.js', 'w') as f:
    f.write(js)
