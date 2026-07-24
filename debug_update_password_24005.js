const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbFile = path.join(__dirname, "school.db");
const adm = process.argv[2] || "24005";
const newSurname = process.argv[3] || "QOZEEM";

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) return console.error("DB open error:", err.message);
});

db.serialize(() => {
  const newHash = bcrypt.hashSync(
    newSurname.toString().trim().toUpperCase(),
    10,
  );
  db.run(
    "UPDATE students SET password = ? WHERE admission_no = ?",
    [newHash, adm],
    function (err) {
      if (err) return console.error("Update error:", err.message);
      console.log(`Password hash updated; rows affected: ${this.changes}`);

      db.get(
        "SELECT admission_no, surname, password FROM students WHERE admission_no = ?",
        [adm],
        (err, row) => {
          if (err) console.error("Select error:", err.message);
          else {
            console.log("DB row after update:", {
              admission_no: row.admission_no,
              surname: row.surname,
            });
            const ok = bcrypt.compareSync(
              newSurname.toString().trim(),
              row.password,
            );
            console.log(
              `Local bcrypt verification with input '${newSurname}':`,
              ok ? "MATCH" : "NO MATCH",
            );
          }
          db.close();
        },
      );
    },
  );
});
