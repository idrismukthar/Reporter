const server = require('./server.js');
// Wait, generatePrincipalRemark is not exported from server.js.
// I'll need to use vm or something, or just copy the function into a test script to check the logic.
// Actually, I can just check the code I wrote.

const mockAvg = 85;
const mockScores = [{ subject: 'Math', total_score: 90 }];
const mockPosition = '1st';
const mockFirstName = 'Kehinde';

// I'll manually test the logic by copying the function here.
function generatePrincipalRemark(avg, scores, position, firstName) {
    const pAvg = parseFloat(avg);
    const cleanName = firstName ? firstName.split(' ')[0].charAt(0).toUpperCase() + firstName.split(' ')[0].slice(1).toLowerCase() : "";
    const namePrefix = cleanName ? `${cleanName}, ` : "";
    let remark = "";
    
    const catA = [
        `${namePrefix}this is an exceptional work! Your dedication to your studies is truly inspiring.`
    ];
    
    if (pAvg >= 80) {
        remark = catA[Math.floor(Math.random() * catA.length)];
    }
    
    if (position === "1st") {
        remark += " And lastly, I want to congratulate you on being at the top of the class.";
    }

    return remark;
}

console.log("Test 1 (High Avg, 1st position):");
console.log(generatePrincipalRemark(85, mockScores, '1st', 'KEHINDE'));

console.log("\nTest 2 (No name):");
console.log(generatePrincipalRemark(85, mockScores, '1st', ''));

console.log("\nTest 3 (Compound name):");
console.log(generatePrincipalRemark(85, mockScores, '1st', 'Ozioma Mira'));
