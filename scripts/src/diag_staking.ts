// Check how much time is left before we can run Phase 2 of staking
async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

const STAKED_AT_MS = 1773518422075n; // on-chain timestamp when receipts were created
const MILLISECONDS_PER_HOUR = 3_600_000n;
const READY_AT_MS = STAKED_AT_MS + MILLISECONDS_PER_HOUR; // need 1 full hour elapsed

(async () => {
    const clockObj = await rpc('sui_getObject', ['0x6', { showContent: true }]);
    const nowMs = BigInt(clockObj?.data?.content?.fields?.timestamp_ms ?? 0);
    const elapsed = nowMs - STAKED_AT_MS;
    const remaining = READY_AT_MS - nowMs;

    console.log(`Staked at:    ${new Date(Number(STAKED_AT_MS)).toLocaleTimeString()}`);
    console.log(`Ready at:     ${new Date(Number(READY_AT_MS)).toLocaleTimeString()}`);
    console.log(`Clock now:    ${new Date(Number(nowMs)).toLocaleTimeString()}`);
    console.log(`Elapsed:      ${(Number(elapsed) / 60_000).toFixed(1)} minutes`);
    
    if (remaining <= 0n) {
        console.log(`\n✅ READY NOW! Run: pnpm staking`);
    } else {
        const minsLeft = (Number(remaining) / 60_000).toFixed(1);
        console.log(`Remaining:    ${minsLeft} minutes`);
        console.log(`\n⏳ Run "pnpm staking" in ${minsLeft} minutes`);
    }
})();
