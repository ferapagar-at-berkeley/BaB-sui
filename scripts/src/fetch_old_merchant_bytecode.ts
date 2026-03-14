
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
    const PKG_ID = '0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03';
    const MOD_NAME = 'merchant';
    
    console.log(`Fetching bytecode for ${PKG_ID}::${MOD_NAME}`);
    
    const pkg = await rpc('sui_getObject', [PKG_ID, { showContent: true }]);
    const bytecode = pkg.data.content.disassembled[MOD_NAME];
    
    if (bytecode) {
        console.log("Bytecode found. Writing to file...");
        // In a real environment, I would write this to a file.
        // For now, I'll just print the first 1000 characters to see the functions.
        console.log(bytecode.substring(0, 2000));
    } else {
        console.log("Module not found in package.");
    }
})();
