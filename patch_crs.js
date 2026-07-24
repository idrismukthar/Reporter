const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const db = new sqlite3.Database('./school.db');

const classNames = ['JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3'];
const session = '2025_2026';
const dbSession = '2025_and_2026';

console.log("🛠️ Scanning Report Cards to patch missing CRS registrations...");

db.all(`SELECT * FROM subjects_offered WHERE academic_session = ?`, [dbSession], (err, records) => {
    if (err) throw err;

    let updateCount = 0;
    
    classNames.forEach(className => {
        const singleFileName = `First_term_${className}_${session}.xlsx`;
        const singleFilePath = path.join(__dirname, 'aReport_card', session, 'First_term', className, singleFileName);
        
        if (fs.existsSync(singleFilePath)) {
            console.log(`📂 Processing: ${singleFilePath}`);
            const workbook = xlsx.readFile(singleFilePath);
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            data.forEach(row => {
                const admStr = (row.Admission_no || '').toString().trim();
                const crsCA = parseFloat(row['Christianity Religious Studies (CA 40)']) || 0;
                const crsExam = parseFloat(row['Christianity Religious Studies (Exam 60)']) || 0;
                
                if (crsCA > 0 || crsExam > 0 || row['Christianity Religious Studies (CA 40)'] || row['Christianity Religious Studies (Exam 60)']) {
                    
                    const studentRecord = records.find(r => r.admission_no.toString() === admStr && r.class_name === className);
                    if (studentRecord) {
                        let subjects = studentRecord.subjects.split(',');
                        if (!subjects.includes('Christianity Religious Studies')) {
                            subjects.push('Christianity Religious Studies');
                            const updatedSubjects = subjects.join(',');
                            
                            db.run(`UPDATE subjects_offered SET subjects = ? WHERE admission_no = ? AND academic_session = ? AND class_name = ?`, 
                            [updatedSubjects, admStr, dbSession, className], function(err) {
                                if (err) console.error(err);
                                else {
                                    updateCount++;
                                    console.log(`✅ Patched Admission No: ${admStr} - added Christianity Religious Studies`);
                                }
                            });
                        }
                    }
                }
            });
        }
    });

    setTimeout(() => {
        console.log(`\n🎉 Patch complete! Patched ${updateCount} students to include Christianity Religious Studies.`);
        db.close();
    }, 2000);
});
