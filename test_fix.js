const body = { jsonrpc: "2.0", id: "3k9x2a", method: "eth_chainId", params: [] };

let nextRpcId = 1;
const originalIdsMap = {};
let changed = false;

const fixOne = (obj) => {
    if (obj && typeof obj === "object" && "id" in obj) {
        const idType = typeof obj.id;
        if (idType === "string" || (idType === "number" && obj.id > 2147483647)) {
            const newId = nextRpcId++;
            if (nextRpcId > 2_000_000_000) nextRpcId = 1;
            originalIdsMap[newId] = obj.id;
            obj.id = newId;
            changed = true;
        }
    }
};

if (Array.isArray(body)) {
    body.forEach(fixOne);
} else {
    fixOne(body);
}

console.log(JSON.stringify(body));
