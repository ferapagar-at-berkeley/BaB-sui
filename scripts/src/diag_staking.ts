// Check first receipt's actual fields from the Phase 1 TX
async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

const TX = "8sjUTKiJAx86SCcjFJkpwKhCxSNBReJGW2onoJQWqYQ1";

(async () => {
    const tx = await rpc('sui_getTransactionBlock', [TX, { showObjectChanges: true }]);
    const created = tx?.objectChanges?.filter((c: any) => c.type === 'created' && c.objectType?.includes('StakeReceipt'));
    console.log(`Receipts in TX: ${created?.length}`);

    // Get first receipt's content
    const firstId = created?.[0]?.objectId;
    const obj = await rpc('sui_getObject', [firstId, { showContent: true }]);
    const fields = obj?.data?.content?.fields;
    console.log(`First receipt fields:`, JSON.stringify(fields, null, 2));

    // Compare with clock
    const clockObj = await rpc('sui_getObject', ['0x6', { showContent: true }]);
    const clockMs = BigInt(clockObj?.data?.content?.fields?.timestamp_ms ?? 0);
    const receiptTs = BigInt(fields?.last_update_timestamp ?? 0);
    const elapsedMs = clockMs - receiptTs;
    const elapsedHours = elapsedMs / 3_600_000n;
    const elapsedMins = (elapsedMs % 3_600_000n) / 60_000n;
    
    console.log(`\nClock timestamp: ${clockMs}`);
    console.log(`Receipt timestamp: ${receiptTs}`);
    console.log(`Elapsed: ${elapsedHours}h ${elapsedMins}m`);
    console.log(`Hours credited per receipt: ${elapsedHours}`);
    console.log(`Total hours with 170 receipts: ${elapsedHours * 170n}`);
    console.log(`\nReady to claim: ${elapsedHours * 170n >= 168n}`);
})();
