// api/rpc.js — Vercel Serverless Function (Node.js)
// Proxies JSON-RPC to GenLayer Bradbury, clamping/restoring the `id` field.

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

    // Vercel Node.js runtime automatically parses JSON bodies, so req.body is already an object.
    // If it's a string, we parse it just in case.
    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch {
            return res.status(400).json({ jsonrpc: "2.0", id: 1, error: { code: -32700, message: "Parse error" } });
        }
    }

    if (!body) {
        return res.status(400).json({ jsonrpc: "2.0", id: 1, error: { code: -32700, message: "Parse error" } });
    }

    // Save original IDs and replace with sequential safe integers
    let originalIdsMap = {}; // Maps: newIntId -> originalId
    let changed = false;

    const fixOne = (obj) => {
        if (obj && typeof obj === "object" && "id" in obj) {
            const idType = typeof obj.id;
            if (idType === "string" || (idType === "number" && obj.id > 2147483647)) {
                const newId = nextRpcId++;
                if (nextRpcId > 2000000000) {
                    nextRpcId = 1;
                }
                originalIdsMap[newId] = obj.id;
                obj.id = newId;
                changed = true;
            }
        }
    };

    if (Array.isArray(body)) {
        body.forEach(fixOne);
    } else if (body && typeof body === "object") {
        fixOne(body);
    }

    try {
        const upstreamResponse = await fetch(UPSTREAM, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            },
            body: JSON.stringify(body),
        });

        const text = await upstreamResponse.text();
        let responseBody;

        if (changed) {
            try {
                responseBody = JSON.parse(text);
                const restoreOne = (obj) => {
                    if (obj && typeof obj === "object" && "id" in obj) {
                        const origId = originalIdsMap[obj.id];
                        if (origId !== undefined) {
                            obj.id = origId;
                        }
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

        const finalResponseText = responseBody ? JSON.stringify(responseBody) : text;
        res.status(upstreamResponse.status);
        res.setHeader("Content-Type", "application/json");
        return res.send(finalResponseText);
    } catch (err) {
        let fallbackId = 1;
        if (changed) {
            const firstKey = Object.keys(originalIdsMap)[0];
            fallbackId = firstKey !== undefined ? originalIdsMap[firstKey] : 1;
        } else {
            fallbackId = Array.isArray(body) ? (body[0]?.id ?? 1) : (body?.id ?? 1);
        }

        return res.status(502).json({ jsonrpc: "2.0", id: fallbackId, error: { code: -32000, message: String(err) } });
    }
}
