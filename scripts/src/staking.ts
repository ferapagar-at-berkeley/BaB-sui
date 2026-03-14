import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiClient = new SuiGrpcClient({
    network: 'testnet',
    baseUrl: 'https://fullnode.testnet.sui.io:443',
});

const PACKAGE_ID = "0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03";
const STAKING_POOL_ID = "0x9cd5b5fe69a62761859536720b9b07c48a1e43b95d8c291855d9fc6779a3b494";
const CLOCK_ID = "0x6";

const NUM_RECEIPTS = 170;
const MAIN_STAKE = 1_000_000_000n; // 1 SUI
const MICRO_STAKE = 1_000n;         // 1000 MIST per micro receipt
const MILLISECONDS_PER_HOUR = 3_600_000n;

// State file — saves Phase 1 TX digest so Phase 2 can find the receipts
const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', 'staking_state.json');

interface StakingState {
    phase1Digest: string;
    stakedAt: number; // unix ms
}

function loadState(): StakingState | null {
    if (!existsSync(STATE_FILE)) return null;
    try { return JSON.parse(readFileSync(STATE_FILE, 'utf-8')); }
    catch { return null; }
}

function saveState(state: StakingState) {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

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

async function signAndGetData(tx: Transaction) {
    const resp = await suiClient.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        include: { effects: true, objectChanges: true },
    });
    const data = (resp as any).Transaction ?? (resp as any).FailedTransaction;
    return data;
}

/** Get receipt IDs from the Phase 1 TX */
async function getReceiptIdsFromTx(digest: string): Promise<string[]> {
    const tx = await rpc('sui_getTransactionBlock', [
        digest,
        { showObjectChanges: true }
    ]);
    const created = (tx?.objectChanges || []).filter(
        (c: any) => c.type === 'created' && c.objectType?.includes('::staking::StakeReceipt')
    );
    return created.map((c: any) => c.objectId);
}

/** Get timestamp_ms from the Clock object */
async function getClockTimestampMs(): Promise<bigint> {
    const clockObj = await rpc('sui_getObject', [CLOCK_ID, { showContent: true }]);
    const ts = clockObj?.data?.content?.fields?.timestamp_ms;
    return BigInt(ts ?? Date.now());
}

// ─── Phase 1: Create receipts ──────────────────────────────────────────────

async function phase1(address: string) {
    console.log(`\n=== Phase 1: Creating ${NUM_RECEIPTS} stake receipts ===`);
    const microCount = NUM_RECEIPTS - 1;
    const totalNeeded = MAIN_STAKE + BigInt(microCount) * MICRO_STAKE;
    console.log(`Total to stake: ${totalNeeded} MIST (~${Number(totalNeeded) / 1e9} SUI)`);

    const tx = new Transaction();

    const splitAmounts = [MAIN_STAKE, ...Array(microCount).fill(MICRO_STAKE)];
    const coins = tx.splitCoins(tx.gas, splitAmounts);

    // Stake each coin — mainReceipt first, then micro receipts
    const receipts = splitAmounts.map((_, i) =>
        tx.moveCall({
            target: `${PACKAGE_ID}::staking::stake`,
            arguments: [
                tx.object(STAKING_POOL_ID),
                coins[i],
                tx.object(CLOCK_ID),
            ],
        })
    );

    tx.transferObjects(receipts, tx.pure.address(address));

    console.log('Submitting transaction...');
    const data = await signAndGetData(tx);
    if (!data?.status?.success) throw new Error(`Phase 1 failed: ${data?.status?.error}`);

    const digest = data.digest;
    console.log(`\n✅ Phase 1 TX: ${digest}`);
    console.log(`   View: https://suiscan.xyz/testnet/tx/${digest}`);

    // Save state so Phase 2 can find receipts
    saveState({ phase1Digest: digest, stakedAt: Date.now() });
    console.log(`   State saved to: ${STATE_FILE}`);

    return digest;
}

// ─── Phase 2: Update, merge, claim ────────────────────────────────────────

async function phase2(address: string, receiptIds: string[]) {
    console.log(`\n=== Phase 2: Updating ${receiptIds.length} receipts, merging, and claiming flag ===`);

    const tx = new Transaction();

    // update_receipt on each
    const updated = receiptIds.map(id =>
        tx.moveCall({
            target: `${PACKAGE_ID}::staking::update_receipt`,
            arguments: [tx.object(id), tx.object(CLOCK_ID)],
        })
    );

    // Chain merge: R1 + R2 → R12, R12 + R3 → R123, …
    let merged = updated[0];
    for (let i = 1; i < updated.length; i++) {
        merged = tx.moveCall({
            target: `${PACKAGE_ID}::staking::merge_receipts`,
            arguments: [merged, updated[i], tx.object(CLOCK_ID)],
        });
    }

    // claim_flag → returns (Flag, Coin<SUI>)
    const results = tx.moveCall({
        target: `${PACKAGE_ID}::staking::claim_flag`,
        arguments: [tx.object(STAKING_POOL_ID), merged, tx.object(CLOCK_ID)],
    });

    // results[0] = Flag, results[1] = returned SUI
    tx.transferObjects([results[0], results[1]], tx.pure.address(address));

    console.log('Submitting Phase 2 transaction...');
    const data = await signAndGetData(tx);

    if (!data?.status?.success) {
        throw new Error(`Phase 2 failed: ${data?.status?.error}\n${JSON.stringify(data).slice(0, 400)}`);
    }

    console.log(`\n🏆 SUCCESS! Staking flag claimed!`);
    console.log(`   TX: ${data.digest}`);
    console.log(`   View: https://suiscan.xyz/testnet/tx/${data.digest}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

(async () => {
    const address = keypair.getPublicKey().toSuiAddress();
    console.log(`Wallet: ${address}`);

    const state = loadState();

    if (state) {
        // Already did Phase 1 — check timing and proceed to Phase 2
        console.log(`\nPhase 1 TX found: ${state.phase1Digest}`);

        const nowMs = await getClockTimestampMs();
        const stakedAtMs = BigInt(state.stakedAt);
        const elapsed = nowMs - stakedAtMs;
        const hoursElapsed = elapsed / MILLISECONDS_PER_HOUR;

        console.log(`Time since staking: ${(Number(elapsed) / 60_000).toFixed(1)} minutes`);
        console.log(`Hours credited per receipt: ${hoursElapsed}`);
        console.log(`Total hours after merging ${NUM_RECEIPTS} receipts: ${hoursElapsed * BigInt(NUM_RECEIPTS)}`);

        if (hoursElapsed < 1n) {
            const msLeft = MILLISECONDS_PER_HOUR - (elapsed % MILLISECONDS_PER_HOUR);
            const minsLeft = (Number(msLeft) / 60_000).toFixed(1);
            console.log(`\n⏳ Not ready yet. Come back in ${minsLeft} minutes.`);
            console.log(`   (Need 1 full hour so each receipt gets hours_staked ≥ 1)`);
            return;
        }

        if (hoursElapsed * BigInt(NUM_RECEIPTS) < 168n) {
            console.log(`\n⚠️  Total hours (${hoursElapsed * BigInt(NUM_RECEIPTS)}) < 168. Need more time or more receipts.`);
            return;
        }

        // Fetch receipt IDs from Phase 1 TX
        console.log('\nFetching receipt IDs from Phase 1 TX...');
        const receiptIds = await getReceiptIdsFromTx(state.phase1Digest);
        console.log(`Found ${receiptIds.length} receipts`);

        if (receiptIds.length === 0) throw new Error('No receipt IDs found in Phase 1 TX');

        await phase2(address, receiptIds);

    } else {
        // First run — do Phase 1
        await phase1(address);

        console.log(`\n⏳ Phase 1 complete!`);
        console.log(`   Re-run "pnpm staking" in 1 hour to claim the flag.`);
        console.log(`   The script will automatically resume from Phase 2.`);
    }
})();
