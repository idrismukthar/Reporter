const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const masterFiles = [
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2025_and_2026\\JSS3.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2025_and_2026\\SSS1.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2025_and_2026\\SSS2.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2025_and_2026\\SSS3.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2025_and_2026\\JSS1.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2025_and_2026\\JSS2.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2026_and_2027\\JSS1.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2026_and_2027\\JSS2.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2026_and_2027\\JSS3.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2026_and_2027\\SSS1.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2026_and_2027\\SSS2.xlsx",
    "C:\\Users\\HP\\Desktop\\Reporter\\Master\\2026_and_2027\\SSS3.xlsx"
];

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(path.join(__dirname, 'school.db'));

console.log("🛠️ Starting Master files patch for Christianity Religious Studies...");

db.all(`SELECT * FROM subjects_offered`, [], (err, subjectsOffered) => {
    if (err) {
        console.error("DB Error:", err);
        return;
    }

    let modifiedFilesCount = 0;

    masterFiles.forEach(importPath => {
        if (!fs.existsSync(importPath)) {
            console.log(`⚠️ File not found, skipping: ${importPath}`);
            return;
        }

        try {
            console.log(`📂 Processing: ${importPath}`);
            const workbook = xlsx.readFile(importPath);
            const sheetName = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

            // Ensure column exists for first row at least so headers persist correctly if it was missing 
            const hasCRSColumn = Object.keys(data[0] || {}).find(k => k.toLowerCase().includes('christian') || k.trim() === 'CRS');
            let crsHeaderName = hasCRSColumn || 'Christianity Religious Studies';

            let isModified = false;

            const sessionMatch = importPath.includes('2026_and_2027') ? '2026_and_2027' : '2025_and_2026';
            const className = path.basename(importPath, '.xlsx');

            const modifiedData = data.map(row => {
                const adm = (row.admission_no || row.Admission_no || '').toString().trim();
                if (!adm) return row;

                // Check their subject list from database
                const studentSubjects = subjectsOffered.find(s => s.admission_no === adm && s.academic_session === sessionMatch && s.class_name === className);
                
                let takesCRS = false;
                if (studentSubjects && studentSubjects.subjects && studentSubjects.subjects.includes('Christianity Religious Studies')) {
                    takesCRS = true;
                } else if (studentSubjects && studentSubjects.subjects && !studentSubjects.subjects.includes('Islamic Religious Studies')) {
                    // Fallback logici: If they don't take IRS, they probably take CRS? 
                    // Better to rely on just what's in the DB if we patched it. But since we only patched first term, 
                    // let's also use the logic: if IRS is not '1' or 'X', we set CRS to '1'.
                    const irsHeader = Object.keys(row).find(k => k.toLowerCase().includes('islamic'));
                    const irsVal = irsHeader ? row[irsHeader].toString().toUpperCase() : '';
                    if (irsVal !== '1' && irsVal !== 'X') {
                        takesCRS = true;
                    }
                } else {
                    const irsHeader = Object.keys(row).find(k => k.toLowerCase().includes('islamic'));
                    const irsVal = irsHeader ? row[irsHeader].toString().toUpperCase() : '';
                    if (irsVal !== '1' && irsVal !== 'X') {
                        takesCRS = true;
                    }
                }

                if (takesCRS) {
                    if (row[crsHeaderName] !== 1 && row[crsHeaderName] !== '1' && row[crsHeaderName] !== 'X') {
                        row[crsHeaderName] = 1;
                        isModified = true;
                    }
                } else {
                     if (!row[crsHeaderName]) {
                        row[crsHeaderName] = '';
                     }
                }

                return row;
            });

            if (isModified) {
                 // Convert modified JSON back to sheet
                 const newSheet = xlsx.utils.json_to_sheet(modifiedData);
                 workbook.Sheets[sheetName] = newSheet;
                 xlsx.writeFile(workbook, importPath);
                 modifiedFilesCount++;
                 console.log(`✅ Updated and saved: ${importPath}`);
            } else {
                 console.log(`  No changes needed for: ${importPath}`);
            }

        } catch (e) {
            console.error(`❌ Error processing ${importPath}:`, e.message);
        }
    });

    console.log(`\n🎉 Patch complete! Modified ${modifiedFilesCount} Master files.`);
    db.close();
});
