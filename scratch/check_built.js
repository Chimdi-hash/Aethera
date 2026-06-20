import fs from 'fs';

const filePath = 'dist/assets/index-CQWWb629.js';
try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for "process." or "process.env"
    const hasProcess = content.includes('process.') || content.includes('process.env');
    console.log("Has 'process' in bundle:", hasProcess);
    
    // Check for "Buffer"
    const hasBuffer = content.includes('Buffer.') || content.includes('Buffer(');
    console.log("Has 'Buffer' in bundle:", hasBuffer);
} catch (e) {
    console.error("Failed to read built file:", e.message);
}
