const xlsx = require('xlsx');

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function calculateClassPosition(data, admission_no) {
    if (!data || data.length === 0) return 'N/A';
    const headers = Object.keys(data[0]);
    const subjects = [];
    headers.forEach(h => {
        if (h.endsWith(' (CA 40)')) subjects.push(h.replace(' (CA 40)', ''));
    });
    console.log('Detected Subjects:', subjects);
    if (subjects.length === 0) return 'N/A';

    const rankings = data.map(row => {
        let total = 0;
        subjects.forEach(sub => {
            total += (parseFloat(row[`${sub} (CA 40)`]) || 0) + (parseFloat(row[`${sub} (Exam 60)`]) || 0);
        });
        return { 
            name: row.Name,
            adm: (row.Admission_no || '').toString().trim(), 
            avg: total / subjects.length 
        };
    });

    rankings.sort((a, b) => b.avg - a.avg);
    let currentRank = 0, lastAvg = -1, rankMap = {};
    rankings.forEach((s, index) => {
        if (s.avg !== lastAvg) { currentRank = index + 1; lastAvg = s.avg; }
        rankMap[s.adm] = currentRank;
        s.rank = currentRank;
    });

    console.log('--- RANKINGS ---');
    rankings.forEach(r => console.log(`${r.rank}. ${r.name} (${r.adm}) - Avg: ${r.avg.toFixed(2)}` ));

    const myRank = rankMap[admission_no.trim()];
    return myRank ? getOrdinal(myRank) : 'N/A';
}

function formatDOB(dob) {
    if (!dob) return 'Not Record';
    let date;
    const num = parseFloat(dob);
    if (!isNaN(num) && num > 20000) { 
        date = new Date(Math.round((num - 25569) * 86400 * 1000));
    } else {
        date = new Date(dob);
    }
    if (isNaN(date.getTime())) return dob;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName}, ${getOrdinal(day)} ${monthName} ${year}`;
}

const filePath = 'c:/Users/HP/Desktop/Reporter/aReport_card/2025_2026/First_term/JSS1/First_term_JSS1_2025_2026.xlsx';
const workbook = xlsx.readFile(filePath);
const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

console.log('Calculating position for first student in file...');
const firstAdm = data[0].Admission_no;
const pos = calculateClassPosition(data, firstAdm);
console.log(`Position for ${firstAdm}: ${pos}`);

console.log('\nTesting DOB formatting:');
console.log(`37850 -> ${formatDOB(37850)}`);
console.log(`37897 -> ${formatDOB(37897)}`);
console.log(`"2003-10-03" -> ${formatDOB('2003-10-03')}`);
