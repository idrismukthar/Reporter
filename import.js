const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const bcrypt = require('bcrypt');

// Configuration
const MASTER_ROOT = path.join(__dirname, 'Master');
// Scan Master folder for session directories automatically
const SESSION_FOLDERS = fs.readdirSync(MASTER_ROOT).filter(f => fs.statSync(path.join(MASTER_ROOT, f)).isDirectory());
// Sort them naturally so older sessions are processed first
SESSION_FOLDERS.sort(); 


// Classes to look for in each folder
const CLASSES = ['JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3'];

// Helper to find key case-insensitively
function getValue(row, keyName) {
    if (!row) return undefined;
    const lowerKey = keyName.toLowerCase();
    
    // Common aliases for keys
    const aliases = {
        'url': ['url', 'passport', 'image'],
        'phone': ['phone', 'phone_number', 'mobile'],
        'state_of_origin': ['state_of_origin', 'state', 'state origin'],
        'lga': ['lga', 'local_govt', 'local government'],
        'admission_no': ['admission_no', 'admission no', 'adm_no']
    };

    const targetKeys = aliases[lowerKey] || [lowerKey];

    const actualKey = Object.keys(row).find(k => targetKeys.includes(k.toLowerCase().trim().replace(/_/g, ' ')));
    // Also try checking with underscores/spaces variations
    if (!actualKey) {
         const k2 = Object.keys(row).find(k => targetKeys.some(tk => k.toLowerCase().replace(/_/g,' ').includes(tk)));
         if(k2) return row[k2];
    }
    
    // Explicit check for exact matches first
    const exact = Object.keys(row).find(k => targetKeys.includes(k.toLowerCase().trim()));
    if(exact) return row[exact];

    // Fallback: Check if any key *contains* the target (risky but useful for "State of Origin")
    // Let's stick to safe aliases
    
    // Re-implemented simple finder
    const foundKey = Object.keys(row).find(k => {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return targetKeys.some(tk => {
            const cleanTK = tk.replace(/[^a-z0-9]/g, '');
            return cleanK === cleanTK;
        });
    });

    if (foundKey) {
        const val = row[foundKey];
        return typeof val === 'string' ? val.trim() : val;
    }
    return undefined;
}

const runImport = async () => {
    console.log("🚀 Starting Bulk Import...");

    try {
        for (const sessionFolder of SESSION_FOLDERS) {
            const folderPath = path.join(MASTER_ROOT, sessionFolder);
            if (!fs.existsSync(folderPath)) {
                console.log(`⚠️ Folder not found: ${sessionFolder}`);
                continue;
            }

            console.log(`\n📂 Processing Session Folder: ${sessionFolder}`);

            for (const className of CLASSES) {
                const filePath = path.join(folderPath, `${className}.xlsx`);
                if (!fs.existsSync(filePath)) continue;

                try {
                    const wb = xlsx.readFile(filePath);
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const data = xlsx.utils.sheet_to_json(sheet);

                    let newStudentCount = 0;
                    let subjectUpdateCount = 0;

                    // Bio Aliases for Subject Filtering
                    const bioAliases = [
                        'admission_no', 'admission no', 'adm_no',
                        'surname', 'm_name', 'middle_name', 'l_name', 'last_name',
                        'url', 'passport', 'image', 'gender', 'phone', 'email', 'address',
                        'state_of_origin', 'lga', 'dob', 'date_of_birth', 'club', 'society'
                    ];

                    const allHeaders = data.length > 0 ? Object.keys(data[0]) : [];
                    const subjectHeaders = allHeaders.filter(h => {
                        const cleanH = h.toLowerCase().trim().replace(/_/g, ' ');
                        return !bioAliases.some(alias => cleanH.includes(alias) || alias.includes(cleanH));
                    });

                    // We wrap DB calls in Promises to await them
                    for (const row of data) {
                        const admission_no = getValue(row, 'admission_no');
                        if (!admission_no) continue;

                        const surname = getValue(row, 'surname');
                        let password = '';
                        if (surname) {
                            password = bcrypt.hashSync(surname.toString().trim().toUpperCase(), 10);
                        }

                        // 1. Insert Student Bio Data
                        await new Promise((resolve, reject) => {
                            db.run(`INSERT OR REPLACE INTO students (
                                admission_no, surname, password, m_name, l_name, url, 
                                gender, phone, email, address, state_of_origin, lga, dob, club, society
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                            [
                                admission_no, surname, password, getValue(row, 'm_name'), getValue(row, 'l_name'), 
                                getValue(row, 'url'), getValue(row, 'gender'), getValue(row, 'phone'), 
                                getValue(row, 'email'), getValue(row, 'address'), getValue(row, 'state_of_origin'), 
                                getValue(row, 'lga'), getValue(row, 'dob'), getValue(row, 'club'), 
                                getValue(row, 'society')
                            ], function(err) {
                                if (err) reject(err);
                                else {
                                    if (this.changes > 0) newStudentCount++;
                                    resolve();
                                }
                            });
                        });

                        // 2. Extract Subjects
                        const offered = subjectHeaders.filter(h => {
                            const val = (row[h] || '').toString().trim().toUpperCase();
                            return val === '1' || val === 'X';
                        });

                        if (offered.length > 0) {
                            await new Promise((resolve, reject) => {
                                db.run(`INSERT OR REPLACE INTO subjects_offered (
                                    admission_no, academic_session, class_name, subjects
                                ) VALUES (?, ?, ?, ?)`,
                                [admission_no, sessionFolder, className, offered.join(',')],
                                function(err) {
                                    if (err) reject(err);
                                    else {
                                        if (this.changes > 0) subjectUpdateCount++;
                                        resolve();
                                    }
                                });
                            });
                        }
                    }

                    console.log(`   ✅ ${className}: Processed (${newStudentCount} students, ${subjectUpdateCount} subjects)`);

                } catch (e) {
                    console.error(`   ❌ Error reading ${className}.xlsx:`, e.stack);
                }
            }
        }
        console.log("\n✨ Import Finished Successfully.");
    } catch (err) {
        console.error("❌ Fatal Import Error:", err);
    } finally {
        // Only close if we are running as a standalone script
        if (require.main === module) {
            db.close();
        }
    }
};

if (require.main === module) {
    runImport();
}
