
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
    console.log("Searching for any objects with 'AdminCap' in the type name...");
    
    // We can't query by fuzzy type in RPC, but we can query objects for the package.
    // Let's try to query ALL objects created/mutated in the publish transactions again.
    const pkgs = [
        '0xaff30ff9a4b40845d8bdc91522a2b8e8e542ee41c0855f5cb21a652a00c45e96',
        '0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03'
    ];
    
    for (const pkg of pkgs) {
        console.log(`Auditing package: ${pkg}`);
        const result = await rpc('suix_queryObjects', [
            { filter: { Package: pkg } },
            { showType: true, showOwner: true }
        ]);
        if (result?.data) {
            for (const obj of result.data) {
                if (obj.data.type && obj.data.type.includes('AdminCap')) {
                    console.log(`FOUND! ${obj.data.type} | ID: ${obj.data.objectId} | Owner: ${JSON.stringify(obj.data.owner)}`);
                }
            }
        }
    }
})();
