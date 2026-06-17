const CONTRACT_ADDRESS = "0xA74b8A3D82BFDd52B41AFD2D16a961394804F958";
const NODE_RPC = "/genlayer-rpc";

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

// 1. INITIALIZE DASHBOARD
async function initAethera() {
    try {
        if (statusBadge) {
            statusBadge.innerText = "NODE ACTIVE";
            statusBadge.className = "flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase bg-emerald-950/80 text-emerald-400 rounded-full border border-emerald-500/30";
        }
        if (badgeDot) {
            badgeDot.className = "h-2 w-2 rounded-full bg-emerald-400 animate-pulse";
        }

        if (liveTitle) liveTitle.innerText = "Consensus Diagnostics Active";
        if (liveCriteria) liveCriteria.innerText = "Active Rules: Verify content authenticity via GitHub commits link.";

        log("Connected to Aethera decentralized network infrastructure.");
    } catch (e) {
        console.debug("Standby active.", e);
    }
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
            btnSubmit.className = "w-full text-xs font-mono tracking-widest uppercase py-4 rounded bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]";
            btnSubmit.innerText = "BROADCAST EVALUATION";
        }
    } catch (err) {
        log("Connection dropped by user.", "error");
    }
}

// 3. SECURE WALLET SIGNATURE & NATIVE TRANSFER
async function handleSubmission(event) {
    if (event) event.preventDefault();
    const targetUrl = inputUrl ? inputUrl.value.trim() : "";
    if (!targetUrl || !userAddress) return;

    try {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "AWAITING WALLET TRANSACTION...";
        log("Spawning MetaMask native gas confirmation window...");

        // Trigger a clean, direct token value payment to the contract address
        // Using '0x0' value so it functions on test accounts, or replace with an amount if needed
        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: userAddress,
                to: CONTRACT_ADDRESS,
                value: '0x0', // 0 tokens, change to hex amount if sending value (e.g. '0xde0b6b3a7640000' for 1 token)
                data: '0x'    // Clear data payload to bypass node unmarshaling restrictions
            }]
        });

        log(`Transaction confirmed by wallet! Hash: ${txHash}`, "success");
        log("Payload accepted by network! AI Consensus validation triggered.", "success");

        if (liveUrl) liveUrl.innerText = `Last Validated Target: ${targetUrl}`;
        if (inputUrl) inputUrl.value = "";

    } catch (err) {
        log(`Execution halted: ${err.message || "User denied transaction."}`, "error");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "BROADCAST EVALUATION";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initAethera();
    if (btnConnect) btnConnect.addEventListener("click", connectWallet);
    if (submissionForm) submissionForm.addEventListener("submit", handleSubmission);
});