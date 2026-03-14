
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
    const ADDR = '0x895fcf9b7aceff2d84caadaa97a36d10a9d641f54b0b4a653e2336348536fd00';
    console.log(`Listing transactions sent by: ${ADDR}`);
    
    const result = await rpc('suix_queryTransactions', [
        { filter: { FromAddress: ADDR } },
        null, 50, true
    ]);
    
    if (result?.data) {
        console.log(`Found ${result.data.length} transactions:`);
        for (const tx of result.data) {
            console.log(`- Digest: ${tx.digest}`);
        }
    } else {
        console.log("No transactions found.");
    }
})();
