const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function calculateMultiFilePosition(folderPath, currentAdmissionNo) {
    if (!fs.existsSync(folderPath)) return 'N/A';
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    const studentMap = {};

    files.forEach(file => {
        const workbook = xlsx.readFile(path.join(folderPath, file));
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        data.forEach(row => {
            const adm = (row.Admission_no || '').toString().trim();
            if (!adm) return;
            const ca = parseFloat(row['CA (40 MARKS)']) || 0;
            const mcq = parseFloat(row['MCQ (30 MARKS)']) || 0;
            const theory = parseFloat(row['THEORY (30 MARKS)']) || 0;
            const total = row['TOTAL (100)'] ? parseFloat(row['TOTAL (100)']) : (ca + mcq + theory);
            if (!studentMap[adm]) studentMap[adm] = { total: 0, count: 0, name: row.SURNAME || row.NAME };
            studentMap[adm].total += total;
            studentMap[adm].count += 1;
        });
    });

    const rankings = Object.keys(studentMap).map(adm => ({
        adm: adm,
        name: studentMap[adm].name,
        avg: studentMap[adm].total / studentMap[adm].count
    }));
    rankings.sort((a, b) => b.avg - a.avg);

    let currentRank = 0, lastAvg = -1, rankMap = {};
    rankings.forEach((s, index) => {
        if (s.avg !== lastAvg) { currentRank = index + 1; lastAvg = s.avg; }
        rankMap[s.adm] = currentRank;
        s.rank = currentRank;
    });

    console.log('--- 2ND TERM RANKINGS ---');
    rankings.slice(0, 5).forEach(r => console.log(`${r.rank}. ${r.name} (${r.adm}) - Avg: ${r.avg.toFixed(2)}`));

    const myRank = rankMap[currentAdmissionNo.trim()];
    return myRank ? getOrdinal(myRank) : 'N/A';
}

const classPath = 'c:/Users/HP/Desktop/Reporter/aReport_card/2025_2026/Second_term/JSS1';
console.log('Verifying ranking for 25001 in Second Term JSS1...');
const pos = calculateMultiFilePosition(classPath, '25001');
console.log(`\nPosition for 25001: ${pos}`);
