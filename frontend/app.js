// ============================================================
//  Aethera Hub — GenLayer Bradbury Testnet Integration
//  Uses genlayer-js SDK for proper writeContract + MetaMask flow
// ============================================================

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

// ── Contract deployed on GenLayer Bradbury Testnet ──────────
const CONTRACT_ADDRESS = "0xA74b8A3D82BFDd52B41AFD2D16a961394804F958";

// ── App state ───────────────────────────────────────────────
let userAddress = null;
let genLayerClient = null;

// ── DOM references ──────────────────────────────────────────
const statusBadge  = document.getElementById("status-badge");
const badgeDot     = document.getElementById("badge-dot");
const liveTitle    = document.getElementById("live-title");
const liveCriteria = document.getElementById("live-criteria");
const liveUrl      = document.getElementById("live-url");
const submissionForm = document.getElementById("submission-form");
const inputUrl     = document.getElementById("input-url");
const btnSubmit    = document.getElementById("btn-submit");
const btnConnect   = document.getElementById("btn-connect");
const logBox       = document.getElementById("log-box");
const logStream    = document.getElementById("log-stream");
const txStatusBox  = document.getElementById("tx-status-box");
const txHashEl     = document.getElementById("tx-hash");
const txStatusEl   = document.getElementById("tx-status");

// ── Logging helper ──────────────────────────────────────────
function log(message, type = "info") {
    if (!logBox || !logStream) return;
    logBox.classList.remove("hidden");
    const p = document.createElement("p");
    const timestamp = new Date().toLocaleTimeString();
    if (type === "success") p.className = "text-emerald-400 my-1 font-semibold";
    else if (type === "error") p.className = "text-rose-400 my-1 font-semibold";
    else if (type === "warn")  p.className = "text-amber-400 my-1 font-semibold";
    else                       p.className = "text-zinc-400 my-1";
    p.innerText = `[${timestamp}] ${message}`;
    logStream.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
}

// ── Status badge update ─────────────────────────────────────
function setStatus(label, active = true) {
    if (!statusBadge) return;
    statusBadge.innerText = label;
    if (active) {
        statusBadge.className = "flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase bg-emerald-950/80 text-emerald-400 rounded-full border border-emerald-500/30";
        if (badgeDot) badgeDot.className = "h-2 w-2 rounded-full bg-emerald-400 animate-pulse";
    } else {
        statusBadge.className = "flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase bg-zinc-950 text-zinc-500 rounded-full border border-zinc-800";
        if (badgeDot) badgeDot.className = "h-2 w-2 rounded-full bg-zinc-600";
    }
}

// ── TX Status display ───────────────────────────────────────
function showTxStatus(hash, status) {
    if (!txStatusBox) return;
    txStatusBox.classList.remove("hidden");
    if (txHashEl) {
        txHashEl.href = `https://studio.genlayer.com/`;
        txHashEl.innerText = hash ? `${hash.slice(0, 12)}...${hash.slice(-8)}` : "—";
    }
    if (txStatusEl) {
        txStatusEl.innerText = status;
        const colors = {
            PENDING:   "text-amber-400",
            PROPOSING: "text-sky-400",
            COMMITTING:"text-sky-400",
            REVEALING: "text-violet-400",
            ACCEPTED:  "text-emerald-400",
            FINALIZED: "text-emerald-400 font-bold",
            CANCELED:  "text-rose-400",
            ERROR:     "text-rose-400",
        };
        txStatusEl.className = `text-xs font-mono ${colors[status] || "text-zinc-400"}`;
    }
}

// ── 1. Initialise dashboard ─────────────────────────────────
async function initAethera() {
    try {
        setStatus("NODE ACTIVE", true);
        if (liveTitle)    liveTitle.innerText    = "Consensus Diagnostics Active";
        if (liveCriteria) liveCriteria.innerText = "Active Rules: Verify content authenticity via GitHub commits link.";
        log("Connected to Aethera decentralized network infrastructure.");
    } catch (e) {
        console.debug("Init error:", e);
    }
}

// ── 2. Connect MetaMask and set up GenLayer client ──────────
async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        log("MetaMask not detected. Please install MetaMask to proceed.", "error");
        return;
    }

    try {
        log("Requesting MetaMask account access…");

        // Request accounts from MetaMask
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];
        log(`Wallet connected: ${userAddress}`, "success");

        // Build GenLayer JS client wired to MetaMask signer
        genLayerClient = createClient({
            chain: testnetBradbury,
            account: userAddress,
        });

        // Switch MetaMask to GenLayer Bradbury Testnet
        log("Switching network to GenLayer Bradbury Testnet…");
        await genLayerClient.connect("testnetBradbury");
        log("Network aligned — GenLayer Bradbury Testnet ✓", "success");

        // Update UI
        if (btnConnect) {
            btnConnect.innerText = `${userAddress.substring(0, 6)}…${userAddress.slice(-4)}`;
            btnConnect.className = "px-5 py-2 text-xs tracking-wider text-emerald-400 border border-emerald-400/40 hover:border-emerald-400 hover:bg-emerald-400/10 rounded transition-all duration-300 bg-transparent";
        }

        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.className = "w-full text-xs font-mono tracking-widest uppercase py-4 rounded shining-btn";
            btnSubmit.innerText  = "BROADCAST EVALUATION";
        }

        setStatus("WALLET CONNECTED", true);

        // Re-connect on account change
        window.ethereum.on("accountsChanged", async (accs) => {
            if (accs.length === 0) {
                userAddress = null;
                genLayerClient = null;
                location.reload();
            } else {
                userAddress = accs[0];
                genLayerClient = createClient({ chain: testnetBradbury, account: userAddress });
                await genLayerClient.connect("testnetBradbury");
                if (btnConnect) btnConnect.innerText = `${userAddress.substring(0, 6)}…${userAddress.slice(-4)}`;
            }
        });

    } catch (err) {
        const msg = err?.message || String(err);
        if (msg.includes("user rejected") || msg.includes("4001")) {
            log("Connection request rejected by user.", "warn");
        } else if (msg.includes("wrong chain") || msg.includes("chain")) {
            log(`Network error: ${msg}`, "error");
            log("Please manually switch MetaMask to GenLayer Bradbury Testnet.", "warn");
        } else {
            log(`Wallet connection failed: ${msg}`, "error");
        }
    }
}

// ── 3. Submit URL and send GenLayer contract transaction ─────
async function handleSubmission(event) {
    if (event) event.preventDefault();

    const targetUrl = inputUrl ? inputUrl.value.trim() : "";

    if (!targetUrl) {
        log("Please enter a valid URL before broadcasting.", "warn");
        return;
    }
    if (!userAddress || !genLayerClient) {
        log("Wallet not connected. Click CONNECT WALLET first.", "error");
        return;
    }

    // ── UI: loading state ─────────────────────────────────
    btnSubmit.disabled = true;
    btnSubmit.innerText = "BROADCASTING…";
    if (txStatusBox) txStatusBox.classList.add("hidden");

    try {
        log(`Preparing transaction: submit_and_evaluate("${targetUrl}")`);
        log("MetaMask will open for your signature — please confirm…", "warn");

        // ── Send tx via GenLayer JS SDK ───────────────────
        // writeContract encodes the call correctly for GenLayer's
        // intelligent contract format and prompts MetaMask to sign.
        const txHash = await genLayerClient.writeContract({
            address: CONTRACT_ADDRESS,
            functionName: "submit_and_evaluate",
            args: [targetUrl],
            value: BigInt(0),
        });

        log(`Transaction submitted! Hash: ${txHash}`, "success");
        showTxStatus(txHash, "PENDING");

        // ── Poll for ACCEPTED status (faster) ────────────
        log("Waiting for network consensus (ACCEPTED)…");
        showTxStatus(txHash, "PROPOSING");

        const receipt = await genLayerClient.waitForTransactionReceipt({
            hash: txHash,
            status: TransactionStatus.ACCEPTED,
            interval: 5_000,   // poll every 5 s
            retries: 30,        // up to ~2.5 min
        });

        showTxStatus(txHash, "ACCEPTED");
        log(`Consensus reached — state: ACCEPTED ✓`, "success");
        log(`AI validation triggered. Contract state updated.`, "success");

        if (liveUrl) liveUrl.innerText = `Last Validated Target: ${targetUrl}`;
        if (inputUrl) inputUrl.value = "";

        // ── Optional: wait for FINALIZED ─────────────────
        log("Awaiting full finalization…");
        try {
            await genLayerClient.waitForTransactionReceipt({
                hash: txHash,
                status: TransactionStatus.FINALIZED,
                interval: 6_000,
                retries: 20,
            });
            showTxStatus(txHash, "FINALIZED");
            log("Transaction FINALIZED on GenLayer Bradbury Testnet ✓", "success");
        } catch {
            log("Finalization pending (this is normal — transaction is already ACCEPTED).", "warn");
        }

    } catch (err) {
        const msg = err?.message || String(err);

        if (msg.includes("user rejected") || msg.includes("4001") || msg.includes("denied")) {
            log("Transaction rejected by user in MetaMask.", "warn");
            showTxStatus("", "CANCELED");
        } else if (msg.includes("insufficient funds") || msg.includes("insufficient balance")) {
            log("Insufficient GEN token balance. Please fund your wallet on Bradbury Testnet.", "error");
            showTxStatus("", "ERROR");
        } else if (msg.includes("wrong chain") || msg.includes("chain mismatch")) {
            log("Wrong network: Please switch MetaMask to GenLayer Bradbury Testnet.", "error");
            log("Network details → Chain ID: 4221 | RPC: https://rpc.bradbury.genlayer.com", "warn");
            showTxStatus("", "ERROR");
        } else if (msg.includes("timed out") || msg.includes("retries")) {
            log("Consensus is taking longer than expected. Your transaction may still succeed.", "warn");
            log("Check the explorer or retry in a few minutes.", "warn");
        } else {
            log(`Transaction error: ${msg}`, "error");
            showTxStatus("", "ERROR");
        }
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "BROADCAST EVALUATION";
    }
}

// ── Bootstrap ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initAethera();
    if (btnConnect)     btnConnect.addEventListener("click", connectWallet);
    if (submissionForm) submissionForm.addEventListener("submit", handleSubmission);
});