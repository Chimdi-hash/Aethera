// vite.config.js — Aethera dApp
//
// ROOT CAUSE OF THE GENLAYER RPC ERROR:
//   genlayer-js uses `id: Date.now()` for JSON-RPC requests.
//   Date.now() returns ~1.78 * 10^12 — far beyond int32 max (2,147,483,647).
//   The GenLayer Go RPC server uses int32 for the `id` field.
//   When Go's JSON parser tries to read 1781939760816 into an int32, it
//   overflows and reports: "cannot unmarshal string into Go struct field
//   Request.id of type int".
//
// FIX:
//   The `patchGenlayerRpcId` plugin below intercepts genlayer-js during
//   bundling and replaces `id: Date.now()` with `id: 1`. This small safe
//   integer fits in any Go int type. Applies to both dev server and builds.
//
// The /api/rpc proxy plugin is kept as a secondary fix to handle MetaMask's
// internal RPC calls (MetaMask also uses its own fetch to the chain RPC URL).

import { defineConfig } from "vite";

const GENLAYER_RPC = "https://rpc.bradbury.genlayer.com";

// ── 1. Fix Date.now() → 1 in genlayer-js bundle ─────────────────────────────
const patchGenlayerRpcId = {
    name: "patch-genlayer-rpc-id",
    transform(code, id) {
        if (id.includes("genlayer-js") && code.includes("id: Date.now()")) {
            // Replace the problematic large timestamp id with integer 1
            const patched = code.replace(/id:\s*Date\.now\(\)/g, "id: 1");
            return { code: patched, map: null };
        }
    },
};

// ── 2. Local dev proxy: /api/rpc → GenLayer RPC (fixes & restores ids) ──
let nextRpcId = 1;

const genLayerRpcProxy = {
    name: "genlayer-rpc-proxy",
    configureServer(server) {
        server.middlewares.use("/api/rpc", async (req, res) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");

            if (req.method === "OPTIONS") {
                res.writeHead(204);
                res.end();
                return;
            }
            if (req.method !== "POST") {
                res.writeHead(405);
                res.end("Method Not Allowed");
                return;
            }

            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const rawBody = Buffer.concat(chunks).toString("utf8");

            let body;
            try {
                body = JSON.parse(rawBody);
            } catch {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32700, message: "Parse error" } }));
                return;
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
                const upstream = await fetch(GENLAYER_RPC, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
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
                res.writeHead(upstream.status, { "Content-Type": "application/json" });
                res.end(finalResponseText);
            } catch (err) {
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

                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ jsonrpc: "2.0", id: fallbackId, error: { code: -32000, message: String(err) } }));
            }
        });
    },
};

export default defineConfig({
    root: "frontend",
    server: {
        port: 8000,
    },
    build: {
        outDir: "../dist",
        emptyOutDir: true,
    },
    plugins: [patchGenlayerRpcId, genLayerRpcProxy],
});
