const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const db = require('./database');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true })); // Built-in, safer
app.use(express.json()); // Handle JSON too just in case
app.use(express.static('public')); 
app.set('view engine', 'ejs');

// Session Config
app.use(session({
    secret: 'secret_key_fresh_start',
    resave: false,
    saveUninitialized: true
}));

// Helper: Ordinal Number Suffix (1st, 2nd, 3rd...)
const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Helper: Calculate Ranking from Excel Data
function calculateClassPosition(data, admission_no) {
    if (!data || data.length === 0) return 'N/A';
    const headers = Object.keys(data[0]);
    const subjects = [];
    headers.forEach(h => {
        if (h.endsWith(' (CA 40)')) subjects.push(h.replace(' (CA 40)', ''));
    });
    if (subjects.length === 0) return 'N/A';

    const rankings = data.map(row => {
        let total = 0;
        subjects.forEach(sub => {
            total += (parseFloat(row[`${sub} (CA 40)`]) || 0) + (parseFloat(row[`${sub} (Exam 60)`]) || 0);
        });
        return { adm: (row.Admission_no || '').toString().trim(), avg: total / subjects.length };
    });

    rankings.sort((a, b) => b.avg - a.avg);
    let currentRank = 0, lastAvg = -1, rankMap = {};
    rankings.forEach((s, index) => {
        if (s.avg !== lastAvg) { currentRank = index + 1; lastAvg = s.avg; }
        rankMap[s.adm] = currentRank;
    });

    const myRank = rankMap[admission_no.trim()];
    return myRank ? getOrdinal(myRank) : 'N/A';
}

// Helper: Calculate Ranking from Multiple Subject Files (2nd/3rd Term)
function calculateMultiFilePosition(folderPath, termPrefix, className, currentAdmissionNo) {
    if (!fs.existsSync(folderPath)) return 'N/A';
    
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
    if (files.length === 0) return 'N/A';

    const studentMap = {}; // { adm: { total: 0, count: 0 } }

    files.forEach(file => {
        try {
            const workbook = xlsx.readFile(path.join(folderPath, file));
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            data.forEach(row => {
                const adm = (row.Admission_no || '').toString().trim();
                if (!adm) return;

                // Combine MCQ and THEORY for exam if they exist, otherwise use CA + Exam or TOTAL
                const ca = parseFloat(row['CA (40 MARKS)']) || 0;
                const mcq = parseFloat(row['MCQ (30 MARKS)']) || 0;
                const theory = parseFloat(row['THEORY (30 MARKS)']) || 0;
                const total = row['TOTAL (100)'] ? parseFloat(row['TOTAL (100)']) : (ca + mcq + theory);

                if (!studentMap[adm]) studentMap[adm] = { total: 0, count: 0 };
                studentMap[adm].total += total;
                studentMap[adm].count += 1;
            });
        } catch (e) {
            console.error(`Error reading ${file}:`, e);
        }
    });

    const rankings = Object.keys(studentMap).map(adm => ({
        adm: adm,
        avg: studentMap[adm].total / studentMap[adm].count
    }));

    rankings.sort((a, b) => b.avg - a.avg);
    
    let currentRank = 0, lastAvg = -1, rankMap = {};
    rankings.forEach((s, index) => {
        if (s.avg !== lastAvg) { currentRank = index + 1; lastAvg = s.avg; }
        rankMap[s.adm] = currentRank;
    });

    const myRank = rankMap[currentAdmissionNo.trim()];
    return myRank ? getOrdinal(myRank) : 'N/A';
}

// Helper: Format Date of Birth
function formatDOB(dob) {
    if (!dob) return 'Not Record';
    let date;
    
    // Check if it's an Excel serial date (number)
    const num = parseFloat(dob);
    if (!isNaN(num) && num > 20000) { 
        // 25569 is Excel's offset for 1970-01-01
        date = new Date(Math.round((num - 25569) * 86400 * 1000));
    } else {
        date = new Date(dob);
    }

    if (isNaN(date.getTime())) return dob;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();

    return `${dayName}, ${getOrdinal(day)} ${monthName} ${year}`;
}

// Helper: Get Average for a specific Term
function getTermAverage(session, term, className, admissionNo, registeredSubjects) {
    const mappedSession = session.replace(/_and_/g, '_');
    
    // Detection Logic: Check if there's a single consolidated file for this term
    const singleFileName = `${term}_${className}_${mappedSession}.xlsx`;
    const singleFilePath = path.join(__dirname, 'aReport_card', mappedSession, term, className, singleFileName);

    if (fs.existsSync(singleFilePath)) {
        // --- 1. Single File Format (e.g., 2025/2026 First Term) ---
        try {
            const workbook = xlsx.readFile(singleFilePath);
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            const row = data.find(r => (r.Admission_no || '').toString().trim() === admissionNo.trim());
            if (!row) return 0;

            const subjectMap = {
                'Basic Tech': 'Basic Technology',
                'CCA': 'Cultural and Creative Arts',
                'French': 'Francais',
                'Computer and ICT': 'INFO AND COMMUNICATION TECHNOLOGY',
                'History': 'Nigerian History',
                'PHE': 'Physical and Health Education',
                'Yoruba': 'Yoruba Language'
            };

            let total = 0, count = 0;
            registeredSubjects.forEach(sub => {
                const excelSubName = subjectMap[sub] || sub;
                const ca = parseFloat(row[`${excelSubName} (CA 40)`]) || 0;
                const exam = parseFloat(row[`${excelSubName} (Exam 60)`]) || 0;
                total += (ca + exam);
                count++;
            });
            return count > 0 ? (total / count) : 0;
        } catch (e) { return 0; }
    } else {
        // --- 2. Multi-File Format (e.g., 2nd/3rd terms, or 2026/2027 First Term) ---
        const classFolderPath = path.join(__dirname, 'aReport_card', mappedSession, term, className);
        if (!fs.existsSync(classFolderPath)) return 0;
        
        let total = 0, count = 0;
        registeredSubjects.forEach(sub => {
            const fileFriendlySub = sub.trim().replace(/\s+/g, '_');
            const fileName = `${term}_${className}_${fileFriendlySub}.xlsx`;
            const filePath = path.join(classFolderPath, fileName);
            if (fs.existsSync(filePath)) {
                try {
                    const workbook = xlsx.readFile(filePath);
                    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    const row = data.find(r => (r.Admission_no || '').toString().trim() === admissionNo.trim());
                    if (row) {
                        const ca = parseFloat(row['CA (40 MARKS)']) || 0;
                        const totalSub = row['TOTAL (100)'] ? parseFloat(row['TOTAL (100)']) : (ca + (parseFloat(row['MCQ (30 MARKS)']) || 0) + (parseFloat(row['THEORY (30 MARKS)']) || 0));
                        total += totalSub;
                        count++;
                    }
                } catch (e) {}
            }
        });
        return count > 0 ? (total / count) : 0;
    }
}

// Helper: Generate Dynamic Principal Remark
function generatePrincipalRemark(avg, scores, position) {
    const pAvg = parseFloat(avg);
    let remark = "";
    
    const catA = [
        "Exceptional work! Your dedication to your studies is truly inspiring.",
        "A brilliant performance. You have shown remarkable consistency and intelligence.",
        "Outstanding results! Keep maintaining this high standard of excellence.",
        "You are a star student. Your academic prowess is simply commendable.",
        "Magnificent performance. Your hard work has yielded great fruit.",
        "An exemplary academic record. You have set a high bar for others.",
        "Truly impressive! Your focus and commitment are evident in these grades.",
        "Wonderful results. Your performance is a testament to your hard work.",
        "Exceptional! You have a bright future ahead with this level of performance.",
        "A masterclass in academic excellence. Keep up the fantastic work.",
        "You have exceeded all expectations. Your results are simply fantastic.",
        "A top-tier performance. Your intellectual curiosity is highly praiseworthy.",
        "Phenomenal work! You are a pride to the school and your parents.",
        "Your results are a clear reflection of your unwavering focus. Well done!",
        "Absolute excellence! May you continue to soar high in your academics."
    ];
    
    const catB = [
        "Very well done! You have performed admirably well this term.",
        "A strong performance. With a bit more effort, you can break into the top bracket.",
        "Good job! Don't relent; aim even higher in the coming term.",
        "Impressive results. Keep pushing your limits to achieve even greater success.",
        "Well done! You have shown great potential. Stay focused and keep working hard.",
        "A commendable performance. Consistency and more effort will yield even better results.",
        "Very good! You have a solid grasp of your subjects. Aim for excellence next time.",
        "Nice work! You are doing very well. Put in more effort to reach the peak.",
        "Good performance. Don't be complacent; keep stiving for the best.",
        "Well done! Your progress is steady. More determination will take you further."
    ];
    
    const catC = [
        "You did well, but you need to buckle down and focus more on your studies.",
        "A fair performance. You have the potential to do much better with more focus.",
        "Good effort, but there is room for significant improvement. Buckle down!",
        "You have passed, but you need to take your academics more seriously.",
        "A decent attempt. Total focus and dedication will help you improve your grades.",
        "You are doing okay, but you need to be more disciplined in your studies.",
        "Not bad, but I expect a more serious approach to your work next term.",
        "You've shown some effort, but you need to buckle down and minimize distractions.",
        "A satisfactory performance. However, you must focus more to achieve higher.",
        "Good progress, but you need to buckle down and give your best next time."
    ];

    if (pAvg >= 80) {
        remark = catA[Math.floor(Math.random() * catA.length)];
    } else if (pAvg >= 60) {
        remark = catB[Math.floor(Math.random() * catB.length)];
        remark += " If you put in more effort than this term, you will score even more and you shouldn't relent.";
    } else if (pAvg >= 50) {
        remark = catC[Math.floor(Math.random() * catC.length)];
        const weakSub = scores.find(s => s.total_score < 60);
        if (weakSub) {
            remark += ` You can work more on ${weakSub.subject.toUpperCase().replace(/_/g, ' ')}.`;
        }
    } else {
        remark = "Fair performance, put more effort.";
    }

    // Append warning for subjects below 58%
    const veryWeakSubs = scores.filter(s => s.total_score < 58).map(s => s.subject.toUpperCase().replace(/_/g, ' '));
    if (veryWeakSubs.length > 0) {
        let subjectsList = "";
        if (veryWeakSubs.length === 1) {
            subjectsList = veryWeakSubs[0];
        } else {
            const last = veryWeakSubs.pop();
            subjectsList = veryWeakSubs.join(', ') + ' and ' + last;
        }
        remark += ` You need to work harder on ${subjectsList}.`;
    }

    // Append 1st position message
    if (position === "1st") {
        remark += " And lastly, I want to congratulate you on being at the top of the class.";
    }

    return remark;
}

// Routes
app.get('/', (req, res) => { res.render('login', { error: null }); });

app.post('/login', (req, res) => {
    const { admission_no, surname } = req.body;
    
    console.log("\n--- DETAILED LOGIN ATTEMPT ---");
    console.log(`Adm: [${admission_no}], Surname: [${surname}]`);

    // 1. Check for missing fields
    if (!admission_no && !surname) {
        return res.render('login', { error: "Both Admission Number and Surname are missing!" });
    }
    if (!admission_no) {
        return res.render('login', { error: "Admission Number is missing. Please enter it." });
    }
    if (!surname) {
        return res.render('login', { error: "Surname (Password) is missing. Please enter it." });
    }

    const cleanAdm = admission_no.trim();
    const cleanPass = surname.trim().toUpperCase();

    // 2. Query Database
    db.get(`SELECT * FROM students WHERE admission_no = ?`, [cleanAdm], (err, student) => {
        if (err) {
            console.error("Database Login Error:", err);
            return res.render('login', { error: "Database error occurred." });
        }

        // 3. Validate Admission Number
        if (!student) {
            console.warn(`Attempt failed: Student [${cleanAdm}] not found.`);
            return res.render('login', { error: `Admission Number "${cleanAdm}" not found in our records.` });
        }

        // 4. Validate Surname
        const storedHash = (student.surname || '').toString().trim();
        console.log(`Check: Input='${cleanPass}', Hash='${storedHash}'`);

        const match = bcrypt.compareSync(cleanPass, storedHash);

        if (match) {
            console.log(`Success: Logged in as ${student.surname}`);
            req.session.student = student;
            res.redirect('/dashboard');
        } else {
            console.warn(`Attempt failed: Incorrect surname for [${cleanAdm}].`);
            return res.render('login', { 
                error: `Incorrect Surname for Admission No ${cleanAdm}. Please check your spelling.` 
            });
        }
    }); 
});

// 3. Student Portal / Dashboard
app.get('/dashboard', (req, res) => {
    if (!req.session.student) {
        return res.redirect('/');
    }
    
    const dbStudent = req.session.student;

    // Fetch all sessions for this student
    db.all(`SELECT * FROM subjects_offered WHERE admission_no = ?`, [dbStudent.admission_no], (err, sessions) => {
        if (err) {
            console.error("Error fetching sessions:", err);
            return res.send("System Error");
        }

        const student = {
            ...dbStudent,
            Admission_no: dbStudent.admission_no,
            Name: `${dbStudent.surname} ${dbStudent.m_name || ''} ${dbStudent.l_name || ''}`.trim(),
            Class: sessions.length > 0 ? sessions[sessions.length-1].class_name : 'No Class',
            Passport: dbStudent.url,
            passport: dbStudent.url,
            class: sessions.length > 0 ? sessions[sessions.length-1].class_name : 'No Class'
        };

        // Map academic_session to match portal.ejs expectation (if needed)
        const mappedSessions = sessions.map(s => ({
            ...s,
            academic_session: s.academic_session,
            class: s.class_name
        }));

        res.render('portal', { 
            student: student,
            sessions: mappedSessions
        });
    });
});

app.get('/profile', (req, res) => {
    if (!req.session.student) {
        return res.redirect('/');
    }

    const dbStudent = req.session.student;

// Fetch all session records for grouping
    db.all(`SELECT * FROM subjects_offered WHERE admission_no = ? ORDER BY academic_session DESC`, 
    [dbStudent.admission_no], (err, records) => {
        if (err) {
            console.error(err);
        }

        const student = {
            ...dbStudent,
            passport: dbStudent.url,
            dob: formatDOB(dbStudent.dob),
            // Use the latest class for the profile header
            class: records.length > 0 ? records[0].class_name : 'No Class'
        };

        // Pass all session records to the view
        res.render('profile', { 
            student: student,
            sessions: records // renamed from subjects for clarity
        });
    });
});

app.get('/portal', (req, res) => {
    res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Route to view results from Excel
app.get('/view-result/:session/:term', (req, res) => {
    if (!req.session.student) return res.redirect('/login');

    const { session, term } = req.params;
    const admission_no = req.session.student.admission_no;

    // Fetch subjects and class for this student in this session
    db.get(`SELECT * FROM subjects_offered WHERE admission_no = ? AND academic_session = ?`, 
    [admission_no, session], (err, record) => {
        if (err || !record) {
            console.error(err || 'No subject record found');
            return res.send('Result not found or not yet available for this term.');
        }

        const className = record.class_name;
        const registeredSubjects = record.subjects.split(',');
        const mappedSession = session.replace(/_and_/g, '_');

        let scores = [];
        let grandTotal = 0;
        let position = 'N/A';
        const dbStudent = req.session.student;
        let studentDetail = { 
            ...dbStudent,
            Name: `${dbStudent.surname} ${dbStudent.m_name || ''} ${dbStudent.l_name || ''}`.trim().toUpperCase(),
            Sex: dbStudent.gender || 'N/A'
        };

        try { // Added a try-catch block for the entire result processing
            const singleFileName = `${term}_${className}_${mappedSession}.xlsx`;
            const singleFilePath = path.join(__dirname, 'aReport_card', mappedSession, term, className, singleFileName);

            if (fs.existsSync(singleFilePath)) {
                // --- 1. Single File Format (e.g., 2025/2026 First Term) ---
                const workbook = xlsx.readFile(singleFilePath);
                const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                const studentRow = data.find(row => (row.Admission_no || '').toString().trim() === admission_no.trim());

                if (!studentRow) return res.send('Your results were not found in the class record.');

                // Map and calculate 1st term scores
                const subjectMap = {
                    'Basic Tech': 'Basic Technology',
                    'CCA': 'Cultural and Creative Arts',
                    'French': 'Francais',
                    'Computer and ICT': 'INFO AND COMMUNICATION TECHNOLOGY',
                    'History': 'Nigerian History',
                    'PHE': 'Physical and Health Education',
                    'Yoruba': 'Yoruba Language'
                };

                registeredSubjects.forEach(sub => {
                    const excelSubName = subjectMap[sub] || sub;
                    const ca = parseFloat(studentRow[`${excelSubName} (CA 40)`]) || 0;
                    const exam = parseFloat(studentRow[`${excelSubName} (Exam 60)`]) || 0;
                    scores.push({ subject: sub, ca_score: ca, exam_score: exam, total_score: ca + exam });
                    grandTotal += (ca + exam);
                });

                position = calculateClassPosition(data, admission_no);
                // Removed Excel bio-data overrides to keep DB consistency

            } else {
                // --- 2. Multi-File Format (e.g., 2nd/3rd terms, or 2026/2027 First Term) ---
                const classFolderPath = path.join(__dirname, 'aReport_card', mappedSession, term, className);
                
                registeredSubjects.forEach(sub => {
                    // File naming: Second_term_JSS1_Agricultural_Science.xlsx
                    const fileFriendlySub = sub.trim().replace(/\s+/g, '_');
                    const fileName = `${term}_${className}_${fileFriendlySub}.xlsx`;
                    const filePath = path.join(classFolderPath, fileName);

                    let subScores = { subject: sub, ca_score: 0, exam_score: 0, total_score: 0 };

                    if (fs.existsSync(filePath)) {
                        try {
                            const workbook = xlsx.readFile(filePath);
                            const sheet = workbook.Sheets[workbook.SheetNames[0]];
                            const data = xlsx.utils.sheet_to_json(sheet);
                            const row = data.find(r => (r.Admission_no || '').toString().trim() === admission_no.trim());

                            if (row) {
                                subScores.ca_score = parseFloat(row['CA (40 MARKS)']) || 0;
                                const mcq = parseFloat(row['MCQ (30 MARKS)']) || 0;
                                const theory = parseFloat(row['THEORY (30 MARKS)']) || 0;
                                subScores.exam_score = mcq + theory;
                                subScores.total_score = row['TOTAL (100)'] ? parseFloat(row['TOTAL (100)']) : (subScores.ca_score + subScores.exam_score);
                                
                                // Removed Excel bio-data overrides to keep DB consistency
                            }
                        } catch (e) {
                            console.error(`Error reading ${fileName}:`, e);
                        }
                    }
                    scores.push(subScores);
                    grandTotal += subScores.total_score;
                });

                position = calculateMultiFilePosition(classFolderPath, term, className, admission_no);
            }

            const totalSubjects = scores.length;
            const currentAvg = totalSubjects > 0 ? (grandTotal / totalSubjects).toFixed(2) : 0;

            // --- Calculate averages for all terms ---
            const t1Avg = parseFloat(getTermAverage(session, 'First_term', className, admission_no, registeredSubjects)) || 0;
            const t2Avg = parseFloat(getTermAverage(session, 'Second_term', className, admission_no, registeredSubjects)) || 0;
            const t3Avg = parseFloat(getTermAverage(session, 'Third_term', className, admission_no, registeredSubjects)) || 0;

            // --- Term-Aware Cumulative Average ---
            let cumulativeAvg = 0;
            const termLower = term.toLowerCase();
            if (termLower === 'first_term') {
                cumulativeAvg = t1Avg.toFixed(2);
            } else if (termLower === 'second_term') {
                cumulativeAvg = ((t1Avg + t2Avg) / 2).toFixed(2);
            } else {
                cumulativeAvg = ((t1Avg + t2Avg + t3Avg) / 3).toFixed(2);
            }

            // --- Promotion Logic (3rd Term Only) ---
            let promoMsg = '';
            if (term.toLowerCase() === 'third_term') {
                const classMap = {
                    'JSS1': 'JSS2', 'JSS2': 'JSS3', 'JSS3': 'SS1',
                    'SS1': 'SS2', 'SS2': 'SS3', 'SS3': 'GRADUATED'
                };
                
                const nextClass = classMap[className.toUpperCase()] || 'the next class';
                
                if (className.toUpperCase() !== 'SS3') {
                    if (parseFloat(cumulativeAvg) >= 50) {
                        promoMsg = `Congratulations, you have been promoted to ${nextClass}`;
                    } else {
                        promoMsg = `You are advised to repeat ${className.toUpperCase()}`;
                    }
                }
            }

            res.render('dashboard', {
                student: {
                    ...studentDetail,
                    Name: studentDetail.Name,
                    Admission_no: admission_no,
                    Class: className,
                    Sex: studentDetail.Sex || 'N/A',
                    Passport: studentDetail.url || 'default.jfif',
                    club: studentDetail.club,
                    society: studentDetail.society
                },
                term: term.replace(/_/g, ' '),
                session: session.replace(/_and_/g, '/'),
                scores: scores,
                totalSubjects: totalSubjects,
                currentAvg: currentAvg,
                t1Avg: t1Avg.toFixed(2), 
                t2Avg: t2Avg.toFixed(2),
                t3Avg: t3Avg.toFixed(2),
                cumulativeAvg: cumulativeAvg,
                position: position,
                promoMsg: promoMsg,
                finalPrincipalRemark: generatePrincipalRemark(currentAvg, scores, position)
            });
        } catch (excelErr) {
            console.error(excelErr);
            res.send('Error reading student results.');
        }
    });
});

app.listen(PORT, () => {
    console.log(`ogbeni open the Server at http://localhost:${PORT}`);
});
