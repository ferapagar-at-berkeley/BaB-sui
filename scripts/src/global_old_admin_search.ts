
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
    const PKG_ID = '0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03';
    const ADMIN_CAP_TYPE = `${PKG_ID}::sabotage_arena::AdminCap`;
    
    console.log(`Searching for all objects of type: ${ADMIN_CAP_TYPE}`);
    
    const result = await rpc('suix_queryObjects', [
        { filter: { StructType: ADMIN_CAP_TYPE } },
        { showOwner: true, showContent: true }
    ]);
    
    if (result?.data) {
        console.log(`Found ${result.data.length} objects:`);
        console.log(JSON.stringify(result.data, null, 2));
    } else {
        console.log("No objects found.");
    }
})();
