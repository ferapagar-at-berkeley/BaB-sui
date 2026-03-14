async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

const ARENA_ID = "0xd7dd51e3c156a0c0152cad6bc94884db5302979e78f04d631a51ab107f9449e6";

(async () => {
    const arena = await rpc('sui_getObject', [ARENA_ID, { showContent: true }]);
    const tableId = arena?.data?.content?.fields?.players?.fields?.id?.id;
    console.log(`Table ID: ${tableId}`);

    if (tableId) {
        const fields = await rpc('suix_getDynamicFields', [tableId, null, 300]);
        console.log(`Total Players: ${fields?.data?.length}`);
        for (const p of fields.data) {
            const address = p.name.value;
            const entry = await rpc('suix_getDynamicFieldObject', [tableId, { type: 'address', value: address }]);
            const pf = entry.data.content.fields.value.fields;
            console.log(`Player: ${address} | Shield: ${pf.shield} | Last Action: ${pf.last_action_ms}`);
        }
    }
})();
