import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { Telegraf } from "telegraf";
import { Connection, clusterApiUrl } from "@solana/web3.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// --- Telegram & Solana Config ---
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const port = process.env.PORT || 3000;
const HELIUS_RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
const DEV_WALLET = process.env.DEV_WALLET;
const DEV_FEE_LAMPORTS = Number(process.env.DEV_FEE_LAMPORTS) || 50000000; // 0.05 SOL
const connection = new Connection(HELIUS_RPC_URL);

const users = {}; // chat_id -> { wallets: [] }

// --- /start command ---
bot.start(async (ctx) => {
  const firstName = ctx.from?.first_name || "friend";

  await ctx.reply(
    `👋 Hey ${firstName}!\n` +
      `I'm *TrenchesBot*, your personal Solana wallet watcher.\n\n` +
      `💡 Send me a wallet address to start tracking it.\n` +
      `You'll get instant alerts when something happens.`,
    { parse_mode: "Markdown" }
  );
});

// --- Handle wallet messages ---
bot.on("text", async (ctx) => {
  const wallet = ctx.message.text.trim();
  const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);

  if (!valid) {
    return ctx.reply("⚠️ That doesn’t look like a valid Solana address. Try again!");
  }

  const chatId = ctx.chat.id;
  if (!users[chatId]) users[chatId] = { wallets: [] };

  const user = users[chatId];

  if (user.wallets.length >= 1) {
    return ctx.reply(
      `🔒 You’ve reached your free wallet limit.\n` +
        `To add more wallets, send *0.05 SOL* to:\n\`${DEV_WALLET}\`\n` +
        `Once confirmed, I’ll unlock more slots.`,
      { parse_mode: "Markdown" }
    );
  }

  user.wallets.push(wallet);

  try {
    await ctx.deleteMessage(ctx.message.message_id);
  } catch (e) {}

  await ctx.reply(
    `✅ Watching wallet:\n\`${wallet}\`\n` +
      `I’ll notify you about major transactions.`,
    { parse_mode: "Markdown" }
  );
});

// --- Webhook from Helius ---
app.post("/helius-webhook", async (req, res) => {
  console.log("Webhook received:", req.body);
  const events = req.body;

  for (const event of events) {
    const tx = event.signature;
    const account = event.account || "Unknown";

    for (const [chatId, data] of Object.entries(users)) {
      if (data.wallets.includes(account)) {
        await bot.telegram.sendMessage(
          chatId,
          `💥 Transaction alert for ${account}\n🔗 https://solscan.io/tx/${tx}`
        );
      }
    }
  }

  res.sendStatus(200);
});

// --- Start everything ---
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  bot.launch();
  console.log("🤖 TrenchesBot is live!");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
