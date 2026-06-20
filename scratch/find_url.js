import fs from 'fs';
import path from 'path';

const filePath = 'node_modules/genlayer-js/dist/chunk-XCQTIUTU.js';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('TESTNET_JSON_RPC_URL') || lines[i].includes('EXPLORER_URL')) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}
