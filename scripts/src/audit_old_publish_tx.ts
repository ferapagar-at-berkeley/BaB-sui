
async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const json = await resp.json();
    return json.result;
}

(async () => {
    const DIGEST = 'FDM3FUBJStmycZp1tb7ucVH7oA66iVo1uVHoy1iA8he1';
    console.log(`Auditing Transaction: ${DIGEST}`);
    
    const tx = await rpc('sui_getTransactionBlock', [DIGEST, { showObjectChanges: true, showInput: true }]);
    
    if (tx?.objectChanges) {
        console.log(`Found ${tx.objectChanges.length} object changes:`);
        for (const change of tx.objectChanges) {
             console.log(`- Type: ${change.type} | ObjectType: ${change.objectType}`);
             console.log(`  ID: ${change.objectId} | Owner: ${JSON.stringify(change.owner)}`);
        }
    } else {
        console.log("No object changes found.");
    }
})();
