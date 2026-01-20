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

const runImport = () => {
    console.log("🚀 Starting Bulk Import...");

    db.serialize(() => {
        
        SESSION_FOLDERS.forEach(sessionFolder => {
            const folderPath = path.join(MASTER_ROOT, sessionFolder);
            if (!fs.existsSync(folderPath)) {
                console.log(`⚠️ Folder not found: ${sessionFolder}`);
                return;
            }

            console.log(`\n📂 Processing Session Folder: ${sessionFolder}`);

            CLASSES.forEach(className => {
                const filePath = path.join(folderPath, `${className}.xlsx`);
                if (!fs.existsSync(filePath)) {
                    return;
                }

                try {
                    const wb = xlsx.readFile(filePath);
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const data = xlsx.utils.sheet_to_json(sheet);

                    let newStudentCount = 0;
                    let subjectUpdateCount = 0;

                    const studentStmt = db.prepare(`INSERT OR IGNORE INTO students (
                        admission_no, surname, m_name, l_name, url, 
                        gender, phone, email, address, state_of_origin, lga, dob, club, society
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

                    const subjectStmt = db.prepare(`INSERT OR REPLACE INTO subjects_offered (
                        admission_no, academic_session, class_name, subjects
                    ) VALUES (?, ?, ?, ?)`);

                    // Identify Subject Columns (Everything NOT in bio-data aliases)
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

                    data.forEach(row => {
                        const admission_no = getValue(row, 'admission_no');
                        if (!admission_no) return;

                        let surname = getValue(row, 'surname');
                        if (surname) {
                            // Hash the surname (case-insensitive for convenience)
                            surname = bcrypt.hashSync(surname.toString().trim().toUpperCase(), 10);
                        }
                        const m_name = getValue(row, 'm_name');
                        const l_name = getValue(row, 'l_name');
                        const url = getValue(row, 'url');
                        const gender = getValue(row, 'gender');
                        const phone = getValue(row, 'phone');
                        const email = getValue(row, 'email');
                        const address = getValue(row, 'address');
                        const state_of_origin = getValue(row, 'state_of_origin');
                        const lga = getValue(row, 'lga');
                        const dob = getValue(row, 'dob');
                        const club = getValue(row, 'club');
                        const society = getValue(row, 'society');

                        // 1. Insert Student Bio Data
                        studentStmt.run(
                            admission_no, surname, m_name, l_name, url,
                            gender, phone, email, address, state_of_origin, lga, dob, club, society,
                            function(err) {
                                if (!err && this.changes > 0) newStudentCount++;
                            }
                        );

                        // 2. Extract Subjects (1 or X)
                        const offered = subjectHeaders.filter(h => {
                            const val = (row[h] || '').toString().trim().toUpperCase();
                            return val === '1' || val === 'X';
                        });

                        if (offered.length > 0) {
                            subjectStmt.run(
                                admission_no, sessionFolder, className, offered.join(','),
                                function(err) {
                                    if (!err && this.changes > 0) subjectUpdateCount++;
                                }
                            );
                        }
                    });

                    studentStmt.finalize();
                    subjectStmt.finalize();
                    console.log(`   ✅ ${className}: Processed (${newStudentCount} new students, ${subjectUpdateCount} subject records)`);

                } catch (e) {
                    console.error(`   ❌ Error reading ${className}.xlsx:`, e.message);
                }
            });
        });
        console.log("\n✨ Import Finished.");
    });
};

runImport();