import fs from 'fs';

const filePath = 'dist/assets/index-CQWWb629.js';
try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find all occurrences of Buffer or process
    const searchBuffer = (str) => {
        let index = 0;
        const matches = [];
        while ((index = str.indexOf('Buffer', index)) !== -1) {
            const context = str.slice(Math.max(0, index - 30), Math.min(str.length, index + 30));
            matches.push({ index, context });
            index += 6;
        }
        return matches;
    };
    
    const searchProcess = (str) => {
        let index = 0;
        const matches = [];
        while ((index = str.indexOf('process', index)) !== -1) {
            const context = str.slice(Math.max(0, index - 30), Math.min(str.length, index + 30));
            matches.push({ index, context });
            index += 7;
        }
        return matches;
    };
    
    console.log("=== BUFFER MATCHES ===");
    console.log(searchBuffer(content).slice(0, 10));
    
    console.log("\n=== PROCESS MATCHES ===");
    console.log(searchProcess(content).slice(0, 10));
} catch (e) {
    console.error("Failed to read built file:", e.message);
}
