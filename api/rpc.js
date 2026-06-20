// api/rpc.js — Vercel serverless function
//
// ROOT CAUSE: genlayer-js uses `id: Date.now()` which exceeds int32 max.
// This proxy clamps all JSON-RPC `id` values to safe integers before
// forwarding to the GenLayer Go RPC server. Handles both string ids
// (from MetaMask) and oversized integer ids (from genlayer-js).

const UPSTREAM = "https://rpc.bradbury.genlayer.com";

function fixId(obj) {
    if (obj && typeof obj === "object" && "id" in obj) {
        const n = Number(obj.id);
        // Clamp to int32-safe range or default to 1
        obj.id = (!Number.isNaN(n) && n >= 0 && n <= 2147483647) ? Math.floor(n) : 1;
    }
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin",  "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") { res.status(204).end(); return; }
    if (req.method !== "POST")   { res.status(405).json({ error: "Method Not Allowed" }); return; }

    let body = req.body;

    if (Array.isArray(body)) body.forEach(fixId);
    else fixId(body);

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
            id: body?.id ?? 1,
            error: { code: -32000, message: String(err) },
        });
    }
}
