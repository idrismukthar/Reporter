const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbFile = path.join(__dirname, "school.db");
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
  if (err) return console.error("DB open error:", err.message);
});

const adm = process.argv[2] || "24005";

db.serialize(() => {
  db.get("SELECT * FROM students WHERE admission_no = ?", [adm], (err, row) => {
    if (err) console.error("students query error:", err.message);
    else console.log("students row:", row);
  });

  db.get(
    "SELECT * FROM subjects_offered WHERE admission_no = ?",
    [adm],
    (err, row) => {
      if (err) console.error("subjects_offered query error:", err.message);
      else console.log("subjects_offered row:", row);
    },
  );
});

db.close();
