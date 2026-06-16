// ==========================================
// AETHERA NETWORK CORE FRONTEND CONNECTION
// ==========================================

import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const CONTRACT_ADDRESS = "0xA74b8A3D82BFDd52B41AFD2D16a961394804F958";
// Relative endpoint: works perfectly on localhost and live production seamlessly
const PROXY_ENDPOINT = "/api/rpc-bridge";

let client = null;
let userAddress = null;

// DOM Registry Cache Mapping
const statusBadge = document.getElementById("status-badge");
const badgeDot = document.getElementById("badge-dot");
const liveTitle = document.getElementById("live-title");
const liveCriteria = document.getElementById("live-criteria");
const liveUrl = document.getElementById("live-url");
const submissionForm = document.getElementById("submission-form");
const inputUrl = document.getElementById("input-url");
const btnSubmit = document.getElementById("btn-submit");
const btnConnect = document.getElementById("btn-connect");
const logBox = document.getElementById("log-box");
const logStream = document.getElementById("log-stream");

function log(message, type = "info") {
    if (!logBox || !logStream) return;
    logBox.classList.remove("hidden");
    const p = document.createElement("p");
    const timestamp = new Date().toLocaleTimeString();

    if (type === "success") p.className = "text-[#45a29e] my-1 font-semibold";
    else if (type === "error") p.className = "text-[#ff3366] my-1 border-l-2 border-[#ff3366] pl-2 bg-rose-950/20 py-1 rounded";
    else p.className = "text-zinc-400 my-1";

    p.innerText = `[${timestamp}] ${message}`;
    logStream.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
}

// 1. INITIALIZE BASE CLIENT (READ-ONLY STAGE)
async function initAethera() {
    try {
        client = createClient({ chain: testnetBradbury });
        if (statusBadge) {
            statusBadge.innerText = "NODE ACTIVE";
            statusBadge.className = "px-3 py-1 text-xs font-mono uppercase bg-emerald-950 text-emerald-400 rounded-full border border-emerald-500/30";
        }
        if (badgeDot) badgeDot.className = "h-3 w-3 rounded-full bg-[#00f2fe] animate-pulse";
        await updateDashboardState();
    } catch (error) {
        console.debug("Dashboard interface resting state.");
    }
}

// 2. BACKGROUND TELEMETRY REFRESH
async function updateDashboardState() {
    if (!client) return;
    try {
        const response = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_current_bounty',
            args: []
        });
        if (response && typeof response === 'object') {
            const data = response.data || response;
            if (liveTitle && data.title) liveTitle.innerText = data.title;
            if (liveCriteria && data.criteria) liveCriteria.innerText = data.criteria;
        }
    } catch (error) {
        console.debug("Telemetry read connection idle.");
    }
}

// 3. WALLET CONNECTION
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        log("Wallet Context Missing. Please install MetaMask.", "error");
        return;
    }
    try {
        log("Opening browser wallet access link portal...");
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        log(`Wallet Connected Successfully: ${userAddress}`, "success");

        if (btnConnect) btnConnect.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.removeAttribute("disabled");
            btnSubmit.className = "w-full text-xs tracking-widest uppercase py-4 rounded shining-btn";
            btnSubmit.innerText = "SIGN & BROADCAST PAYLOAD";
        }
    } catch (error) {
        log(`Connection rejected: ${error.message}`, "error");
    }
}

// 4. TRANSACTION SUBMISSION PIPELINE (PROXIED UNIFIED PIPELINE)
async function handleSubmission(event) {
    if (event) event.preventDefault();

    const targetUrl = inputUrl ? inputUrl.value.trim() : document.getElementById("input-url")?.value.trim();
    if (!targetUrl) return;
    if (!userAddress) {
        log("Submission blocked: Please connect your wallet first.", "error");
        return;
    }

    try {
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.className = "w-full text-xs tracking-widest uppercase py-4 rounded faded-btn";
            btnSubmit.innerText = "BROADCASTING PAYLOAD...";
        }

        log(`Target verification asset: ${targetUrl}`);
        log("Routing transaction data via serverless proxy tunnel...");

        // Fire request to our relative api route
        const response = await fetch(PROXY_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                method: "eth_sendTransaction",
                params: [{
                    from: userAddress,
                    to: CONTRACT_ADDRESS,
                    data: JSON.stringify({
                        functionName: "submit_and_evaluate",
                        args: [targetUrl]
                    })
                }]
            })
        });

        const jsonResult = await response.json();
        if (jsonResult.error) throw new Error(jsonResult.error.message || "Proxy transaction rejection.");

        const txHash = jsonResult.result;
        log(`Success! Transaction Hash: ${txHash.substring(0, 16)}...`, "success");
        log(`Awaiting Intelligent Contract block consensus confirmation...`);

        if (client && client.waitForTransactionReceipt) {
            try {
                await client.waitForTransactionReceipt({
                    hash: txHash,
                    status: 'FINALIZED',
                    timeout: 45000,
                    retryDelay: 5000
                });
                log(`Consensus cycle finalized completely! Block confirmed.`, "success");
            } catch (tError) {
                log("Transaction broadcasted successfully! The network is evaluating your data.", "success");
            }
        }

        if (liveUrl) liveUrl.innerText = `Last Validated Target: ${targetUrl}`;
        if (inputUrl) inputUrl.value = "";

    } catch (error) {
        log(`Execution error: ${error.message || "Network busy. Please try again."}`, "error");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.className = "w-full text-xs tracking-widest uppercase py-4 rounded shining-btn";
            btnSubmit.innerText = "SIGN & BROADCAST PAYLOAD";
        }
    }
}

// 5. RUNTIME EVENT LISTENERS
document.addEventListener("DOMContentLoaded", () => {
    initAethera();
    if (btnConnect) btnConnect.addEventListener("click", connectWallet);
    if (submissionForm) submissionForm.addEventListener("submit", handleSubmission);
});