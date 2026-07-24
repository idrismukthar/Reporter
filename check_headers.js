const xlsx = require('xlsx');
const path = require('path');
const fp = path.join(__dirname, 'Master/2025_and_2026/JSS3.xlsx');
try {
    const wb = xlsx.readFile(fp);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    if(data.length > 0) {
        console.log(Object.keys(data[0]));
    }
} catch(e) { console.error(e); }
