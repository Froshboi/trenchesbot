import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { Telegraf } from "telegraf";
import { Connection, PublicKey } from "@solana/web3.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// --- Telegram & Solana ---
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const port = process.env.PORT || 3000;
const HELIUS_RPC_URL = process.env.SOLANA_RPC_URL;
const DEV_WALLET = process.env.DEV_WALLET;
const DEV_FEE_LAMPORTS = Number(process.env.DEV_FEE_LAMPORTS) || 50000000;
const connection = new Connection(HELIUS_RPC_URL);

const FREE_WALLET_LIMIT = 1; // free wallets per user
const users = {}; // chat_id -> { wallets: [{address, paid}] }

// --- /start command ---
bot.start(async (ctx) => {
  const name = ctx.from?.first_name || "friend";
  await ctx.reply(
    `👋 Hey ${name}!\n` +
    `I'm *TrenchesBot*, your personal Solana wallet watcher.\n\n` +
    `💡 Send me a wallet address to start tracking it.\n` +
    `You'll get instant alerts when transactions happen!`,
    { parse_mode: "Markdown" }
  );
});

// --- Validate Solana address ---
function isValidWallet(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

// --- Check if user paid for extra wallets ---
async function hasPaidExtra(userWallet) {
  try {
    const balance = await connection.getBalance(new PublicKey(userWallet));
    return balance >= DEV_FEE_LAMPORTS;
  } catch (e) {
    console.log("Error checking payment:", e);
    return false;
  }
}

// --- Handle wallet messages ---
bot.on("text", async (ctx) => {
  const walletAddress = ctx.message.text.trim();
  const chatId = ctx.chat.id;

  if (!isValidWallet(walletAddress)) {
    return ctx.reply("⚠️ That’s not a valid Solana wallet address. Try again!");
  }

  if (!users[chatId]) users[chatId] = { wallets: [] };
  const user = users[chatId];

  // Free wallet limit check
  if (user.wallets.length >= FREE_WALLET_LIMIT) {
    const paid = await hasPaidExtra(walletAddress);
    if (!paid) {
      return ctx.reply(
        `🔒 Free wallet limit reached.\n` +
        `To track more wallets, send 0.05 SOL to:\n\`${DEV_WALLET}\`\n` +
        `Once detected, you'll be able to add this wallet.`,
        { parse_mode: "Markdown" }
      );
    }
  }

  // Add wallet
  user.wallets.push({ address: walletAddress, paid: user.wallets.length >= FREE_WALLET_LIMIT });
  try { await ctx.deleteMessage(ctx.message.message_id); } catch (e) {}
  await ctx.reply(
    `✅ Now watching wallet:\n\`${walletAddress}\`\nI’ll alert you about transactions.`,
    { parse_mode: "Markdown" }
  );
});

// --- Helius webhook endpoint ---
app.post("/helius-webhook", async (req, res) => {
  const events = req.body;

  for (const event of events) {
    const tx = event.signature;
    const account = event.account || "Unknown";

    for (const [chatId, userData] of Object.entries(users)) {
      if (userData.wallets.some(w => w.address === account)) {
        await bot.telegram.sendMessage(
          chatId,
          `💥 Transaction alert for ${account}\n🔗 https://solscan.io/tx/${tx}`
        );
      }
    }
  }

  res.sendStatus(200);
});

// --- Start server and bot ---
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  bot.launch();
  console.log("🤖 TrenchesBot live and listening!");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
