const fs = require('fs');

const serverFile = 'server.js';
let content = fs.readFileSync(serverFile, 'utf8');

// Find the start of /view-result/:session/:term
const viewResultMatch = content.match(/app\.get\('\/view-result\/:session\/:term', \(req, res\) => \{[\s\S]*?(?=app\.listen)/);
if (!viewResultMatch) {
    console.error("Could not find view-result route");
    process.exit(1);
}

let viewResultLogic = viewResultMatch[0];
// We want the inside of the route
// The logic starts right after `const admission_no = req.session.student.admission_no;`
const logicStartIdx = viewResultLogic.indexOf('// Fetch subjects and class for this student in this session');

let coreLogic = viewResultLogic.substring(logicStartIdx);
// coreLogic ends with `});\n});\n`
coreLogic = coreLogic.replace(/}\);\n}\);\n$/, '');

const newRoutes = `
// --- ADMIN RESULTS VIEWER ---
app.get('/admin/results', adminAuth, (req, res) => {
    const session = req.query.session || '2025_and_2026';
    const term = req.query.term || 'First_term';
    const className = req.query.class || 'JSS1';

    db.all(\`
        SELECT s.*, so.subjects 
        FROM students s
        JOIN subjects_offered so ON s.admission_no = so.admission_no
        WHERE so.academic_session = ? AND so.class_name = ?
        ORDER BY s.surname ASC
    \`, [session, className], (err, students) => {
        if (err) {
            console.error("Error fetching students for admin results:", err);
            return res.send("System Error");
        }
        res.render('admin_results', {
            students,
            session,
            term,
            className
        });
    });
});

app.get('/admin/view-result/:session/:term/:admission_no', adminAuth, (req, res) => {
    const { session, term, admission_no } = req.params;

    db.get(\`SELECT * FROM students WHERE admission_no = ?\`, [admission_no], (err, dbStudent) => {
        if (err || !dbStudent) return res.send('Student not found');
        
        \n` + coreLogic + `
        });
    });
});
`;

content = content.replace(/app\.listen\(PORT/, newRoutes + '\n\napp.listen(PORT');
fs.writeFileSync(serverFile, content);
console.log("Successfully patched server.js");
