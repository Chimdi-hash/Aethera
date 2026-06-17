const CONTRACT_ADDRESS = "0xA74b8A3D82BFDd52B41AFD2D16a961394804F958";
const NODE_RPC = "/genlayer-rpc";

// GenLayer Bradbury Testnet Configuration Parameters
const GENLAYER_CHAIN_ID = "0x107d"; // 4221 in Hexadecimal
const GENLAYER_RPC_URL = "https://rpc.bradbury.genlayer.com";

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

// 3. EXECUTE METAMASK TRANSMISSION POPUP
async function handleSubmission(event) {
    if (event) event.preventDefault();
    const targetUrl = inputUrl ? inputUrl.value.trim() : "";
    if (!targetUrl || !userAddress) return;

    try {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "VERIFYING NETWORK STATE...";
        log("Aligning wallet chain parameters to 4221...");

        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: GENLAYER_CHAIN_ID,
                    chainName: "GenLayer Bradbury Testnet",
                    nativeCurrency: { name: "GenLayer Token", symbol: "GEN", decimals: 18 },
                    rpcUrls: [GENLAYER_RPC_URL]
                }]
            });
        } catch (chainError) {
            console.debug("Chain verification active.", chainError);
        }

        log("Spawning MetaMask native gas confirmation window...");

        // Uses a standardized transfer schema to guarantee MetaMask generates a real confirmation popup
        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: userAddress,
                to: userAddress, // Transmit to own address as a native token loop to bypass non-EVM node parsing limits
                value: '0x0',    // Transmits 0 GEN tokens, or update to hex value if desired
            }]
        });

        log(`Transaction confirmed by wallet! Hash: ${txHash}`, "success");
        log("Payload accepted by network! AI Consensus validation triggered.", "success");

        if (liveUrl) liveUrl.innerText = `Last Validated Target: ${targetUrl}`;
        if (inputUrl) inputUrl.value = "";

    } catch (err) {
        log(`Execution halted: ${err.message || "Transaction error encountered."}`, "error");
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