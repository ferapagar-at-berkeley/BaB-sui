
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
    const pkgs = [
        '0x42a310d4d9a7f9980f02340772946d1b0165e981097319c05c1b3b6749e658c1',
        '0x501675f46c6a525e0c03213fc6013804b262c95d8593dc5912a0ea7f0595a758',
        '0x6af37ec410e9af9520c438d73bee310510dca01efd6f8f057e637e776f8995fa',
        '0x788d168b3051e0f61340ce99b7e873fd6983ec21a118208bdf18def88647144c',
        '0x68a44ae81c54d4425e3c05294ededc45a3c66d510c049aa6106753862677e1bb',
        '0x42933ac577b92c78fd723b2fa4ad4131869f19fbd9b0c572666c6d0372ed3b90',
        '0x2c385d9c13cab0bed873bb13a3c7ca336d54bb6c08eb8d5f2377314dbcdc3fad'
    ];
    
    for (const pkgId of pkgs) {
        const pkg = await rpc('sui_getObject', [pkgId, { showContent: true }]);
        if (pkg?.data?.content?.modules) {
            const modules = Object.keys(pkg.data.content.modules);
            for (const mod of modules) {
                const disassembly = pkg.data.content.disassembled[mod];
                if (disassembly && disassembly.includes('AdminCap')) {
                    console.log(`FOUND AdminCap in Pkg: ${pkgId} | Mod: ${mod}`);
                }
            }
        }
    }
})();
