
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
    const OBJ_ID = '0x08a31c97a7b533bd4e3cbdeeee0c7ab46ab3f26297aaf22a00db014d1ec4acb0';
    console.log(`Tracing history for object: ${OBJ_ID}`);
    
    const result = await rpc('suix_queryTransactions', [
        { filter: { InputObject: OBJ_ID } },
        null, 50, true
    ]);
    
    if (result?.data) {
        console.log(`Found ${result.data.length} transactions:`);
        for (const tx of result.data) {
            console.log(`- Digest: ${tx.digest}`);
            const txDetails = await rpc('sui_getTransactionBlock', [tx.digest, { showObjectChanges: true, showInput: true }]);
            // Check if AdminCap was part of any object change (transfer, etc.)
            const changes = txDetails.objectChanges || [];
            const objChange = changes.find((c: any) => c.objectId === OBJ_ID);
            if (objChange) {
                console.log(`  Change: ${objChange.type} | New Owner: ${JSON.stringify(objChange.owner)}`);
            }
        }
    } else {
        console.log("No transactions found.");
    }
})();
