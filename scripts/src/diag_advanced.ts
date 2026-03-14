async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    const ARENA_PKG = '0xaff30ff9a4b40845d8bdc91522a2b8e8e542ee41c0855f5cb21a652a00c45e96';
    const USDC_PKG = 'a1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29';

    console.log("Searching for UpgradeCap for Arena Package...");
    const upgradeCaps = await rpc('suix_queryObjects', [{ filter: { StructType: '0x2::package::UpgradeCap' } }, { showType: true }]);
    if (upgradeCaps?.data) {
        for (const obj of upgradeCaps.data) {
            const type = obj.data.type;
            if (type.includes(ARENA_PKG)) {
                console.log('Found Arena UpgradeCap:', obj.data.objectId);
            }
        }
    }

    console.log("\nListing Objects for USDC Package...");
    const usdcObjects = await rpc('suix_queryObjects', [{ filter: { Package: USDC_PKG } }, { showType: true }]);
    if (usdcObjects?.data) {
        for (const obj of usdcObjects.data) {
            console.log('Object:', obj.data.objectId, 'Type:', obj.data.type);
        }
    }
})();
