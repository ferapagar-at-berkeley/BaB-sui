import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };

/**
 *
 * Global variables
 *
 * These variables can be used throughout the exercise below.
 *
 */
const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiClient = new SuiGrpcClient({
	network: 'testnet',
	baseUrl: 'https://fullnode.testnet.sui.io:443',
});

// The deployed contract address from the README
const PACKAGE_ID = "0x936313e502e9cbf6e7a04fe2aeb4c60bc0acd69729acc7a19921b33bebf72d03";

(async () => {
    console.log("Starting script to interact with Moving Window contract...");

    try {
        const tx = new Transaction();

        // Call the moving_window::extract_flag function
        // It requires the Clock object (0x6)
        const flag = tx.moveCall({
            target: `${PACKAGE_ID}::moving_window::extract_flag`,
            arguments: [
                tx.object("0x6") // The shared Clock object
            ],
        });

        // Transfer the extracted flag to our address
        tx.transferObjects(
            [flag],
            keypair.getPublicKey().toSuiAddress()
        );

        // Sign and execute the transaction
        const response = await suiClient.signAndExecuteTransaction({
            transaction: tx,
            signer: keypair,
        });

        // Wait for it to be confirmed and get the effects
        const result = await suiClient.waitForTransaction({
             digest: response.digest,
             options: {
                 showEffects: true,
                 showObjectChanges: true,
             }
        });

        if (result.effects?.status.status === 'success') {
            console.log("Successfully extracted the flag!");
            console.log(`Transaction digest: ${result.digest}`);
            const createdObjects = result.objectChanges?.filter(b => b.type === "created") || [];
            console.log("Created objects:", createdObjects);
        } else {
            console.error("Transaction failed:", result.effects?.status.error);
        }

    } catch (e: any) {
        console.error("Failed to extract flag:");
        if (e.message?.includes("EWindowClosed") || e.message?.includes("0")) {
            console.error("The time window is currently CLOSED. Wait for the window to open (first 5 minutes of an hour, or the 5 minutes starting at half past the hour).");
        } else {
            console.error(e.message || e);
        }
    }
})();