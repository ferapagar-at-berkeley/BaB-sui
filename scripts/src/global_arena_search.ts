
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
    const PKG_ID = '0xaff30ff9a4b40845d8bdc91522a2b8e8e542ee41c0855f5cb21a652a00c45e96';
    const ARENA_TYPE = `${PKG_ID}::sabotage_arena::Arena`;
    
    console.log(`Searching for all objects of type: ${ARENA_TYPE}`);
    
    const result = await rpc('suix_queryObjects', [
        { filter: { StructType: ARENA_TYPE } },
        { showOwner: true, showContent: true }
    ]);
    
    if (result?.data) {
        console.log(`Found ${result.data.length} objects:`);
        console.log(JSON.stringify(result.data, null, 2));
    } else {
        console.log("No objects found.");
    }
})();
