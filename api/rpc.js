// api/rpc.js — Vercel Edge Function
//
// Runs at Vercel's edge network. Proxies JSON-RPC to GenLayer Bradbury,
// clamping the `id` field to a safe int32 value before forwarding.
//
// Used by MetaMask when the user has the chain configured with this URL.
// genlayer-js's own calls use the patched bundle (id:1 via Vite transform).
//
// Edge Functions use Web standard Request/Response API (not Node.js req/res).

export const config = { runtime: "edge" };

const UPSTREAM = "https://rpc.bradbury.genlayer.com";

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

function safeId(val) {
    const n = Number(val);
    if (!Number.isNaN(n) && n >= 0 && n <= 2147483647) return Math.floor(n);
    return 1;
}

function fixId(body) {
    if (Array.isArray(body)) {
        body.forEach(obj => { if (obj && "id" in obj) obj.id = safeId(obj.id); });
    } else if (body && typeof body === "object" && "id" in body) {
        body.id = safeId(body.id);
    }
    return body;
}

export default async function handler(request) {
    // CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
            status: 405,
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32700, message: "Parse error" } }),
            { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
        );
    }

    fixId(body);

    try {
        const upstream = await fetch(UPSTREAM, {
            method:  "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            },
            body:    JSON.stringify(body),
        });

        const text = await upstream.text();
        return new Response(text, {
            status: upstream.status,
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(
            JSON.stringify({ jsonrpc: "2.0", id: body?.id ?? 1, error: { code: -32000, message: String(err) } }),
            { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
        );
    }
}
