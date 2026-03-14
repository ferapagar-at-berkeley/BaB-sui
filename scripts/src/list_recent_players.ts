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
    
    if (tableId) {
        const fields = await rpc('suix_getDynamicFields', [tableId, null, 100]);
        const players = [];
        for (const p of fields.data) {
            const address = p.name.value;
            const entry = await rpc('suix_getDynamicFieldObject', [tableId, { type: 'address', value: address }]);
            const pf = entry.data.content.fields.value.fields;
            players.push({ address, shield: pf.shield, last_action: Number(pf.last_action_ms) });
        }
        
        players.sort((a, b) => b.last_action - a.last_action);
        
        console.log("Leaderboard (Top 20 Recent):");
        for (const p of players.slice(0, 20)) {
            console.log(`${new Date(p.last_action).toLocaleTimeString()} | ${p.address} | Shield: ${p.shield}`);
        }
    }
})();
