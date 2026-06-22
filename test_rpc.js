import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

async function test() {
    const client = createClient({
        chain: testnetBradbury,
        endpoint: "https://rpc-bradbury.genlayer.com"
    });

    try {
        const tx = await client.getTransaction({ hash: "0x1234567890123456789012345678901234567890123456789012345678901234" });
        console.log(tx);
    } catch (err) {
        console.error("Error from client:", err.message || err);
    }
}

test();
