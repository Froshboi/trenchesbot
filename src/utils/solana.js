import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

const connection = new Connection(process.env.SOLANA_RPC_URL, "confirmed");

/**
 * Validate a Solana wallet address
 */
export async function isValidWallet(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get SOL balance of a wallet
 */
export async function getSolBalance(address) {
  try {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (err) {
    console.error("Error fetching SOL balance:", err);
    return 0;
  }
}

/**
 * Check if a user paid premium fee by scanning recent transactions
 */
export async function checkPremiumPayment(userAddress) {
  try {
    const sigs = await connection.getSignaturesForAddress(new PublicKey(process.env.DEV_WALLET), { limit: 50 });
    for (const sig of sigs) {
      const tx = await connection.getTransaction(sig.signature, { commitment: "confirmed" });
      if (!tx?.meta?.postBalances) continue;

      const sender = tx.transaction.message.accountKeys[0].toString();
      const lamportsSent = Math.abs(tx.meta.preBalances[0] - tx.meta.postBalances[0]);
      const solSent = lamportsSent / LAMPORTS_PER_SOL;

      if (sender === userAddress && solSent >= parseFloat(process.env.PREMIUM_FEE_SOL)) {
        return true;
      }
    }
  } catch (err) {
    console.error("Error checking premium payment:", err);
  }
  return false;
}
