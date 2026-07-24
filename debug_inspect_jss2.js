const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const file = path.join(__dirname, 'Master', '2025_and_2026', 'JSS2.xlsx');
if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
}

const wb = xlsx.readFile(file);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });

console.log('Total rows:', data.length);
if (data.length === 0) process.exit(0);

const headers = Object.keys(data[0]);
console.log('Headers:', headers);

const admissionCandidates = [];
const missingAdmissionRows = [];

for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const keys = Object.keys(row);
    // find a key that looks like admission
    const admKey = keys.find(k => /admi|adm_no|admission/i.test(k.replace(/[^a-z0-9]/ig, '')));
    const adm = admKey ? row[admKey] : undefined;
    if (adm && adm.toString().trim() !== '') {
        admissionCandidates.push({index: i+1, key: admKey, admission: adm});
    } else {
        missingAdmissionRows.push({index: i+1, keys});
    }
}

console.log('Found admissions count:', admissionCandidates.length);
console.log('Admissions sample (up to 20):', admissionCandidates.slice(0,20));
console.log('Rows missing admission_no count:', missingAdmissionRows.length);
if (missingAdmissionRows.length > 0) console.log('Missing admission row examples:', missingAdmissionRows.slice(0,10));

process.exit(0);
