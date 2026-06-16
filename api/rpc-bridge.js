export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { method, params } = req.body;
        const TARGET_RPC = "https://rpc.bradbury.genlayer.com";
        const pureIntegerId = Math.floor(Math.random() * 100000) + 1;

        const payload = {
            jsonrpc: "2.0",
            id: pureIntegerId,
            method: method || "eth_sendTransaction",
            params: params || []
        };

        const rpcResponse = await fetch(TARGET_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const textData = await rpcResponse.text();
        if (!textData) {
            return res.status(502).json({ jsonrpc: "2.0", error: { message: "Empty response from node." } });
        }

        return res.status(200).json(JSON.parse(textData));
    } catch (error) {
        return res.status(500).json({ jsonrpc: "2.0", error: { message: error.message } });
    }
}