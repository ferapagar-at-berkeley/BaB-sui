async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    const PKGS = [
        '0xaff30ff9a4b40845d8bdc91522a2b8e8e542ee41c0855f5cb21a652a00c45e96',
        '0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03'
    ];

    for (const pkg of PKGS) {
        console.log(`\nSearching Objects for Package: ${pkg}`);
        const result = await rpc('suix_queryObjects', [{ filter: { Package: pkg } }, { showType: true, showOwner: true }]);
        if (result?.data) {
            for (const obj of result.data) {
                const type = obj.data.type;
                const owner = obj.data.owner;
                if (type.includes('AdminCap') || owner === 'Shared') {
                    console.log(`Found Interesting Object: ${obj.data.objectId}`);
                    console.log(`  Type:  ${type}`);
                    console.log(`  Owner: ${JSON.stringify(owner)}`);
                }
            }
        }
    }
})();
