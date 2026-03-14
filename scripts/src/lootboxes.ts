import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiClient = new SuiGrpcClient({
	network: 'testnet',
	baseUrl: 'https://fullnode.testnet.sui.io:443',
});

const TARGET_PACKAGE_ID = "0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03";
const REQUIRED_PAYMENT = 12_000_000;
const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

// Call the Sui JSON-RPC endpoint
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

// Fetch USDC coins and pick the one with enough balance
async function getUsdcCoin(address: string): Promise<{ coinObjectId: string; balance: string } | null> {
    const result = await rpc('suix_getCoins', [address, USDC_TYPE]);
    const coins = result?.data || [];
    // Find first coin with enough balance to split from
    const coin = coins.find((c: any) => BigInt(c.balance) >= BigInt(REQUIRED_PAYMENT));
    return coin ?? null;
}

(async () => {
    console.log("Starting Lootboxes exploit (two-TX approach)...");
    
    const address = keypair.getPublicKey().toSuiAddress();
    console.log(`Wallet: ${address}`);
    
    // Initial balance check
    const result = await rpc('suix_getCoins', [address, USDC_TYPE]);
    const coins = result?.data || [];
    const totalBalance = coins.reduce((sum: bigint, c: any) => sum + BigInt(c.balance), BigInt(0));
    console.log(`USDC balance: ${totalBalance} (need ${REQUIRED_PAYMENT} per attempt)`);

    if (totalBalance < BigInt(REQUIRED_PAYMENT)) {
        console.error("Not enough USDC. Get testnet USDC at: https://faucet.circle.com/");
        return;
    }

    let success = false;
    let attempts = 0;

    console.log("\nBeginning exploit loop...\n");

    while (!success) {
        attempts++;
        console.log(`Attempt #${attempts}...`);

        try {
            // Re-fetch coin each iteration to avoid stale coin IDs
            const usdcCoin = await getUsdcCoin(address);
            if (!usdcCoin) {
                console.error("Out of USDC or no single coin with enough balance. Exiting.");
                break;
            }

            // ── TX1: open_lootbox + transfer MaybeFlag ────────────────────────────
            // (Can't extract_flag here because Sui forbids MoveCall after Random)
            const tx1 = new Transaction();
            const [paymentCoin] = tx1.splitCoins(
                tx1.object(usdcCoin.coinObjectId),
                [REQUIRED_PAYMENT]
            );
            const maybeFlag = tx1.moveCall({
                target: `${TARGET_PACKAGE_ID}::lootboxes::open_lootbox`,
                arguments: [paymentCoin, tx1.object("0x8")],
            });
            tx1.transferObjects([maybeFlag], tx1.pure.address(address));

            const resp1 = await suiClient.signAndExecuteTransaction({
                transaction: tx1,
                signer: keypair,
                include: { effects: true, objectChanges: true },
            });

            // SuiGrpcClient wraps results in resp.Transaction or resp.FailedTransaction
            const data1: any = (resp1 as any).Transaction ?? (resp1 as any).FailedTransaction;
            if (!data1) {
                console.log("  TX1 unexpected response shape:", JSON.stringify(resp1).slice(0, 300));
                continue;
            }

            const digest1 = data1.digest;
            console.log(`  TX1: ${digest1}`);

            if (!data1.status?.success) {
                console.log(`  TX1 failed: ${data1.status?.error}`);
                continue;
            }

            // Find MaybeFlag in object changes
            const objectChanges: any[] = data1.objectChanges ?? data1.effects?.objectChanges ?? [];
            console.log(`  Object changes count: ${objectChanges.length}`);
            
            // Debug: print object types for the first attempt to verify the field path
            if (attempts === 1) {
                objectChanges.forEach((c: any) => console.log("    change:", JSON.stringify(c).slice(0, 150)));
            }

            const maybeFlagChange = objectChanges.find(
                (c: any) => c.type === 'created' && (
                    c.objectType?.includes('::lootboxes::MaybeFlag') ||
                    c.objectType?.includes('MaybeFlag')
                )
            );

            if (!maybeFlagChange) {
                console.log("  MaybeFlag not found in objectChanges — checking via RPC...");
                // Fallback: query owned objects of type MaybeFlag
                const ownedResult = await rpc('suix_getOwnedObjects', [
                    address,
                    { filter: { StructType: `${TARGET_PACKAGE_ID}::lootboxes::MaybeFlag` }, options: { showContent: true } },
                    null,
                    1
                ]);
                const ownedMaybeFlags = ownedResult?.data || [];
                if (ownedMaybeFlags.length === 0) {
                    console.log("  No MaybeFlag found at all. Skipping.");
                    continue;
                }
                // Use the most recently owned MaybeFlag
                const mf = ownedMaybeFlags[0];
                const mfId = mf.data?.objectId;
                const mfFields = mf.data?.content?.fields;
                console.log(`  MaybeFlag (via RPC): ${mfId}`);
                await extractIfHasFlag(mfId, mfFields, address, tx1);
            } else {
                const maybeFlagId = maybeFlagChange.objectId;
                console.log(`  MaybeFlag: ${maybeFlagId}`);

                // Fetch MaybeFlag object to check if there's a flag inside
                const objResult = await rpc('sui_getObject', [maybeFlagId, { showContent: true }]);
                const fields = objResult?.data?.content?.fields;
                
                if (await extractIfHasFlag(maybeFlagId, fields, address, tx1)) {
                    success = true;
                }
            }

        } catch (e: any) {
            console.log(`  Error: ${e.message || e}`);
        }
    }

    console.log(`\nCompleted in ${attempts} attempt(s).`);
})();

async function extractIfHasFlag(maybeFlagId: string, fields: any, address: string, _tx: Transaction): Promise<boolean> {
    if (!fields) {
        console.log("  Could not read MaybeFlag fields.");
        return false;
    }

    // maybe_flag is a Move Option<Flag>: Some => object, None => null/undefined
    const hasFlag = fields.maybe_flag !== null && fields.maybe_flag !== undefined;
    
    if (!hasFlag) {
        console.log("  ❌ Empty lootbox (12 USDC spent — no revert with Random restriction).");
        return false;
    }

    console.log("  🎉 Found a flag! Extracting...");

    // ── TX2: extract_flag ─────────────────────────────────────────────────────
    const tx2 = new Transaction();
    const flagObj = tx2.moveCall({
        target: `${TARGET_PACKAGE_ID}::lootboxes::extract_flag`,
        arguments: [tx2.object(maybeFlagId)],
    });
    tx2.transferObjects([flagObj], tx2.pure.address(address));

    const resp2 = await suiClient.signAndExecuteTransaction({
        transaction: tx2,
        signer: keypair,
        include: { effects: true },
    });

    const data2: any = (resp2 as any).Transaction ?? (resp2 as any).FailedTransaction;
    const digest2 = data2?.digest;
    console.log(`  TX2: ${digest2}`);

    if (data2?.status?.success) {
        console.log("\n🏆 SUCCESS! Flag captured!");
        console.log(`View on explorer: https://suiscan.xyz/testnet/tx/${digest2}`);
        return true;
    } else {
        console.error("  TX2 failed:", data2?.status?.error ?? JSON.stringify(resp2).slice(0, 200));
        return false;
    }
}
