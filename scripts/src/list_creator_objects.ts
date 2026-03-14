
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
    console.log(`Listing objects for address: ${ADDR}`);
    
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
