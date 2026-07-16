// ============================================================
//  Aethera Hub — GenLayer Studio
//  app.js — all DOM work happens inside DOMContentLoaded
// ============================================================

import { createClient }    from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

// ── Config ──────────────────────────────────────────────────
const CONTRACT_ADDRESS  = "0x6739D8fe8a06112c9f9F2fD531571DE6aa4236b2";
const CHAIN_ID_HEX      = "0xf22f";   // 61999
const CHAIN_ID_DEC      = 61999;
const GENLAYER_RPC_URL  = "https://studio.genlayer.com/api";
const PROXY_RPC_URL     = window.location.origin + "/api/rpc";

// Note: The window.fetch interceptor has been moved entirely to index.html
// to ensure it executes synchronously in the global page context before
// any ES modules are evaluated.

// ── App state ───────────────────────────────────────────────
let userAddress     = null;
let genLayerClient  = null;

// ── ALL logic is deferred until the DOM is ready ────────────
function startApp() {

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
    const walletDropdown= document.getElementById("wallet-dropdown");
    const btnDisconnect = document.getElementById("btn-disconnect");
    let isDropdownOpen  = false;
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
    async function initAethera() {
        setStatus("CONNECTING…", false);
        log("Testing connection to GenLayer Studio…");

        try {
            // Use the proxy endpoint so the same path works on Vercel and local dev.
            const resp = await fetch(PROXY_RPC_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
            });

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            const json = await resp.json();
            if (json.error) throw new Error(json.error.message || "RPC error");

            const chainId = parseInt(json.result, 16);
            if (chainId !== CHAIN_ID_DEC) {
                throw new Error(`Unexpected chain ${chainId}, expected ${CHAIN_ID_DEC}`);
            }

            setStatus("NODE ACTIVE", true);
            if (liveTitle)    liveTitle.textContent    = "Consensus Diagnostics Active";
            if (liveCriteria) liveCriteria.textContent =
                "Active Rules: Verify content authenticity via GitHub repository link.";
            log("Aethera network infrastructure connected — GenLayer Studio.", "success");

            // Auto-connect if already authorized in MetaMask
            if (typeof window.ethereum !== "undefined") {
                try {
                    const accounts = await window.ethereum.request({ method: "eth_accounts" });
                    if (accounts && accounts.length > 0) {
                        log("Restoring previous wallet session…");
                        await connectWallet();
                    }
                } catch (e) {
                    // Ignore silent check errors
                }
            }
        } catch (err) {
            setStatus("NODE OFFLINE", false);
            if (liveTitle) liveTitle.textContent = "Unable to reach GenLayer node";
            if (liveCriteria) liveCriteria.textContent = "Retrying in 15 seconds…";
            log(`Node health-check failed: ${err.message}`, "error");
            // Auto-retry after 15s
            setTimeout(() => initAethera(), 15_000);
        }
    }

    // ── 2. Network switch helper ──────────────────────────
    // We point MetaMask at PROXY_RPC_URL (/api/rpc).
    // The proxy coerces JSON-RPC `id` to integer before forwarding to GenLayer.
    // We always call wallet_addEthereumChain (not just when chain is missing)
    // so MetaMask updates the RPC URL to our proxy even for existing configs.
    async function ensureGenLayerNetwork() {
        const currentChainHex = await window.ethereum.request({ method: "eth_chainId" });

        try {
            // wallet_addEthereumChain: adds the chain if new, or prompts the
            // user to approve an RPC URL update if the chain already exists
            // with a different URL. Silent if config matches exactly.
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId:  CHAIN_ID_HEX,
                    chainName: "GenLayer Studio",
                    nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
                    rpcUrls: [PROXY_RPC_URL],
                    blockExplorerUrls: ["https://studio.genlayer.com/"],
                }],
            });
        } catch (addErr) {
            // Some wallets throw if the chain is already the active chain — that's fine
            if (addErr.code !== 4001) {
                // Not a user rejection — try a plain switch as fallback
                try {
                    await window.ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: CHAIN_ID_HEX }],
                    });
                } catch {
                    // If we're already on the right chain, ignore
                }
            }
        }

        const confirmed = await window.ethereum.request({ method: "eth_chainId" });
        if (confirmed.toLowerCase() !== CHAIN_ID_HEX.toLowerCase()) {
            throw new Error(
                "Please switch MetaMask to GenLayer Studio (Chain ID 61999) manually."
            );
        }
    }


    // ── Wallet Dropdown Logic ─────────────────────────────
    function toggleDropdown() {
        isDropdownOpen = !isDropdownOpen;
        if (walletDropdown) {
            if (isDropdownOpen) {
                walletDropdown.classList.remove("opacity-0", "invisible", "scale-95");
                walletDropdown.classList.add("opacity-100", "visible", "scale-100");
            } else {
                walletDropdown.classList.add("opacity-0", "invisible", "scale-95");
                walletDropdown.classList.remove("opacity-100", "visible", "scale-100");
            }
        }
    }

    function disconnectWallet() {
        userAddress = null;
        genLayerClient = null;
        setSubmitReady(false);
        setStatus("DISCONNECTED", false);
        
        if (isDropdownOpen) toggleDropdown();
        
        if (btnConnect) {
            btnConnect.innerHTML = "CONNECT WALLET";
            btnConnect.disabled = false;
            btnConnect.className = "px-5 py-2 text-xs tracking-wider flex items-center text-[#00f2fe] border border-[#00f2fe]/40 hover:border-[#00f2fe] hover:bg-[#00f2fe]/10 rounded transition-all duration-300 bg-transparent";
        }
        log("Wallet disconnected professionally.", "success");
    }

    document.addEventListener("click", (e) => {
        if (isDropdownOpen && walletDropdown && !walletDropdown.contains(e.target) && e.target !== btnConnect && !btnConnect.contains(e.target)) {
            toggleDropdown();
        }
    });

    if (btnDisconnect) {
        btnDisconnect.addEventListener("click", (e) => {
            e.stopPropagation();
            disconnectWallet();
        });
    }

    // ── 3. Connect wallet ─────────────────────────────────
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

            // Ensure MetaMask is on GenLayer (configured with proxy RPC URL)
            await ensureGenLayerNetwork();
            log("Switched to GenLayer Studio ✓", "success");

            // Create client pointing to proxy RPC URL
            genLayerClient = createClient({
                chain:    studionet,
                account:  userAddress,
                endpoint: PROXY_RPC_URL,
            });

            if (btnConnect) {
                btnConnect.innerHTML =
                    `${userAddress.slice(0, 6)}…${userAddress.slice(-4)} <svg class="w-3 h-3 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
                btnConnect.disabled = false;
                btnConnect.className =
                    "px-5 py-2 text-xs tracking-wider flex items-center text-emerald-400 border border-emerald-400/40 hover:border-emerald-400 hover:bg-emerald-400/10 rounded transition-all duration-300 bg-transparent";
            }

            setSubmitReady(true);
            setStatus("WALLET CONNECTED", true);



            window.ethereum.on("accountsChanged", (accs) => {
                if (accs.length === 0) { location.reload(); return; }
                userAddress = accs[0];
                genLayerClient = createClient({
                    chain:    studionet,
                    account:  userAddress,
                    endpoint: PROXY_RPC_URL,
                });
                if (btnConnect) btnConnect.innerHTML =
                    `${userAddress.slice(0, 6)}…${userAddress.slice(-4)} <svg class="w-3 h-3 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
                log("Account changed: " + userAddress, "warn");
            });

            window.ethereum.on("chainChanged", () => {
                log("Network changed — please reconnect your wallet.", "warn");
                setStatus("RECONNECT WALLET", false);
                setSubmitReady(false);
                userAddress = null;
                genLayerClient = null;
                if (btnConnect) {
                    btnConnect.innerHTML = "CONNECT WALLET";
                    btnConnect.disabled = false;
                    btnConnect.className =
                        "px-5 py-2 text-xs tracking-wider flex items-center text-[#00f2fe] border border-[#00f2fe]/40 hover:border-[#00f2fe] hover:bg-[#00f2fe]/10 rounded transition-all duration-300 bg-transparent";
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
                btnConnect.innerHTML = "CONNECT WALLET";
                btnConnect.disabled = false;
            }
        }
    }

    // ── 4. Track transaction status robustly ─────────────
    async function trackTransaction(txHash) {
        if (!txHash) return;

        if (txStatusBox) txStatusBox.classList.remove("hidden");
        showTxStatus(txHash, "PENDING");
        setSubmitReady(false);
        if (btnSubmit) btnSubmit.textContent = "TRACKING TRANSACTION…";

        log(`Started tracking transaction: ${txHash}`);

        let retries = 450; // 450 retries * 2s = 15 minutes of tracking
        let interval = 2000;
        let lastLoggedStatus = "";

        while (retries > 0) {
            if (!genLayerClient) {
                // If user disconnected or client is not ready, retry after a delay
                await new Promise(resolve => setTimeout(resolve, interval));
                continue;
            }

            try {
                const tx = await genLayerClient.getTransaction({ hash: txHash });
                if (tx && tx.status !== undefined) {
                    const statusMap = [
                        "UNINITIALIZED", "PENDING", "PROPOSING", "COMMITTING", 
                        "REVEALING", "ACCEPTED", "UNDETERMINED", "FINALIZED", 
                        "CANCELED", "APPEAL_REVEALING", "APPEAL_COMMITTING", 
                        "READY_TO_FINALIZE", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"
                    ];
                    const statusName = typeof tx.status === 'number' ? (statusMap[tx.status] || "UNKNOWN") : (tx.statusName || tx.status);
                    
                    showTxStatus(txHash, statusName);

                    if (statusName !== lastLoggedStatus) {
                        log(`Consensus state changed: ${statusName}`, "info");
                        lastLoggedStatus = statusName;
                        
                        if (statusName === "ACCEPTED") {
                            log("Consensus ACCEPTED ✓ — AI evaluation complete.", "success");
                            if (liveUrl) liveUrl.textContent = `Last Validated: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
                            
                            log("Waiting 5 seconds for state sync...", "info");
                            setTimeout(async () => {
                                // Fetch validator remarks from the contract
                                try {
                                    log("Fetching final validator remarks from contract...", "info");
                                    const contractStatus = await genLayerClient.readContract({
                                        address: CONTRACT_ADDRESS,
                                        functionName: "get_status",
                                        args: []
                                    });
                                    const contractRemarks = await genLayerClient.readContract({
                                        address: CONTRACT_ADDRESS,
                                        functionName: "get_remarks",
                                        args: []
                                    });
                                    const bountyReleased = await genLayerClient.readContract({
                                        address: CONTRACT_ADDRESS,
                                        functionName: "is_bounty_released",
                                        args: []
                                    });
                                    
                                    log(`[VERDICT] Status: ${contractStatus}`, contractStatus === "SECURE" ? "success" : "error");
                                    log(`[REMARKS] ${contractRemarks}`, "info");
                                    if (bountyReleased) {
                                        log(`[ADJUDICATION] The AI consensus evaluated the repository as secure.`, "success");
                                    } else {
                                        log(`[ADJUDICATION] Bounty claim REJECTED.`, "warn");
                                    }
                                } catch (e) {
                                    log(`Failed to fetch remarks: ${e.message}`, "warn");
                                }
                                setSubmitReady(true);
                            }, 5000);
                            
                            return; // Tracking complete
                        }
                    }

                    if (statusName === "FINALIZED") {
                        log("Transaction FINALIZED on Studio ✓", "success");
                        showTxStatus(txHash, "FINALIZED");
                        
                        return; // Tracking complete
                    } else if (["CANCELED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT", "UNDETERMINED"].includes(statusName)) {
                        log(`Transaction finished with non-success state: ${statusName}`, "warn");
                        setSubmitReady(true);
                        return; // Tracking complete
                    }
                } else {
                    if (lastLoggedStatus !== "UNKNOWN") {
                        log("Transaction found but status is uninitialized or empty.", "warn");
                        lastLoggedStatus = "UNKNOWN";
                    }
                }
            } catch (err) {
                const errMsg = err?.message || String(err);
                if (errMsg.includes("not found") || errMsg.includes("does not exist") || errMsg.includes("404")) {
                    if (lastLoggedStatus !== "NOT_FOUND_YET") {
                        log("Transaction not indexed on RPC node yet — waiting…", "warn");
                        lastLoggedStatus = "NOT_FOUND_YET";
                    }
                } else {
                    log(`Telemetry query warning: ${errMsg}`, "warn");
                }
            }

            await new Promise(resolve => setTimeout(resolve, interval));
            retries--;
        }

        log("Consensus monitoring timed out. The transaction may still finalize on the network. Check again later.", "warn");
        setSubmitReady(true);
    }

    // ── 5. Send transaction ───────────────────────────────
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

        setSubmitReady(false);
        btnSubmit.textContent = "BROADCASTING…";
        if (txStatusBox) txStatusBox.classList.add("hidden");

        try {
            await ensureGenLayerNetwork();

            log(`Evaluating repository: ${targetUrl}`);
            log("Sending repository URL to GenVM for on-chain consensus evaluation...");

            log(`Submitting: submit_and_evaluate(...)`);
            log("MetaMask will open — please sign the transaction…", "warn");

            const txHash = await genLayerClient.writeContract({
                address:      CONTRACT_ADDRESS,
                functionName: "submit_and_evaluate",
                args:         [targetUrl],
                value:        BigInt(0),
            });

            log(`Transaction sent! Hash: ${txHash}`, "success");
            if (inputUrl) inputUrl.value = "";

            // Start tracking the transaction
            await trackTransaction(txHash);

        } catch (err) {
            const msg = err?.message || String(err);
            if (msg.includes("4001") || msg.includes("user rejected") || msg.includes("denied")) {
                log("Transaction rejected by user.", "warn");
                showTxStatus("", "CANCELED");
            } else if (msg.includes("insufficient funds") || msg.includes("insufficient balance")) {
                log("Not enough GEN tokens. Fund your Studio wallet.", "error");
                showTxStatus("", "ERROR");
            } else if (msg.includes("wrong chain") || msg.includes("chain mismatch") || msg.includes("did not switch")) {
                log("Wrong network. Manually switch MetaMask to GenLayer Studio (Chain ID 61999).", "error");
                showTxStatus("", "ERROR");
            } else if (msg.includes("Parse error as single request") || msg.includes("cannot unmarshal string")) {
                log("RPC String ID Error detected! Your MetaMask is bypassing the Aethera proxy.", "error");
                log("FIX: Please delete 'GenLayer Studio' from MetaMask and reconnect to let the App configure the proxy RPC.", "warn");
                showTxStatus("", "ERROR");
            } else {
                log(`Error: ${msg}`, "error");
                showTxStatus("", "ERROR");
            }
            setSubmitReady(true);
        }
    }

    // ── 5. Wire up events ─────────────────────────────────
    if (btnConnect) {
        btnConnect.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (userAddress) {
                toggleDropdown();
            } else {
                await connectWallet();
            }
        });
    }
    if (submissionForm) submissionForm.addEventListener("submit", handleSubmission);
    if (btnSubmit)  btnSubmit.addEventListener("click", handleSubmission);

    // ── 6. Boot ───────────────────────────────────────────
    initAethera();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
} else {
    startApp();
}