// Discover new arena deployment from the new package ID
import arenaJson from "../../arena.json" with { type: "json" };

const NEW_PACKAGE_ID = arenaJson.package_id;

async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    console.log(`New package ID: ${NEW_PACKAGE_ID}`);

    // Find the deploy transaction for this package by querying its created objects
    // The package object itself can tell us the deploy tx
    const pkgObj = await rpc('sui_getObject', [NEW_PACKAGE_ID, { showContent: true, showPreviousTransaction: true }]);
    const deployTx = pkgObj?.data?.previousTransaction;
    console.log(`Deploy TX: ${deployTx}`);

    if (!deployTx) {
        console.log("Could not find deploy TX — trying to find Arena by querying objects");
        return;
    }

    // Get all objects created in the deploy TX
    const tx = await rpc('sui_getTransactionBlock', [deployTx, { showObjectChanges: true }]);
    const created = tx?.objectChanges?.filter((c: any) => c.type === 'created') || [];
    console.log(`\nObjects created in deploy TX (${created.length}):`);
    for (const obj of created) {
        console.log(`  ${obj.objectType}`);
        console.log(`  ID: ${obj.objectId}`);
        console.log('');
    }

    // Find Arena specifically
    const arena = created.find((c: any) => c.objectType?.includes('::sabotage_arena::Arena'));
    if (arena) {
        console.log(`\n🎯 Arena ID: ${arena.objectId}`);
        const arenaObj = await rpc('sui_getObject', [arena.objectId, { showContent: true }]);
        const fields = arenaObj?.data?.content?.fields;
        console.log(`Arena state:`);
        console.log(`  flags_remaining: ${fields?.flags_remaining}`);
        console.log(`  shield_threshold: ${fields?.shield_threshold}`);
        console.log(`  cooldown_ms: ${fields?.cooldown_ms} (${Number(fields?.cooldown_ms)/60000} min)`);
        console.log(`  deadline: ${new Date(Number(fields?.deadline_ms))}`);
        console.log(`  players: ${fields?.players?.fields?.size}`);
        const now = Date.now();
        console.log(`  status: ${now < Number(fields?.deadline_ms) ? "OPEN ✅" : "CLOSED ❌"}`);
    }
})();
