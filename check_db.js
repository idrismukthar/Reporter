const db = require('./database');

db.all("SELECT * FROM students LIMIT 5", (err, rows) => {
    if (err) {
        console.error("Error reading DB:", err);
    } else {
        console.log("--- DB DUMP (First 5 Students) ---");
        console.log(JSON.stringify(rows, null, 2));
    }
});
