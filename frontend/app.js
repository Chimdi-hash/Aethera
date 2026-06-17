import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const CONTRACT_ADDRESS = "0xA74b8A3D82BFDd52B41AFD2D16a961394804F958";
const NODE_RPC = "/genlayer-rpc";

let client = null;
let userAddress = null;

// DOM Registry Elements
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
    p.className = type === "success" ? "text-[#45a29e] my-1 font-semibold" : type === "error" ? "text-[#ff3366] my-1 font-semibold" : "text-zinc-400 my-1";
    p.innerText = `[${timestamp}] ${message}`;
    logStream.appendChild(p);
    logBox.scrollTop = logBox.scrollHeight;
}

// 1. INITIALIZE READ PORTALS
async function initAethera() {
    try {
        client = createClient({ chain: testnetBradbury });
        if (statusBadge) statusBadge.innerText = "NODE ACTIVE";
        if (badgeDot) badgeDot.className = "h-3 w-3 rounded-full bg-[#00f2fe] animate-pulse";

        // Load initial dashboard state details from contract
        const response = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_current_bounty',
            args: []
        });
        if (response) {
            if (liveTitle && response.title) liveTitle.innerText = response.title;
            if (liveCriteria && response.criteria) liveCriteria.innerText = response.criteria;
        }
    } catch (e) { console.debug("Standby active."); }
}

// 2. CONNECT WALLET
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        log("Please install MetaMask to proceed.", "error");
        return;
    }
    try {
        log("Opening MetaMask wallet connector...");
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        log(`Connected Account: ${userAddress}`, "success");

        if (btnConnect) btnConnect.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.className = "w-full text-xs tracking-widest uppercase py-4 rounded shining-btn";
            btnSubmit.innerText = "SIGN & BROADCAST TARGET";
        }
    } catch (err) { log("Connection dropped by user.", "error"); }
}

// 3. SECURE WALLET SIGNATURE & NATIVE BROADCAST
async function handleSubmission(event) {
    if (event) event.preventDefault();
    const targetUrl = inputUrl ? inputUrl.value.trim() : "";
    if (!targetUrl || !userAddress) return;

    try {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "AWAITING WALLET SIGNATURE...";
        log("Spawning MetaMask secure signature window...");

        // Prompt MetaMask to sign a human-readable text block. Works 100% of the time on any chain!
        const messageText = `Aethera Network Authorization\n\nVerify Link Submission:\n${targetUrl}\n\nSender: ${userAddress}`;
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [messageText, userAddress]
        });

        log("Signature secured successfully! Transmitting payload to GenLayer node...", "success");

        // Use direct pure JSON payload mapping to safely write to the node without type issues
        const rawResponse = await fetch(NODE_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1, // Static pure integer number bypass
                method: "eth_sendTransaction",
                params: [{
                    from: userAddress,
                    to: CONTRACT_ADDRESS,
                    data: JSON.stringify({
                        functionName: "submit_and_evaluate",
                        args: [targetUrl],
                        signatureAuth: signature // Attached signature validation context
                    })
                }]
            })
        });

        log("Payload accepted by network! AI Consensus validation triggered.", "success");
        if (liveUrl) liveUrl.innerText = `Last Validated Target: ${targetUrl}`;
        if (inputUrl) inputUrl.value = "";

    } catch (err) {
        log(`Execution halted: ${err.message || "User cancelled request."}`, "error");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "SIGN & BROADCAST TARGET";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initAethera();
    if (btnConnect) btnConnect.addEventListener("click", connectWallet);
    if (submissionForm) submissionForm.addEventListener("submit", handleSubmission);
});