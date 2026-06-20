async function test() {
    try {
        const response = await fetch("https://rpc-bradbury.genlayer.com", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_blockNumber",
                params: [],
                id: 1
            })
        });
        const data = await response.json();
        console.log("Block Number Response:", data);
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

test();
