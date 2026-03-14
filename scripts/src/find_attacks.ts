async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    const PKG_ID = '0xaff30ff9a4b40845d8bdc91522a2b8e8e542ee41c0855f5cb21a652a00c45e96';
    console.log(`Querying success transactions for ${PKG_ID}::sabotage_arena::attack...`);
    
    // Search for transactions calling 'attack'
    const result = await rpc('suix_queryTransactions', [{ 
        filter: { MoveFunction: { package: PKG_ID, module: 'sabotage_arena', function: 'attack' } },
        options: { showEffects: true, showInput: true, showObjectChanges: true }
    }, null, 50, true]);
    
    if (result?.data) {
        console.log(`Found ${result.data.length} transactions.`);
        for (const tx of result.data) {
             const status = tx.effects.status.status;
             console.log(`Digest: ${tx.digest} | Status: ${status}`);
             if (status === 'success') {
                 // Check object changes to see shield difference
                 console.log('  SUCCESSFUL ATTACK! Investigating...');
                 // ...
             }
        }
    } else {
        console.log("No transactions found.");
    }
})();
