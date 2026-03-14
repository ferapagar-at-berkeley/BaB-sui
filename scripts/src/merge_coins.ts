import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };

const mainKeypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const mainAddress = mainKeypair.getPublicKey().toSuiAddress();

const client = new SuiGrpcClient({
    network: 'testnet',
    baseUrl: 'https://fullnode.testnet.sui.io:443',
});

async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

async function mergeCoins() {
    console.log(`Checking coins for ${mainAddress}...`);
    const coins = await rpc('suix_getCoins', [mainAddress]);
    
    if (coins.data.length <= 1) {
        console.log("Only one coin found, no merge needed.");
        return;
    }

    console.log(`Found ${coins.data.length} coins. Merging into the first one...`);
    const tx = new Transaction();
    const primaryCoin = coins.data[0].coinObjectId;
    const coinsToMerge = coins.data.slice(1).map((c: any) => c.coinObjectId);
    
    tx.mergeCoins(tx.object(primaryCoin), coinsToMerge.map((id: string) => tx.object(id)));
    
    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: mainKeypair,
    });
    console.log(`Merge TX Digest: ${(result as any).digest}`);
}

mergeCoins().catch(console.error);
