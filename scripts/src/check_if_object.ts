
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
    const ID = '0x8e8cae7791a93778800b88b6a274de5c32a86484593568d38619c7ea71999654';
    console.log(`Checking if ID is an object: ${ID}`);
    
    const obj = await rpc('sui_getObject', [ID, { showType: true, showOwner: true }]);
    if (obj?.data) {
        console.log("Object details:", JSON.stringify(obj.data, null, 2));
    } else {
        console.log("Not an object.");
    }
})();
