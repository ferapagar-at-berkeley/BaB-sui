
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
    console.log(`Listing objects for merchant recipient: ${ADDR}`);
    
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
