// ============================================================
//  Aethera Hub — GenLayer Bradbury Testnet
//  app.js — all DOM work happens inside DOMContentLoaded
// ============================================================

import { createClient }                              from "genlayer-js";
import { testnetBradbury }                           from "genlayer-js/chains";
import { TransactionStatus }                         from "genlayer-js/types";
import { toAccount, serializeTransaction, keccak256 } from "viem";

// ── Config ──────────────────────────────────────────────────
const CONTRACT_ADDRESS  = "0xA74b8A3D82BFDd52B41AFD2D16a961394804F958";
const CHAIN_ID_HEX      = "0x107d";   // 4221
const CHAIN_ID_DEC      = 4221;
const RPC_URL           = "https://rpc.bradbury.genlayer.com";

// ── Direct RPC helper — id is always an integer ──────────────────────────────
// GenLayer Bradbury's Go RPC rejects requests where `id` is a string.
// Every call to the GenLayer RPC goes through here so we always control the id.
async function rpcCall(method, params = []) {
    const res = await fetch(RPC_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const data = await res.json();
    if (data.error) throw Object.assign(new Error(data.error.message ?? "RPC error"), data.error);
    return data.result;
}

// ── MetaMask-backed viem local account ───────────────────────────────────────
// genlayer-js's _sendTransaction() has two code paths:
//   A. account.type === "local"  → signTransaction() + eth_sendRawTransaction
//   B. plain address string      → eth_sendTransaction directly on the RPC
//
// The GenLayer Bradbury RPC does NOT support eth_sendTransaction (returns
// "Method not supported"). Path A is the ONLY viable path.
//
// We create a viem "local account" object whose signTransaction() delegates
// to MetaMask:
//   1. Build the unsigned EIP-155 legacy tx with serializeTransaction (no sig)
//   2. Hash it with keccak256
//   3. Ask MetaMask to sign the hash via eth_sign (raw ECDSA, no prefix)
//   4. Decode the 65-byte signature → {r, s, v}
//   5. Re-serialize the tx WITH the signature → final signed hex
//
// genlayer-js then submits this via eth_sendRawTransaction using its own direct
// fetch (with id: Date.now(), a valid integer) — no MetaMask relay involved.
async function buildMetaMaskAccount(address) {
    return toAccount({
        address,

        // Called by genlayer-js to produce the signed raw transaction bytes
        async signTransaction(txRequest) {
            // Build the EIP-155 unsigned transaction (no r/s/v)
            const unsigned = {
                type:     "legacy",
                chainId:  txRequest.chainId ?? CHAIN_ID_DEC,
                nonce:    txRequest.nonce,
                gasPrice: txRequest.gasPrice,
                gas:      txRequest.gas,
                to:       txRequest.to,
                value:    txRequest.value ?? 0n,
                data:     txRequest.data ?? "0x",
            };

            // Serialize unsigned tx then hash it
            const unsignedHex = serializeTransaction(unsigned);
            const txHash      = keccak256(unsignedHex);

            // Ask MetaMask to sign the raw hash (no "\x19Ethereum..." prefix)
            const sigHex = await window.ethereum.request({
                method: "eth_sign",
                params: [address, txHash],
            });

            // Parse the 65-byte sig: r (32) | s (32) | v (1)
            const sig = sigHex.slice(2); // strip 0x
            const r   = `0x${sig.slice(0,  64)}`;
            const s   = `0x${sig.slice(64, 128)}`;
            const vRaw = parseInt(sig.slice(128, 130), 16);
            // EIP-155 replay-protection: v = chainId*2 + 35 or 36
            const v = BigInt(vRaw < 27 ? vRaw + CHAIN_ID_DEC * 2 + 35 : vRaw);

            // Serialize WITH signature → signed raw tx
            return serializeTransaction(unsigned, { r, s, v });
        },

        // MetaMask holds the private key — we never sign raw messages directly
        async signMessage({ message }) {
            return window.ethereum.request({
                method: "personal_sign",
                params: [typeof message === "string" ? message : message.raw, address],
            });
        },

        async signTypedData(typedData) {
            return window.ethereum.request({
                method: "eth_signTypedData_v4",
                params: [address, JSON.stringify(typedData)],
            });
        },
    });
}

// ── App state ───────────────────────────────────────────────
let userAddress     = null;
let genLayerClient  = null;

// ── ALL logic is deferred until the DOM is ready ────────────
document.addEventListener("DOMContentLoaded", () => {

    // ── DOM refs (safe here — body is fully parsed) ──────
    const statusBadge   = document.getElementById("status-badge");
    const badgeDot      = document.getElementById("badge-dot");
    const liveTitle     = document.getElementById("live-title");
    const liveCriteria  = document.getElementById("live-criteria");
    const liveUrl       = document.getElementById("live-url");
    const submissionForm= document.getElementById("submission-form");
    const inputUrl      = document.getElementById("input-url");
    const btnSubmit     = document.getElementById("btn-submit");
    const btnConnect    = document.getElementById("btn-connect");
    const logBox        = document.getElementById("log-box");
    const logStream     = document.getElementById("log-stream");
    const txStatusBox   = document.getElementById("tx-status-box");
    const txHashEl      = document.getElementById("tx-hash");
    const txStatusEl    = document.getElementById("tx-status");

    // ── Helpers ──────────────────────────────────────────

    function log(message, type = "info") {
        if (!logBox || !logStream) return;
        logBox.classList.remove("hidden");
        const p = document.createElement("p");
        const ts = new Date().toLocaleTimeString();
        if      (type === "success") p.className = "text-emerald-400 my-1 font-semibold";
        else if (type === "error")   p.className = "text-rose-400 my-1 font-semibold";
        else if (type === "warn")    p.className = "text-amber-400 my-1";
        else                         p.className = "text-zinc-400 my-1";
        p.textContent = `[${ts}] ${message}`;
        logStream.appendChild(p);
        logBox.scrollTop = logBox.scrollHeight;
    }

    function setStatus(label, active = true) {
        if (!statusBadge) return;
        statusBadge.textContent = label;
        if (active) {
            statusBadge.className =
                "flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase bg-emerald-950/80 text-emerald-400 rounded-full border border-emerald-500/30";
            if (badgeDot) badgeDot.className =
                "h-2 w-2 rounded-full bg-emerald-400 animate-pulse";
        } else {
            statusBadge.className =
                "flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase bg-zinc-950 text-zinc-500 rounded-full border border-zinc-800";
            if (badgeDot) badgeDot.className =
                "h-2 w-2 rounded-full bg-zinc-600";
        }
    }

    function showTxStatus(hash, status) {
        if (!txStatusBox) return;
        txStatusBox.classList.remove("hidden");
        if (txHashEl) {
            txHashEl.textContent = hash
                ? `${hash.slice(0, 12)}...${hash.slice(-8)}`
                : "—";
        }
        if (txStatusEl) {
            txStatusEl.textContent = status;
            const colors = {
                PENDING:    "text-amber-400",
                PROPOSING:  "text-sky-400",
                COMMITTING: "text-sky-400",
                REVEALING:  "text-violet-400",
                ACCEPTED:   "text-emerald-400",
                FINALIZED:  "text-emerald-400 font-bold",
                CANCELED:   "text-rose-400",
                ERROR:      "text-rose-400",
            };
            txStatusEl.className = `text-xs font-mono ${colors[status] || "text-zinc-400"}`;
        }
    }

    function setSubmitReady(ready) {
        if (!btnSubmit) return;
        if (ready) {
            btnSubmit.disabled = false;
            btnSubmit.className =
                "w-full text-xs font-mono tracking-widest uppercase py-4 rounded shining-btn";
            btnSubmit.textContent = "BROADCAST EVALUATION";
        } else {
            btnSubmit.disabled = true;
            btnSubmit.className =
                "w-full text-xs font-mono tracking-widest uppercase py-4 rounded faded-btn";
        }
    }

    // ── 1. Init ──────────────────────────────────────────
    function initAethera() {
        setStatus("NODE ACTIVE", true);
        if (liveTitle)    liveTitle.textContent    = "Consensus Diagnostics Active";
        if (liveCriteria) liveCriteria.textContent =
            "Active Rules: Verify content authenticity via GitHub commits link.";
        log("Aethera network infrastructure connected — GenLayer Bradbury Testnet.");
    }

    // ── 2. Network switch helper (MetaMask native) ───────
    async function ensureGenLayerNetwork() {
        const currentChainHex = await window.ethereum.request({ method: "eth_chainId" });
        if (currentChainHex.toLowerCase() === CHAIN_ID_HEX.toLowerCase()) return; // already correct

        log("Switching MetaMask to GenLayer Bradbury Testnet…");
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: CHAIN_ID_HEX }],
            });
        } catch (switchErr) {
            // Chain not added yet — add it
            if (switchErr.code === 4902 || switchErr.message?.includes("Unrecognized chain")) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId:  CHAIN_ID_HEX,
                        chainName: "GenLayer Bradbury Testnet",
                        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
                        rpcUrls: [RPC_URL],
                        blockExplorerUrls: ["https://studio.genlayer.com/"],
                    }],
                });
            } else {
                throw switchErr;
            }
        }

        // Confirm switch
        const confirmed = await window.ethereum.request({ method: "eth_chainId" });
        if (confirmed.toLowerCase() !== CHAIN_ID_HEX.toLowerCase()) {
            throw new Error("MetaMask did not switch to GenLayer Bradbury Testnet. Please switch manually.");
        }
    }

    // ── 3. Connect wallet ────────────────────────────────
    async function connectWallet() {
        if (typeof window.ethereum === "undefined") {
            log("MetaMask not detected. Please install MetaMask.", "error");
            return;
        }

        try {
            if (btnConnect) {
                btnConnect.textContent = "CONNECTING…";
                btnConnect.disabled = true;
            }

            log("Requesting MetaMask account access…");
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            if (!accounts || accounts.length === 0) throw new Error("No accounts returned.");
            userAddress = accounts[0];
            log(`Wallet connected: ${userAddress}`, "success");

            // Switch to GenLayer network first
            await ensureGenLayerNetwork();
            log("Switched to GenLayer Bradbury Testnet ✓", "success");

            // Build GenLayer JS client with a MetaMask-backed local account.
            // Passing a local account object forces genlayer-js into the
            // sign+sendRaw path, bypassing eth_sendTransaction (unsupported on
            // the GenLayer Bradbury RPC).
            const mmAccount = await buildMetaMaskAccount(userAddress);
            genLayerClient = createClient({
                chain:   testnetBradbury,
                account: mmAccount,
            });

            // Update connect button
            if (btnConnect) {
                btnConnect.textContent =
                    `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`;
                btnConnect.disabled = false;
                btnConnect.className =
                    "px-5 py-2 text-xs tracking-wider text-emerald-400 border border-emerald-400/40 hover:border-emerald-400 hover:bg-emerald-400/10 rounded transition-all duration-300 bg-transparent";
            }

            setSubmitReady(true);
            setStatus("WALLET CONNECTED", true);

            // Listen for account/network changes
            window.ethereum.on("accountsChanged", (accs) => {
                if (accs.length === 0) { location.reload(); return; }
                userAddress = accs[0];
                buildMetaMaskAccount(accs[0]).then(mmAcc => {
                    genLayerClient = createClient({ chain: testnetBradbury, account: mmAcc });
                });
                if (btnConnect) btnConnect.textContent =
                    `${userAddress.slice(0, 6)}…${userAddress.slice(-4)}`;
                log("Account changed: " + userAddress, "warn");
            });

            window.ethereum.on("chainChanged", () => {
                log("Network changed — please reconnect your wallet.", "warn");
                setStatus("RECONNECT WALLET", false);
                setSubmitReady(false);
                userAddress = null;
                genLayerClient = null;
                if (btnConnect) {
                    btnConnect.textContent = "CONNECT WALLET";
                    btnConnect.disabled = false;
                    btnConnect.className =
                        "px-5 py-2 text-xs tracking-wider text-[#00f2fe] border border-[#00f2fe]/40 hover:border-[#00f2fe] hover:bg-[#00f2fe]/10 rounded transition-all duration-300 bg-transparent";
                }
            });

        } catch (err) {
            const msg = err?.message || String(err);
            if (msg.includes("4001") || msg.includes("user rejected")) {
                log("Connection cancelled by user.", "warn");
            } else {
                log(`Wallet error: ${msg}`, "error");
            }
            if (btnConnect) {
                btnConnect.textContent = "CONNECT WALLET";
                btnConnect.disabled = false;
            }
        }
    }

    // ── 4. Send transaction ──────────────────────────────
    async function handleSubmission(event) {
        if (event) event.preventDefault();

        const targetUrl = inputUrl ? inputUrl.value.trim() : "";
        if (!targetUrl) {
            log("Please enter a valid URL.", "warn");
            return;
        }
        if (!userAddress || !genLayerClient) {
            log("Connect your wallet first.", "error");
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = "BROADCASTING…";
        if (txStatusBox) txStatusBox.classList.add("hidden");

        try {
            // Make sure we're still on the right chain
            await ensureGenLayerNetwork();

            log(`Submitting: submit_and_evaluate("${targetUrl}")`);
            log("MetaMask will open — please sign the transaction…", "warn");

            const txHash = await genLayerClient.writeContract({
                address:      CONTRACT_ADDRESS,
                functionName: "submit_and_evaluate",
                args:         [targetUrl],
                value:        BigInt(0),
            });

            log(`Transaction sent! Hash: ${txHash}`, "success");
            showTxStatus(txHash, "PENDING");

            // Poll for ACCEPTED
            log("Polling for consensus ACCEPTED status…");
            showTxStatus(txHash, "PROPOSING");

            await genLayerClient.waitForTransactionReceipt({
                hash:     txHash,
                status:   TransactionStatus.ACCEPTED,
                interval: 5_000,
                retries:  30,
            });

            showTxStatus(txHash, "ACCEPTED");
            log("Consensus ACCEPTED ✓ — AI evaluation complete.", "success");
            if (liveUrl) liveUrl.textContent = `Last Validated Target: ${targetUrl}`;
            if (inputUrl) inputUrl.value = "";

            // Optionally wait for FINALIZED
            log("Awaiting FINALIZED confirmation…");
            try {
                await genLayerClient.waitForTransactionReceipt({
                    hash:     txHash,
                    status:   TransactionStatus.FINALIZED,
                    interval: 6_000,
                    retries:  20,
                });
                showTxStatus(txHash, "FINALIZED");
                log("Transaction FINALIZED on Bradbury Testnet ✓", "success");
            } catch {
                log("Finalization still pending (ACCEPTED is sufficient).", "warn");
            }

        } catch (err) {
            const msg = err?.message || String(err);
            if (msg.includes("4001") || msg.includes("user rejected") || msg.includes("denied")) {
                log("Transaction rejected by user.", "warn");
                showTxStatus("", "CANCELED");
            } else if (msg.includes("insufficient funds") || msg.includes("insufficient balance")) {
                log("Not enough GEN tokens. Fund your Bradbury Testnet wallet.", "error");
                showTxStatus("", "ERROR");
            } else if (msg.includes("wrong chain") || msg.includes("chain mismatch") || msg.includes("did not switch")) {
                log("Wrong network. Manually switch MetaMask to GenLayer Bradbury Testnet (Chain ID 4221).", "error");
                showTxStatus("", "ERROR");
            } else if (msg.includes("timed out") || msg.includes("retries")) {
                log("Consensus taking longer than expected — your tx may still finalize.", "warn");
            } else {
                log(`Error: ${msg}`, "error");
                showTxStatus("", "ERROR");
            }
        } finally {
            setSubmitReady(true);
        }
    }

    // ── Bootstrap ────────────────────────────────────────
    initAethera();
    if (btnConnect)      btnConnect.addEventListener("click", connectWallet);
    if (submissionForm)  submissionForm.addEventListener("submit", handleSubmission);
});