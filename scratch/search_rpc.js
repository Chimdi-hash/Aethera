import fs from 'fs';
import path from 'path';

const files = [
    'frontend/app.js',
    'api/rpc.js',
    'vite.config.js'
];

files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('rpc.bradbury.genlayer.com')) {
            console.log(`Found in: ${file}`);
        }
    } catch (e) {
        console.error(`Could not read ${file}:`, e.message);
    }
});
