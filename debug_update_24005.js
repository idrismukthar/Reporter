const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const dbFile = path.join(__dirname, "school.db");
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) return console.error("DB open error:", err.message);
});

const adm = process.argv[2] || "24005";
const newSurname = process.argv[3] || "QOZEEM";

db.serialize(() => {
  db.run(
    "UPDATE students SET surname = ? WHERE admission_no = ?",
    [newSurname, adm],
    function (err) {
      if (err) return console.error("Update error:", err.message);
      console.log(`Updated rows: ${this.changes}`);

      db.get(
        "SELECT admission_no, surname, m_name, l_name FROM students WHERE admission_no = ?",
        [adm],
        (err, row) => {
          if (err) console.error("Select error:", err.message);
          else console.log("Updated row:", row);
          db.close();
        },
      );
    },
  );
});
