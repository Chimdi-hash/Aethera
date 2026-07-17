# 🌐 Aethera Network

A decentralized web content verification oracle built natively on the GenLayer protocol. Aethera leverages multi-validator LLM consensus to bridge real-world GitHub repository data directly to intelligent smart contracts for security evaluation and automated bounty adjudication.

---

## 🔗 Project Links & Metadata

* **Live Deployment URL:** [https://bountyhubapp.vercel.app](https://bountyhubapp.vercel.app)
* **Target Ledger Infrastructure:** GenLayer Studio Network (Chain ID: 61999)
* **Active Smart Contract Address:** `0x98218c06939f323bfad83D5c2c28187D0135A396`

---

## 🚀 Overview

**Aethera Network** acts as an AI-native truth consensus layer and automated bug bounty adjudicator. By utilizing GenLayer’s unique Intelligent Framework (`gl.Contract`), the application allows users to submit a GitHub repository URL for an automated security audit.

Decentralized protocol validator nodes securely fetch the raw repository README data using the GitHub API, execute non-deterministic linguistic evaluations to identify vulnerabilities under strict consensus rules, and commit the verified truth state directly back to the blockchain ledger. If the repository is evaluated as secure, bounty funds are automatically adjudicated.

---

## ✨ Core Features

### 🪪 Browser Wallet Integration
* Seamlessly authenticates user account states using standard browser extensions (`window.ethereum`) like MetaMask or Rabby.
* Automatically configures and switches networks to the GenLayer Studio RPC.

### 🤖 Intelligent Contract Execution
* Built fully compliant with GenLayer specifications.
* Implements the `gl.eq_principle.prompt_comparative` framework to securely evaluate non-deterministic data parsing tasks.
* Resolves GitHub repository URLs, dynamically querying the GitHub API for base64-encoded `README.md` content directly from inside the consensus execution block.

### 📦 On-Chain Adjudication
* Persists the AI validator evaluations directly to the smart contract state.
* Fully automated adjudication workflow bridging AI consensus to tangible blockchain state changes.

### 📊 Real-Time Network Telemetry
* Features an intuitive, developer-focused UI displaying transaction pipeline states (`PROPOSING` → `COMMITTING` → `ACCEPTED` → `FINALIZED`).
* Includes a live console stream that prints real-time node polling logs and intelligent consensus remarks directly to the user dashboard.

### ⚡ Vercel Serverless Function Proxy
* Includes an integrated serverless JSON-RPC proxy (`/api/rpc`) that sanitizes and routes requests from the frontend to the upstream GenLayer RPC node, resolving issues with string-based `id` handling in standard web3 provider libraries.

---

## 🛠️ Architecture & Tech Stack

```text
  [ Front-End UI ] ---> [ Vercel API Proxy ] ---> [ GenLayer Studio API ]
   (Vercel App)           (JSON-RPC Router)        (LLM Consensus Block)
```

## 💻 Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development server:**
   ```bash
   npm run dev
   ```

3. **Deploying the Smart Contract:**
   * Head over to [GenLayer Studio](https://studio.genlayer.com).
   * Deploy the Python script located at `contracts/bounty_hub.py`.
   * Copy the deployed contract address and update the `CONTRACT_ADDRESS` constant in `frontend/app.js`.
