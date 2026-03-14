async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    const OWNER = '0x895fcf9b7aceff2d84caadaa97a36d10a9d641f54b0b4a653e2336348536fd00';
    console.log(`Searching for objects owned by ${OWNER}...`);
    
    const result = await rpc('suix_queryObjects', [{ 
        filter: { Owner: OWNER } 
    }, { showType: true, showContent: true }]);
    
    if (result?.data) {
        console.log(`Found ${result.data.length} objects.`);
        for (const obj of result.data) {
            console.log(`Object: ${obj.data.objectId} | Type: ${obj.data.type}`);
            if (obj.data.content) {
                // console.log('Content:', JSON.stringify(obj.data.content.fields, null, 2));
            }
        }
    } else {
        console.log("No objects found for the owner.");
    }
})();
