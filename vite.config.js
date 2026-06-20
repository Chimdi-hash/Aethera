// vite.config.js — Aethera dApp
// Adds a local /api/rpc proxy for dev that fixes the JSON-RPC `id` to an integer
// before forwarding to the GenLayer Bradbury RPC. The same endpoint is provided
// by api/rpc.js (Vercel serverless function) in production.

import { defineConfig } from "vite";

const GENLAYER_RPC = "https://rpc.bradbury.genlayer.com";

function fixRpcId(body) {
    const fixOne = (obj) => {
        if (obj && typeof obj === "object" && "id" in obj) {
            const n = Number(obj.id);
            if (!Number.isNaN(n)) obj.id = n;
        }
    };
    if (Array.isArray(body)) body.forEach(fixOne);
    else fixOne(body);
    return body;
}

/** Vite plugin: intercepts POST /api/rpc, fixes the JSON-RPC id, forwards upstream */
const genLayerRpcProxy = {
    name: "genlayer-rpc-proxy",
    configureServer(server) {
        server.middlewares.use("/api/rpc", async (req, res) => {
            // Handle CORS preflight
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

            // Read request body
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const rawBody = Buffer.concat(chunks).toString("utf8");

            let body;
            try {
                body = fixRpcId(JSON.parse(rawBody));
            } catch {
                body = rawBody; // not JSON, pass through
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
    plugins: [genLayerRpcProxy],
});
