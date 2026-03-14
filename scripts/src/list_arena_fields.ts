
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
    const ARENA_ID = '0xd7dd51e3c156a0c0152cad6bc94884db5302979e78f04d631a51ab107f9449e6';
    console.log(`Auditing Arena: ${ARENA_ID}`);
    
    // 1. Get object metadata
    const arena = await rpc('sui_getObject', [ARENA_ID, { showContent: true, showOwner: true }]);
    console.log("Arena Owner:", JSON.stringify(arena.data.owner));
    
    // 2. Get dynamic fields
    const fields = await rpc('suix_getDynamicFields', [ARENA_ID]);
    console.log("Dynamic Fields:", JSON.stringify(fields, null, 2));
    
    // 3. If there is a "players" table, check its dynamic fields too
    const tableId = arena.data.content.fields.players.fields.id.id;
    console.log(`Players Table ID: ${tableId}`);
    const tableFields = await rpc('suix_getDynamicFields', [tableId]);
    console.log(`Players Table Fields Count: ${tableFields.data.length}`);
    // Just show a few to see the structure
    if (tableFields.data.length > 0) {
        console.log("Example Table Field:", JSON.stringify(tableFields.data[0], null, 2));
    }
})();
