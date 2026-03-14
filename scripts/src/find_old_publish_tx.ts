
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
    const ID = '0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03';
    console.log(`Fetching previous transaction for ID: ${ID}`);
    
    const obj = await rpc('sui_getObject', [ID, { showPreviousTransaction: true }]);
    if (obj?.data) {
        console.log('Previous Transaction:', obj.data.previousTransaction);
    } else {
        console.log('Object not found.');
    }
})();
