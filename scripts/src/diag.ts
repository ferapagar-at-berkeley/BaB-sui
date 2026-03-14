// Quick diagnostic to see all coins in the wallet
import keyPairJson from "../keypair.json" with { type: "json" };
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const address = keypair.getPublicKey().toSuiAddress();

async function rpc(method: string, params: any[]) {
    const resp = await fetch('https://fullnode.testnet.sui.io:443', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return (await resp.json()).result;
}

(async () => {
    console.log(`Wallet: ${address}`);
    
    // Get all coins (all types)
    const allCoins = await rpc('suix_getAllCoins', [address]);
    console.log('\n=== All coins ===');
    for (const c of (allCoins?.data || [])) {
        console.log(`  Type: ${c.coinType}`);
        console.log(`  ObjectId: ${c.coinObjectId}`);
        console.log(`  Balance: ${c.balance}`);
        console.log('');
    }
    
    // Also get balances summary
    const balances = await rpc('suix_getAllBalances', [address]);
    console.log('=== Balance summary ===');
    for (const b of (balances || [])) {
        console.log(`  ${b.coinType}: ${b.totalBalance}`);
    }
})();
