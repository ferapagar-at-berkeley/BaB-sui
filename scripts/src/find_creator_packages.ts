
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
    const caps = [
        '0x04269c47bc93b652030a2610da1ad6fc6b7a42aec720f495b03fd0f1714df8cb',
        '0x18d3ea7c50bdcdec14fe6a7ae456a66c736d9068b1c58b15d84ec3f40bb751fa',
        '0x1fcf1569ed6803d75dc38304353d4b944b6afe9ed74726142995aa324c0b57ce',
        '0x9357fb52ef2d667e70dfda6eb8492bd3eb8f48dccc73faa45e711d15ed3eeb88',
        '0xa981265ad808153ae97be81669ed798594821fd014d639e574a3ba8c50832929',
        '0xbb171f8358b710c8fa6934e98653e4ceaa2a2c42a68e95ea7131b2e49d316331',
        '0xd0730e1e99309416d2f10b12f8314900fe93a1235ab8731042e5c41173e160a6',
        '0xfc588e23cf222747e049ab85e85cf65221121a8601b6f3354fca34b8cd4db489'
    ];
    
    console.log("Identifying packages for creator's UpgradeCaps...");
    
    for (const id of caps) {
        const obj = await rpc('sui_getObject', [id, { showContent: true }]);
        if (obj?.data?.content?.fields) {
            console.log(`UpgradeCap: ${id} | Package: ${obj.data.content.fields.package}`);
        }
    }
})();
