async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    const ARENA_ID = '0xd7dd51e3c156a0c0152cad6bc94884db5302979e78f04d631a51ab107f9449e6';
    console.log(`Fetching transaction history for Arena Object: ${ARENA_ID}...`);
    
    const result = await rpc('suix_queryTransactions', [{ 
        filter: { InputObject: ARENA_ID },
        options: { showEffects: true, showInput: true }
    }, null, 50, true]);
    
    if (result?.data) {
        console.log(`Found ${result.data.length} transactions.`);
        for (const tx of result.data) {
             console.log(`Digest: ${tx.digest} | Status: ${tx.effects.status.status}`);
             // If we find a successful claim_flag or admin_distribute, that's interesting!
        }
    } else {
        console.log("No transactions found for the Arena object.");
    }
})();
