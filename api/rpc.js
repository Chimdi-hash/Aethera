// api/rpc.js — Vercel Serverless Function (Node.js, ESM)
// Proxies JSON-RPC to GenLayer Bradbury, clamping/restoring the `id` field.
//
// This file MUST use ESM syntax (export default) because package.json
// specifies "type": "module".

const UPSTREAM = "https://rpc-bradbury.genlayer.com";

let nextRpcId = 1;

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Parse body robustly from pre-parsed object, Buffer, string, or stream.
    let body = req.body;
    if (Buffer.isBuffer(body)) {
        body = body.toString("utf8");
    }
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch {
            return res.status(400).json({
                jsonrpc: "2.0", id: 1,
                error: { code: -32700, message: "Parse error" },
            });
        }
    } else if (body && typeof body === "object" && typeof body.on === "function") {
        try {
            const chunks = [];
            for await (const chunk of body) {
                chunks.push(chunk);
            }
            const raw = Buffer.concat(chunks).toString("utf8");
            body = JSON.parse(raw);
        } catch {
            return res.status(400).json({
                jsonrpc: "2.0", id: 1,
                error: { code: -32700, message: "Parse error" },
            });
        }
    } else if (!body) {
        try {
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            const raw = Buffer.concat(chunks).toString("utf8");
            if (raw) {
                body = JSON.parse(raw);
            }
        } catch {
            // Ignore parse errors here, empty body check is next
        }
    }

    if (!body || (typeof body === "object" && Object.keys(body).length === 0)) {
        return res.status(400).json({
            jsonrpc: "2.0", id: 1,
            error: { code: -32700, message: "Empty body" },
        });
    }

    // Save original IDs and replace with sequential safe integers
    const originalIdsMap = {}; // newIntId → originalId
    let changed = false;

    const fixOne = (obj) => {
        if (obj && typeof obj === "object" && "id" in obj) {
            const idType = typeof obj.id;
            // GenLayer's Go server rejects string IDs. Large ints are fine but
            // we clamp them too for safety.
            if (idType === "string" || (idType === "number" && obj.id > 2147483647)) {
                const newId = nextRpcId++;
                if (nextRpcId > 2_000_000_000) nextRpcId = 1;
                originalIdsMap[newId] = obj.id;
                obj.id = newId;
                changed = true;
            }
        }
    };

    if (Array.isArray(body)) {
        body.forEach(fixOne);
    } else {
        fixOne(body);
    }

    try {
        const upstreamRes = await fetch(UPSTREAM, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const text = await upstreamRes.text();
        let responseBody = null;

        if (changed) {
            try {
                responseBody = JSON.parse(text);
                const restoreOne = (obj) => {
                    if (obj && typeof obj === "object" && "id" in obj) {
                        const origId = originalIdsMap[obj.id];
                        if (origId !== undefined) obj.id = origId;
                    }
                };
                if (Array.isArray(responseBody)) {
                    responseBody.forEach(restoreOne);
                } else if (responseBody && typeof responseBody === "object") {
                    restoreOne(responseBody);
                }
            } catch {
                responseBody = null;
            }
        }

        const finalText = responseBody ? JSON.stringify(responseBody) : text;
        res.status(upstreamRes.status);
        res.setHeader("Content-Type", "application/json");
        return res.send(finalText);
    } catch (err) {
        // Network error reaching upstream
        let fallbackId = 1;
        if (changed) {
            const firstKey = Object.keys(originalIdsMap)[0];
            fallbackId = firstKey !== undefined ? originalIdsMap[firstKey] : 1;
        } else {
            fallbackId = Array.isArray(body) ? (body[0]?.id ?? 1) : (body?.id ?? 1);
        }

        return res.status(502).json({
            jsonrpc: "2.0", id: fallbackId,
            error: { code: -32000, message: `Upstream error: ${err.message || err}` },
        });
    }
}
