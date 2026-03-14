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
const USDC_TYPE = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
const COST_PER_FLAG = 3849000n;

(async () => {
  const address = keypair.getPublicKey().toSuiAddress();
  console.log(`Wallet: ${address}`);

  // Fetch all USDC coins
  const { objects: usdcCoins } = await suiClient.listCoins({
    owner: address,
    coinType: USDC_TYPE,
  });

  if (usdcCoins.length === 0) {
    console.error("No USDC found. Get testnet USDC at: https://faucet.circle.com/");
    console.error(`Your address: ${address}`);
    process.exit(1);
  }

  const totalBalance = usdcCoins.reduce((sum, c) => sum + BigInt(c.balance), 0n);
  console.log(`USDC balance: ${totalBalance} (need ${COST_PER_FLAG})`);

  if (totalBalance < COST_PER_FLAG) {
    console.error(`Insufficient USDC. Need ${COST_PER_FLAG}, have ${totalBalance}.`);
    console.error("Get more testnet USDC at: https://faucet.circle.com/");
    process.exit(1);
  }

  const tx = new Transaction();

  const primaryCoin = tx.object(usdcCoins[0].objectId);
  if (usdcCoins.length > 1) {
    tx.mergeCoins(primaryCoin, usdcCoins.slice(1).map(c => tx.object(c.objectId)));
  }

  // Split exactly COST_PER_FLAG from the primary coin
  const [paymentCoin] = tx.splitCoins(primaryCoin, [COST_PER_FLAG]);

  // Call buy_flag — it consumes the payment coin and returns a Flag
  const flag = tx.moveCall({
    target: `${PACKAGE_ID}::merchant::buy_flag`,
    arguments: [paymentCoin],
  });

  // Transfer the flag to our wallet
  tx.transferObjects([flag], address);

  console.log("Submitting transaction...");
  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    include: { effects: true },
  });

  const txData = result.Transaction ?? result.FailedTransaction;
  if (!txData) {
    console.error("Unexpected result:", result);
    process.exit(1);
  }

  if (txData.status.success) {
    console.log("Flag purchased successfully!");
    console.log(`Transaction digest: ${txData.digest}`);
    console.log(`View on explorer: https://suiscan.xyz/testnet/tx/${txData.digest}`);
  } else {
    console.error("Transaction failed:", txData.status.error);
  }
})();
