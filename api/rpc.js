// api/rpc.js — Vercel serverless function
// Proxies JSON-RPC requests to GenLayer Bradbury, coercing `id` to an integer.
//
// WHY THIS EXISTS:
//   GenLayer's Go RPC server uses `int` for the JSON-RPC `id` field.
//   MetaMask's internal RPC calls use a string UUID as `id`.
//   We cannot patch MetaMask's fetch (it runs in the extension sandbox).
//   Solution: configure MetaMask's chain RPC URL to point here.
//   This function fixes `id` and forwards to the real GenLayer node.

const UPSTREAM = "https://rpc.bradbury.genlayer.com";

function fixId(obj) {
    if (obj && typeof obj === "object" && "id" in obj) {
        const n = Number(obj.id);
        if (!Number.isNaN(n)) obj.id = n;
    }
}

export default async function handler(req, res) {
    // CORS headers for all responses
    res.setHeader("Access-Control-Allow-Origin",  "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }

    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }

    // Vercel auto-parses JSON body into req.body
    let body = req.body;

    // Fix id: coerce string → integer
    if (Array.isArray(body)) {
        body.forEach(fixId);
    } else {
        fixId(body);
    }

    try {
        const upstream = await fetch(UPSTREAM, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(body),
        });

        const data = await upstream.json();
        res.status(upstream.status).json(data);
    } catch (err) {
        res.status(502).json({
            jsonrpc: "2.0",
            id: body?.id ?? null,
            error: { code: -32000, message: String(err) },
        });
    }
}
