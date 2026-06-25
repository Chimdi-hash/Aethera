import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const CONTRACT_ADDRESS  = "0xd7Cd4506337dEa7e5C8B6f5d05ddE3c3292C8b25";
const PROXY_RPC_URL     = "https://rpc-bradbury.genlayer.com";

const client = createClient({
    chain: testnetBradbury,
    endpoint: PROXY_RPC_URL,
});

async function run() {
    try {
        console.log("Simulating contract call to submit_and_evaluate...");
        const result = await client.simulateWriteContract({
            address: CONTRACT_ADDRESS,
            functionName: "submit_and_evaluate",
            args: ["https://github.com/Chimdi-hash/Aethera"],
            account: "0x0000000000000000000000000000000000000000", // dummy sender
        });
        console.log("Simulation result:", result);
    } catch (e) {
        console.error("Simulation failed with error:", e);
    }
}

run();
