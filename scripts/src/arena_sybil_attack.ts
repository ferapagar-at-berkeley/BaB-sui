import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };
import arenaJson from "../../arena.json" with { type: "json" };

const mainKeypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const client = new SuiGrpcClient({
    network: 'testnet',
    baseUrl: 'https://fullnode.testnet.sui.io:443',
});

const PACKAGE_ID = arenaJson.package_id;
const ARENA_ID = "0xd7dd51e3c156a0c0152cad6bc94884db5302979e78f04d631a51ab107f9449e6";
const TARGET_ADDRESS = "0x630c413933d84bd064e01cedd3a02f4d1acb66bf8075ebcd82659297206a6442";
const CLOCK_ID = "0x6";

async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

async function getPlayerShield(address: string) {
    const arena = await rpc('sui_getObject', [ARENA_ID, { showContent: true }]);
    const tableId = arena?.data?.content?.fields?.players?.fields?.id?.id;
    if (!tableId) return 0;
    const entry = await rpc('suix_getDynamicFieldObject', [tableId, { type: 'address', value: address }]);
    if (!entry?.data) return 0;
    return Number(entry.data.content.fields.value.fields.shield);
}

(async () => {
    console.log(`Main wallet: ${mainKeypair.getPublicKey().toSuiAddress()}`);
    
    const shield = await getPlayerShield(TARGET_ADDRESS);
    console.log(`Target player ${TARGET_ADDRESS} current shield: ${shield}`);
    
    if (shield === 0) {
        console.log("Target shield is already 0. No attack needed.");
        return;
    }

    const attackerCount = shield;
    console.log(`Preparing ${attackerCount} attackers...`);

    const attackers = Array.from({ length: attackerCount }, () => new Ed25519Keypair());
    
    // 1. Fund attackers
    const fundTx = new Transaction();
    for (const attacker of attackers) {
        const [coin] = fundTx.splitCoins(fundTx.gas, [200_000_000]); // 0.2 SUI
        fundTx.transferObjects([coin], attacker.getPublicKey().toSuiAddress());
    }
    
    console.log("Funding attackers...");
    const fundResult = await client.signAndExecuteTransaction({
        transaction: fundTx,
        signer: mainKeypair,
    });
    console.log(`Funding TX: ${(fundResult as any).Transaction?.digest ?? (fundResult as any).FailedTransaction?.digest}`);

    // Wait a bit for indexing
    await new Promise(r => setTimeout(r, 2000));

    // 2. Perform attacks
    for (let i = 0; i < attackers.length; i++) {
        const attacker = attackers[i];
        const addr = attacker.getPublicKey().toSuiAddress();
        console.log(`Attacker #${i+1} (${addr}) attacking...`);
        
        try {
            const currentShield = await getPlayerShield(TARGET_ADDRESS);
            if (currentShield === 0) {
                console.log("Target shield reached 0. Stopping.");
                break;
            }

            const attackTx = new Transaction();
            attackTx.moveCall({
                target: `${PACKAGE_ID}::sabotage_arena::register`,
                arguments: [attackTx.object(ARENA_ID), attackTx.object(CLOCK_ID)],
            });
            attackTx.moveCall({
                target: `${PACKAGE_ID}::sabotage_arena::attack`,
                arguments: [
                    attackTx.object(ARENA_ID),
                    attackTx.pure.address(TARGET_ADDRESS),
                    attackTx.object(CLOCK_ID),
                ],
            });

            const result = await client.signAndExecuteTransaction({
                transaction: attackTx,
                signer: attacker,
            });
            console.log(`Attack TX: ${(result as any).Transaction?.digest ?? (result as any).FailedTransaction?.digest}`);
        } catch (e) {
            console.error(`Attack #${i+1} failed:`, e);
        }
    }

    const finalShield = await getPlayerShield(TARGET_ADDRESS);
    console.log(`Final target shield: ${finalShield}`);
})();
