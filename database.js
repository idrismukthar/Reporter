const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create/Open Database
const db = new sqlite3.Database(path.join(__dirname, 'school.db'));

db.serialize(() => {
    // Table 1: students (Bio Data)
    db.run(`CREATE TABLE IF NOT EXISTS students (
        admission_no TEXT PRIMARY KEY,
        surname TEXT,
        m_name TEXT,
        l_name TEXT,
        url TEXT, 
        gender TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        state_of_origin TEXT,
        lga TEXT,
        dob TEXT,
        club TEXT,
        society TEXT
    )`);

    // Table 2: subjects_offered (Academic Sessions)
    db.run(`CREATE TABLE IF NOT EXISTS subjects_offered (
        admission_no TEXT,
        academic_session TEXT,
        class_name TEXT,
        subjects TEXT, -- Comma-separated list of subjects
        PRIMARY KEY (admission_no, academic_session)
    )`);

    console.log("✅ Database initialized with tables: 'students' and 'subjects_offered'");
});

module.exports = db;