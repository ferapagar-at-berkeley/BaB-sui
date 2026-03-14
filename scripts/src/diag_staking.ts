// Find which receipts from Phase 1 TX still exist (weren't consumed)
async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

const TX = "8sjUTKiJAx86SCcjFJkpwKhCxSNBReJGW2onoJQWqYQ1";
const PACKAGE_ID = "0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03";

(async () => {
    // Get all receipt IDs from Phase 1 TX
    const tx = await rpc('sui_getTransactionBlock', [TX, { showObjectChanges: true }]);
    const created = (tx?.objectChanges || []).filter(
        (c: any) => c.type === 'created' && c.objectType?.includes('::staking::StakeReceipt')
    );
    console.log(`Receipts in Phase 1 TX: ${created.length}`);
    
    // Check which ones still exist (in batches of 10 to avoid RPC limit)
    const ids = created.map((c: any) => c.objectId);
    const alive: string[] = [];
    const dead: string[] = [];
    
    for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const results = await rpc('sui_multiGetObjects', [batch, { showContent: true }]);
        for (const r of results) {
            if (r?.data?.objectId) {
                alive.push(r.data.objectId);
            } else {
                dead.push(batch[results.indexOf(r)]);
            }
        }
    }
    
    console.log(`Still alive: ${alive.length}`);
    console.log(`Gone/consumed: ${dead.length}`);
    
    if (alive.length > 0) {
        const first = await rpc('sui_getObject', [alive[0], { showContent: true }]);
        const fields = first?.data?.content?.fields;
        const clockObj = await rpc('sui_getObject', ['0x6', { showContent: true }]);
        const nowMs = BigInt(clockObj?.data?.content?.fields?.timestamp_ms ?? 0);
        const ts = BigInt(fields?.last_update_timestamp ?? 0);
        const elapsed = nowMs - ts;
        const hours = elapsed / 3_600_000n;
        console.log(`\nFirst alive receipt: ${alive[0]}`);
        console.log(`  hours_staked: ${fields?.hours_staked}`);
        console.log(`  hours elapsed since stake: ${hours}`);
        console.log(`  total hours if merged: ${hours * BigInt(alive.length)}`);
        console.log(`\n${hours * BigInt(alive.length) >= 168n ? "✅ Ready to claim!" : "⏳ Not ready yet"}`);
    }
})();
