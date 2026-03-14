async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    const USDC_PKG = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29';
    console.log(`Deep search for objects of package ${USDC_PKG}...`);
    
    // Suix_queryObjects might be restricted by visibility or paging. 
    // Let's also try searching for the TreasuryCap type directly.
    const TREASURY_CAP_TYPE = `0x2::coin::TreasuryCap<${USDC_PKG}::usdc::USDC>`;
    
    const result = await rpc('suix_queryObjects', [{ 
        filter: { StructType: TREASURY_CAP_TYPE } 
    }, { showOwner: true }]);
    
    if (result?.data?.length > 0) {
        for (const obj of result.data) {
            console.log('Found USDC TreasuryCap:', obj.data.objectId);
            console.log('Owner:', JSON.stringify(obj.data.owner));
        }
    } else {
        console.log("No USDC TreasuryCap found via direct type search.");
    }
    
    // Also check for all objects associated with the package again
    const allObjs = await rpc('suix_queryObjects', [{ filter: { Package: USDC_PKG } }, { showType: true, showOwner: true }]);
    if (allObjs?.data) {
         console.log(`Found ${allObjs.data.length} objects for the package ${USDC_PKG}.`);
         for (const obj of allObjs.data) {
             console.log(`Object: ${obj.data.objectId} | Type: ${obj.data.type} | Owner: ${JSON.stringify(obj.data.owner)}`);
         }
    }
})();
