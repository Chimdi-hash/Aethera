async function check(url) {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 })
        });
        const text = await res.text();
        console.log(`URL: ${url}`);
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text.slice(0, 200)}`);
    } catch (e) {
        console.error(`Error for ${url}:`, e);
    }
}

async function run() {
    await check("https://aethera.vercel.app/api/rpc");
    await check("https://aethera.vercel.app/api/rpc.js");
}

run();
