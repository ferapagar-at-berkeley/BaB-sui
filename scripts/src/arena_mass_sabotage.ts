import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };
import arenaJson from "../../arena.json" with { type: "json" };
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const mainKeypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const mainAddress = mainKeypair.getPublicKey().toSuiAddress();

const client = new SuiGrpcClient({
    network: 'testnet',
    baseUrl: 'https://fullnode.testnet.sui.io:443',
});

const PACKAGE_ID = arenaJson.package_id;
const ARENA_ID = "0xd7dd51e3c156a0c0152cad6bc94884db5302979e78f04d631a51ab107f9449e6";
const CLOCK_ID = "0x6";

async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const json = await resp.json();
    if (json.error) throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
    return json.result;
}

async function getAllPlayers() {
    const arena = await rpc('sui_getObject', [ARENA_ID, { showContent: true }]);
    const tableId = arena?.data?.content?.fields?.players?.fields?.id?.id;
    if (!tableId) return [];

    let allPlayers: { address: string; shield: number }[] = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
        const fields: any = await rpc('suix_getDynamicFields', [tableId, cursor, 50]);
        if (!fields || !fields.data) break;
        
        for (const p of fields.data) {
            const address = p.name.value;
            const entry = await rpc('suix_getDynamicFieldObject', [tableId, { type: 'address', value: address }]);
            const pf = entry.data?.content?.fields?.value?.fields;
            if (pf) {
                allPlayers.push({ address, shield: Number(pf.shield) });
            }
        }
        hasNextPage = fields.hasNextPage;
        cursor = fields.nextCursor;
    }
    return allPlayers;
}

(async () => {
    console.log(`Main wallet: ${mainAddress}`);
    
    // Locate save_users.json (Checking standard possible locations)
    let saveUsersPath = join(__dirname, '..', '..', 'save_users.json');
    if (!existsSync(saveUsersPath)) saveUsersPath = join(__dirname, '..', 'save_users.json');
    
    let savedUsers: string[] = [];
    if (existsSync(saveUsersPath)) {
        try {
            const parsed = JSON.parse(readFileSync(saveUsersPath, 'utf-8'));
            if (Array.isArray(parsed)) {
                savedUsers = parsed;
            } else if (typeof parsed === 'object' && parsed !== null) {
                // Fallback in case the JSON is an object (key-value pairs) rather than an array
                savedUsers = [...Object.keys(parsed), ...(Object.values(parsed).filter(v => typeof v === 'string') as string[])];
            }
            console.log(`Loaded ${savedUsers.length || 0} protected users from save_users.json`);
        } catch (e) {
            console.error("Error parsing save_users.json, proceeding with empty whitelist.");
        }
    } else {
        console.log("save_users.json not found, no users are protected.");
    }

    console.log("Fetching all players in the arena... (This may take a moment)");
    const players = await getAllPlayers();
    console.log(`Found ${players.length} total players.`);

    // Filter out protected users, your own address, and players who already have 0 shield
    const targets = players.filter(p => 
        !savedUsers.includes(p.address) && 
        p.address !== mainAddress && 
        p.shield > 0
    );
    
    console.log(`Found ${targets.length} valid targets to attack.`);
    if (targets.length === 0) return;

    for (const target of targets) {
        console.log(`\n=> Target: ${target.address} (Current Shield: ${target.shield})`);
        const attackerCount = target.shield;
        const attackers = Array.from({ length: attackerCount }, () => new Ed25519Keypair());
        
        // 1. Fund all attackers in one batch
        const fundTx = new Transaction();
        for (const attacker of attackers) {
            const [coin] = fundTx.splitCoins(fundTx.gas, [200_000_000]); // 0.2 SUI
            fundTx.transferObjects([coin], attacker.getPublicKey().toSuiAddress());
        }
        
        console.log("   Funding attackers...");
        try {
            const fundResult = await client.signAndExecuteTransaction({ transaction: fundTx, signer: mainKeypair });
            console.log(`   Funding TX: ${(fundResult as any).digest}`);
        } catch (e: any) {
            console.error(`   ❌ Funding failed (likely out of SUI or fragmented coins):`, e.message);
            console.log(`   💡 Tip: Run 'npx tsx src/merge_coins.ts' to consolidate your balance, or grab more SUI from the faucet!`);
            break; // Stop the loop gracefully
        }

        // Allow indexer to catch up
        await new Promise(r => setTimeout(r, 2000));

        // 2. Register and attack for each newly generated sybil
        for (let i = 0; i < attackers.length; i++) {
            const attacker = attackers[i];
            console.log(`   Attacker #${i+1} (${attacker.getPublicKey().toSuiAddress()}) executing sabotage...`);
            
            try {
                const attackTx = new Transaction();
                attackTx.moveCall({ target: `${PACKAGE_ID}::sabotage_arena::register`, arguments: [attackTx.object(ARENA_ID), attackTx.object(CLOCK_ID)] });
                attackTx.moveCall({ target: `${PACKAGE_ID}::sabotage_arena::attack`, arguments: [attackTx.object(ARENA_ID), attackTx.pure.address(target.address), attackTx.object(CLOCK_ID)] });

                const result = await client.signAndExecuteTransaction({ transaction: attackTx, signer: attacker });
                console.log(`   Attack TX: ${(result as any).digest}`);
                await new Promise(r => setTimeout(r, 1000)); // Stagger attacks slightly
            } catch (e: any) {
                console.error(`   Attack #${i+1} failed:`, e.message || e);
            }
        }
    }
    
    console.log("\n✅ Mass sabotage complete.");
})();