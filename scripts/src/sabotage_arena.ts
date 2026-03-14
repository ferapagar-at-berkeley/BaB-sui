import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };
import arenaJson from "../../arena.json" with { type: "json" };

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiClient = new SuiGrpcClient({
    network: 'testnet',
    baseUrl: 'https://fullnode.testnet.sui.io:443',
});

const PACKAGE_ID = arenaJson.package_id;
const ARENA_ID = "0xd7dd51e3c156a0c0152cad6bc94884db5302979e78f04d631a51ab107f9449e6";
const CLOCK_ID = "0x6";
const SHIELD_THRESHOLD = 12;
const COOLDOWN_MS = 600_000; // 10 minutes

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
        include: { effects: true },
    });
    return (resp as any).Transaction ?? (resp as any).FailedTransaction;
}

async function getPlayerState(address: string) {
    // Get arena players table ID
    const arenaObj = await rpc('sui_getObject', [ARENA_ID, { showContent: true }]);
    const tableId = arenaObj?.data?.content?.fields?.players?.fields?.id?.id;
    if (!tableId) return null;
    const entry = await rpc('suix_getDynamicFieldObject', [
        tableId,
        { type: 'address', value: address }
    ]);
    if (!entry?.data) return null;
    return entry.data?.content?.fields?.value?.fields as { shield: string; last_action_ms: string };
}

async function getArenaState() {
    const arenaObj = await rpc('sui_getObject', [ARENA_ID, { showContent: true }]);
    return arenaObj?.data?.content?.fields as any;
}

// ─── Actions ──────────────────────────────────────────────────────────────

async function register(address: string) {
    console.log('Registering in arena...');
    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::sabotage_arena::register`,
        arguments: [tx.object(ARENA_ID), tx.object(CLOCK_ID)],
    });
    const data = await signAndGetData(tx);
    if (!data?.status?.success) throw new Error(`Register failed: ${data?.status?.error}`);
    console.log(`✅ Registered! TX: ${data.digest}`);
}

async function build() {
    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::sabotage_arena::build`,
        arguments: [tx.object(ARENA_ID), tx.object(CLOCK_ID)],
    });
    const data = await signAndGetData(tx);
    if (!data?.status?.success) throw new Error(`Build failed: ${data?.status?.error}`);
    return data.digest;
}

async function attack(target: string) {
    const tx = new Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::sabotage_arena::attack`,
        arguments: [
            tx.object(ARENA_ID),
            tx.pure.address(target),
            tx.object(CLOCK_ID),
        ],
    });
    const data = await signAndGetData(tx);
    if (!data?.status?.success) throw new Error(`Attack failed: ${data?.status?.error}`);
    return data.digest;
}

async function claimFlag(address: string) {
    console.log('Claiming flag...');
    const tx = new Transaction();
    const flag = tx.moveCall({
        target: `${PACKAGE_ID}::sabotage_arena::claim_flag`,
        arguments: [tx.object(ARENA_ID), tx.object(CLOCK_ID)],
    });
    tx.transferObjects([flag], tx.pure.address(address));
    const data = await signAndGetData(tx);
    if (!data?.status?.success) throw new Error(`Claim failed: ${data?.status?.error}`);
    console.log(`\n🏆 FLAG CLAIMED! TX: ${data.digest}`);
    console.log(`View: https://suiscan.xyz/testnet/tx/${data.digest}`);
    return data.digest;
}

// ─── Main loop ─────────────────────────────────────────────────────────────

(async () => {
    const address = keypair.getPublicKey().toSuiAddress();
    console.log(`Wallet: ${address}`);

    // Check arena state
    const arena = await getArenaState();
    const deadlineMs = Number(arena?.deadline_ms ?? 0);
    const nowMs = Date.now();
    console.log(`Arena deadline: ${new Date(deadlineMs).toLocaleString()}`);
    console.log(`Flags remaining: ${arena?.flags_remaining}`);
    if (nowMs >= deadlineMs) {
        console.error('❌ Arena is closed!');
        return;
    }

    // Check if registered
    let player = await getPlayerState(address);
    if (!player) {
        await register(address);
        player = { shield: '0', last_action_ms: '0' };
    }

    console.log(`\nCurrent shield: ${player.shield} / ${SHIELD_THRESHOLD}`);

    // Build loop — build every 10 minutes until shield reaches threshold
    let buildCount = 0;
    while (true) {
        player = await getPlayerState(address);
        if (!player) { console.error('Lost player state'); break; }

        const shield = Number(player.shield);
        const lastAction = Number(player.last_action_ms);
        const clockObj = await rpc('sui_getObject', [CLOCK_ID, { showContent: true }]);
        const clockMs = Number(clockObj?.data?.content?.fields?.timestamp_ms ?? 0);

        console.log(`\nShield: ${shield}/${SHIELD_THRESHOLD} | Last action: ${lastAction === 0 ? 'never' : new Date(lastAction).toLocaleTimeString()}`);

        if (shield >= SHIELD_THRESHOLD) {
            await claimFlag(address);
            break;
        }

        // Check cooldown
        const cooldownEnds = lastAction + COOLDOWN_MS;
        if (clockMs < cooldownEnds) {
            const waitMs = cooldownEnds - clockMs;
            const waitMins = (waitMs / 60_000).toFixed(1);
            console.log(`⏳ Cooldown active. Waiting ${waitMins} minutes...`);
            await new Promise(r => setTimeout(r, waitMs + 2000)); // +2s buffer
            continue;
        }

        // Build!
        buildCount++;
        const digest = await build();
        console.log(`🔨 Build #${buildCount} done! TX: ${digest}`);
        console.log(`   Shield now: ${shield + 1}/${SHIELD_THRESHOLD}`);

        if (shield + 1 >= SHIELD_THRESHOLD) {
            // Claim right away
            await claimFlag(address);
            break;
        }

        // Wait for cooldown before next build
        const waitMins = COOLDOWN_MS / 60_000;
        console.log(`   Next build in ${waitMins} minutes...`);
        await new Promise(r => setTimeout(r, COOLDOWN_MS + 2000));
    }
})();
