import express from "express";
import fetch from "node-fetch";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// --- Telegram Bot Setup ---
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const userWallets: Record<string, string[]> = {}; // store users' wallets per Telegram ID

// /start command — friendly welcome
bot.start((ctx) => {
  ctx.reply(
    "👋 Hey there! I’m *TrenchesBot* — your Web3 sidekick.\n\n" +
    "Send me a Solana wallet address (like `8k9Y8p25HPL2Q7sYBz4wnpqsjPwTMUWVBr4eT6Rb2daV`) " +
    "and I’ll start watching it for you 👀",
    { parse_mode: "Markdown" }
  );
});

// Handle wallet messages
bot.on("text", async (ctx) => {
  const wallet = ctx.message.text.trim();
  const userId = ctx.chat.id.toString();

  // Basic validation for Solana address
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return ctx.reply("⚠️ That doesn’t look like a valid Solana address. Try again!");
  }

  // Check user wallet limit
  if (userWallets[userId] && userWallets[userId].length >= 1) {
    return ctx.reply(
      "💰 You already have one wallet added.\n" +
      "To add more, please send 0.05 SOL to the dev wallet below:\n" +
      `\`${process.env.DEV_WALLET}\``,
      { parse_mode: "Markdown" }
    );
  }

  // Save user wallet
  userWallets[userId] = [wallet];
  ctx.reply(`✅ Got it! I’m now watching your wallet:\n\`${wallet}\`\nYou’ll get instant alerts 👀`, { parse_mode: "Markdown" });

  // Register webhook with Helius
  try {
    const heliusResponse = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${process.env.HELIUS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookURL: `${process.env.BASE_URL}/helius-webhook`,
        accountAddresses: [wallet],
        webhookType: "transaction",
        transactionTypes: ["EXECUTE", "CREATE", "TRANSFER", "APPROVE", "REJECT", "CANCEL"],
      }),
    });

    if (heliusResponse.ok) {
      ctx.reply("🛰️ Webhook registered successfully! You’ll start receiving alerts soon.");
    } else {
      ctx.reply("⚠️ Something went wrong registering your webhook. Please try again later.");
    }
  } catch (err) {
    console.error(err);
    ctx.reply("❌ Failed to connect to Helius. Check your API key or network.");
  }
});

// --- Helius Webhook Endpoint ---
app.post("/helius-webhook", async (req, res) => {
  const body = req.body;
  res.sendStatus(200);

  console.log("🚀 Webhook triggered:", JSON.stringify(body, null, 2));

  // If a transaction was detected, notify relevant users
  for (const event of body) {
    const walletAddress = event.account;
    const txType = event.type || "transaction";
    const sig = event.signature || "";

    // Find users who registered this wallet
    for (const [userId, wallets] of Object.entries(userWallets)) {
      if (wallets.includes(walletAddress)) {
        bot.telegram.sendMessage(
          userId,
          `📡 New ${txType} detected on your wallet:\n\`${walletAddress}\`\n\n🔗 [View Transaction](https://solscan.io/tx/${sig})`,
          { parse_mode: "Markdown", disable_web_page_preview: true }
        );
      }
    }
  }
});

// --- Webhook Setup for Telegram ---
const BASE_URL = process.env.BASE_URL!;
(async () => {
  const webhookUrl = `${BASE_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`;
  await bot.telegram.setWebhook(webhookUrl);
  app.use(bot.webhookCallback(`/bot${process.env.TELEGRAM_BOT_TOKEN}`));

  app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 TrenchesBot live at ${webhookUrl}`);
  });
})();
