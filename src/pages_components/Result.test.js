// Test file for Result.jsx grading system
const { determineGrade } = require('./Result.jsx');

// Use the imported determineGrade function for testing

// Test cases for the new grading system
console.log("Testing Grading System:");
console.log("====================");

// Test case 1: A+ grade (96-100)
console.log("Score: 98 -> Grade:", determineGrade(98)); // Should be A+
console.log("Score: 96 -> Grade:", determineGrade(96)); // Should be A+

// Test case 2: A grade (86-95)
console.log("Score: 90 -> Grade:", determineGrade(90)); // Should be A
console.log("Score: 86 -> Grade:", determineGrade(86)); // Should be A

// Test case 3: B+ grade (80-85)
console.log("Score: 83 -> Grade:", determineGrade(83)); // Should be B+
console.log("Score: 80 -> Grade:", determineGrade(80)); // Should be B+

// Test case 4: B grade (70-79)
console.log("Score: 75 -> Grade:", determineGrade(75)); // Should be B
console.log("Score: 70 -> Grade:", determineGrade(70)); // Should be B

// Test case 5: C+ grade (66-69)
console.log("Score: 68 -> Grade:", determineGrade(68)); // Should be C+
console.log("Score: 66 -> Grade:", determineGrade(66)); // Should be C+

// Test case 6: C grade (56-65)
console.log("Score: 60 -> Grade:", determineGrade(60)); // Should be C
console.log("Score: 56 -> Grade:", determineGrade(56)); // Should be C

// Test case 7: D grade (46-55)
console.log("Score: 50 -> Grade:", determineGrade(50)); // Should be D
console.log("Score: 46 -> Grade:", determineGrade(46)); // Should be D

// Test case 8: E grade (<46)
console.log("Score: 40 -> Grade:", determineGrade(40)); // Should be E
console.log("Score: 0 -> Grade:", determineGrade(0));   // Should be E

console.log("\nGrading system validation complete!");