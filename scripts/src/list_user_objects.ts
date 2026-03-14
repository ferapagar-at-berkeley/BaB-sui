
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
    const ADDR = '0x13b00bda1c9810711c656e496f19ab3f6ef36c8ada6cdabed6296298f7bfc088';
    console.log(`Listing objects for user: ${ADDR}`);
    
    let allObjects: any[] = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
        const result = await rpc('suix_getOwnedObjects', [ADDR, { options: { showType: true, showContent: true, showOwner: true } }, cursor, 50]);
        if (result?.data) {
            allObjects = allObjects.concat(result.data);
            cursor = result.nextCursor;
            hasNextPage = result.hasNextPage;
        } else {
            hasNextPage = false;
        }
    }

    console.log(`Found ${allObjects.length} objects.`);
    for (const obj of allObjects) {
        console.log(`  - Object ID: ${obj.data.objectId}`);
        console.log(`    Type: ${obj.data.type}`);
    }
})();
