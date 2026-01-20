const db = require('./database');

console.log("Checking Database Content...");

db.all("SELECT * FROM students LIMIT 5", (err, rows) => {
    if (err) {
        console.error("DB Error:", err);
    } else {
        console.log(`Found ${rows.length} rows.`);
        rows.forEach(row => {
            console.log(`Adm: '${row.admission_no}', Surname: '${row.surname}', UpperSurname: '${(row.surname||'').toUpperCase()}'`);
        });
    }
});

const admToCheck = '25001';
db.get("SELECT * FROM students WHERE admission_no = ?", [admToCheck], (err, row) => {
    if(row) {
        console.log(`\nSpecific Check [${admToCheck}]:`);
        console.log(row);
        console.log(`Expected Password: '${(row.surname||'').toUpperCase()}'`);
    } else {
        console.log(`\nStudent ${admToCheck} NOT FOUND.`);
    }
});
