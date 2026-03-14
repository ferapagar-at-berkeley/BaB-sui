
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
    const POOL_ID = '0x9a3663b331a4d66b541da771fbbcda3da54423b4de2fb3c62e7d356870084fdb';
    console.log(`Auditing StakingPool: ${POOL_ID}`);
    
    const fields = await rpc('suix_getDynamicFields', [POOL_ID]);
    console.log("Dynamic Fields:", JSON.stringify(fields, null, 2));
    
    if (fields?.data && fields.data.length > 0) {
        for (const f of fields.data) {
             const obj = await rpc('sui_getObject', [f.objectId, { showContent: true, showType: true }]);
             console.log(`Field Object: ${f.objectId} | Type: ${obj.data.type}`);
        }
    }
})();
