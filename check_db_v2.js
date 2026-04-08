const db = require('./database');

db.all("SELECT admission_no, surname, m_name, l_name FROM students LIMIT 5", (err, rows) => {
    if (err) {
        console.error("Error reading DB:", err);
    } else {
        console.log("--- STUDENT DATA ---");
        rows.forEach(r => {
            console.log(`Adm: ${r.admission_no}, Surname: ${r.surname}, MNAME: ${r.m_name}, LNAME: ${r.l_name}`);
        });
    }
});
