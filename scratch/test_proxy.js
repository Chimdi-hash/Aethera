async function testMethod(method, params = [], id = 1) {
    try {
        const response = await fetch("https://rpc-bradbury.genlayer.com", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method,
                params,
                id
            })
        });
        const text = await response.text();
        console.log(`\n--- ${method} ---`);
        console.log("Status:", response.status);
        console.log("Response:", text);
    } catch (err) {
        console.error(`Error for ${method}:`, err);
    }
}

async function run() {
    // 1. eth_blockNumber
    await testMethod("eth_blockNumber");
    
    // 2. eth_gasPrice
    await testMethod("eth_gasPrice");
    
    // 3. eth_getTransactionCount
    await testMethod("eth_getTransactionCount", ["0x5203eC9FF694a8998eE777D4416fC99B08bABF62", "pending"]);
    
    // 4. eth_estimateGas
    const estimateParams = {
        from: "0x0000000000000000000000000000000000000000",
        to: "0x5203eC9FF694a8998eE777D4416fC99B08bABF62",
        data: "0x"
    };
    await testMethod("eth_estimateGas", [estimateParams]);
}

run();
