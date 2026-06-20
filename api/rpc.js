// api/rpc.js — Vercel serverless function
// Proxies JSON-RPC to GenLayer Bradbury, coercing the `id` field to an integer.
//
// WHY THIS EXISTS:
//   GenLayer's Go RPC server requires `id` to be an integer.
//   MetaMask sends `id` as a string in its internal RPC calls.
//   We cannot patch MetaMask's fetch (browser extension sandbox).
//   Solution: point MetaMask's network config to THIS proxy URL.
//   This function fixes the `id` and forwards to the real RPC.

const UPSTREAM = "https://rpc.bradbury.genlayer.com";

export default async function handler(req, res) {
    // Only accept POST
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }

    let body = req.body;

    // Fix id: coerce string → integer in single requests and batches
    function fixId(obj) {
        if (obj && typeof obj === "object" && "id" in obj) {
            const n = Number(obj.id);
            if (!Number.isNaN(n)) obj.id = n;
        }
    }

    if (Array.isArray(body)) {
        body.forEach(fixId);
    } else {
        fixId(body);
    }

    // Forward to the real GenLayer RPC
    const upstream = await fetch(UPSTREAM, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
    });

    const data = await upstream.json();

    // Pass CORS headers so browsers don't block the response
    res.setHeader("Access-Control-Allow-Origin",  "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "application/json");
    res.status(upstream.status).json(data);
}
