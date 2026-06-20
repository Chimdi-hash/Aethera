// api/rpc.js — Vercel Edge Function
//
// Runs at Vercel's edge network. Proxies JSON-RPC to GenLayer Bradbury,
// clamping the `id` field to a safe int32 value before forwarding,
// and restoring the original `id` value on the response before returning.
//
// Edge Functions use Web standard Request/Response API (not Node.js req/res).

export const config = { runtime: "edge" };

const UPSTREAM = "https://rpc.bradbury.genlayer.com";

const CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

let nextRpcId = 1;

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

    // Save original IDs and replace with sequential safe integers
    let originalIds;
    let changed = false;

    const fixOne = (obj, idx) => {
        if (obj && typeof obj === "object" && "id" in obj) {
            const idType = typeof obj.id;
            if (idType === "string" || (idType === "number" && obj.id > 2147483647)) {
                if (Array.isArray(body)) {
                    originalIds[idx] = obj.id;
                } else {
                    originalIds = obj.id;
                }
                obj.id = nextRpcId++;
                if (nextRpcId > 2000000000) {
                    nextRpcId = 1;
                }
                changed = true;
            }
        }
    };

    if (Array.isArray(body)) {
        originalIds = [];
        body.forEach(fixOne);
    } else if (body && typeof body === "object") {
        fixOne(body, 0);
    }

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
        let responseBody;

        if (changed) {
            try {
                responseBody = JSON.parse(text);
                if (Array.isArray(responseBody)) {
                    responseBody.forEach((obj, idx) => {
                        if (obj && "id" in obj && Array.isArray(originalIds) && originalIds[idx] !== undefined) {
                            obj.id = originalIds[idx];
                        }
                    });
                } else if (responseBody && typeof responseBody === "object" && "id" in responseBody) {
                    if (originalIds !== undefined) {
                        responseBody.id = originalIds;
                    }
                }
            } catch {
                responseBody = null;
            }
        }

        const finalResponseText = responseBody ? JSON.stringify(responseBody) : text;
        return new Response(finalResponseText, {
            status: upstream.status,
            headers: { ...CORS, "Content-Type": "application/json" },
        });
    } catch (err) {
        // Fallback to originalId if available
        let fallbackId = 1;
        if (changed) {
            if (Array.isArray(originalIds)) {
                fallbackId = originalIds[0] !== undefined ? originalIds[0] : 1;
            } else if (originalIds !== undefined) {
                fallbackId = originalIds;
            }
        } else {
            fallbackId = Array.isArray(body) ? (body[0]?.id ?? 1) : (body?.id ?? 1);
        }

        return new Response(
            JSON.stringify({ jsonrpc: "2.0", id: fallbackId, error: { code: -32000, message: String(err) } }),
            { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
        );
    }
}
