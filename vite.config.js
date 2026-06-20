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

// ── 2. Local dev proxy: /api/rpc → GenLayer RPC (also fixes any stray ids) ──
function fixRpcId(body) {
    const fixOne = (obj) => {
        if (obj && typeof obj === "object" && "id" in obj) {
            const n = Number(obj.id);
            if (!Number.isNaN(n) && n <= 2147483647) {
                obj.id = n;
            } else {
                obj.id = 1; // fallback to safe integer
            }
        }
    };
    if (Array.isArray(body)) body.forEach(fixOne);
    else fixOne(body);
    return body;
}

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
                body = fixRpcId(JSON.parse(rawBody));
            } catch {
                body = rawBody;
            }

            try {
                const upstream = await fetch(GENLAYER_RPC, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                const text = await upstream.text();
                res.writeHead(upstream.status, { "Content-Type": "application/json" });
                res.end(text);
            } catch (err) {
                res.writeHead(502);
                res.end(JSON.stringify({ error: { code: -32000, message: String(err) } }));
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
