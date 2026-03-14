// Check if current wallet or any known address is registered in the Arena
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import keyPairJson from "../keypair.json" with { type: "json" };

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const address = keypair.getPublicKey().toSuiAddress();

const ARENA_ID = "0x7cf2ab748619f5f8e25a002aa2c60a85b7a6f61220f011358a32cb11c797a923";
const PLAYERS_TABLE_ID = "0x7bb1ad94f12ceef7d9622243be71747a76085529b5275d329f08008baa1c4c35";

async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    console.log(`Current keypair wallet: ${address}`);

    // Check arena overview
    const arena = await rpc('sui_getObject', [ARENA_ID, { showContent: true }]);
    const fields = arena?.data?.content?.fields;
    console.log(`\nArena state:`);
    console.log(`  flags_remaining: ${fields?.flags_remaining}`);
    console.log(`  shield_threshold: ${fields?.shield_threshold}`);
    console.log(`  players.size: ${fields?.players?.fields?.size}`);
    console.log(`  deadline: ${new Date(Number(fields?.deadline_ms))}`);

    // Try looking up the current address in the players table using dynamic field lookup
    console.log(`\n--- Checking if current wallet is registered ---`);
    const playerEntry = await rpc('suix_getDynamicFieldObject', [
        PLAYERS_TABLE_ID,
        { type: 'address', value: address }
    ]);
    if (playerEntry?.data) {
        const pf = playerEntry.data?.content?.fields?.value?.fields;
        console.log(`✅ Current wallet IS registered!`);
        console.log(`   Shield: ${pf?.shield}`);
        console.log(`   Last action: ${pf?.last_action_ms}`);
    } else {
        console.log(`❌ Current wallet (${address}) is NOT in the arena.`);
    }

    // List all registered players by iterating dynamic fields
    console.log(`\n--- All registered players ---`);
    const dynamicFields = await rpc('suix_getDynamicFields', [PLAYERS_TABLE_ID, null, 50]);
    const players = dynamicFields?.data || [];
    console.log(`Total players: ${players.length}`);
    for (const p of players) {
        const name = p.name?.value; // address
        // Fetch each player's state
        const playerObj = await rpc('suix_getDynamicFieldObject', [
            PLAYERS_TABLE_ID,
            { type: 'address', value: name }
        ]);
        const pf = playerObj?.data?.content?.fields?.value?.fields;
        console.log(`\n  Player: ${name}`);
        console.log(`  Shield: ${pf?.shield} / 12`);
        console.log(`  Last action: ${pf?.last_action_ms === '0' ? 'never' : new Date(Number(pf?.last_action_ms))}`);
    }
})();
