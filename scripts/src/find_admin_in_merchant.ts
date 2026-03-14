
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
    const ADDR = '0x8e8cae7791a93778800b88b6a274de5c32a86484593568d38619c7ea71999654';
    const PKG_ID = '0xaff30ff9a4b40845d8bdc91522a2b8e8e542ee41c0855f5cb21a652a00c45e96';
    const ADMIN_CAP_TYPE = `${PKG_ID}::sabotage_arena::AdminCap`;
    
    console.log(`Searching for AdminCap in objects owned by: ${ADDR}`);
    
    let cursor = null;
    let hasNextPage = true;
    let found = false;

    while (hasNextPage && !found) {
        const result = await rpc('suix_getOwnedObjects', [ADDR, { filter: { StructType: ADMIN_CAP_TYPE }, options: { showType: true, showContent: true, showOwner: true } }, cursor, 50]);
        if (result?.data && result.data.length > 0) {
            console.log(`FOUND! AdminCap ID: ${result.data[0].data.objectId}`);
            console.log(JSON.stringify(result.data[0], null, 2));
            found = true;
        } else if (result) {
            cursor = result.nextCursor;
            hasNextPage = result.hasNextPage;
        } else {
            hasNextPage = false;
        }
    }

    if (!found) console.log("AdminCap not found in this address.");
})();
