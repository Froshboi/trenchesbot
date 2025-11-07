import express from "express";
import fetch from "node-fetch";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const userWallets: Record<string, string[]> = {}; // store users' wallets in memory

bot.start((ctx) => {
  ctx.reply("👋 Hey there! I’m TrenchesBot.\nSend me a Solana wallet address and I’ll start watching it for you.");
});

bot.on("text", async (ctx) => {
  const wallet = ctx.message.text.trim();
  const userId = ctx.chat.id.toString();

  // Basic validation
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return ctx.reply("⚠️ That doesn’t look like a valid Solana address. Try again!");
  }

  // Check if user already has a wallet
  if (userWallets[userId] && userWallets[userId].length >= 1) {
    return ctx.reply("💰 You already have one wallet added. To add more, please pay 0.05 SOL to the dev wallet.");
  }

  // Save wallet
  userWallets[userId] = [wallet];
  ctx.reply(`✅ Got it! I’m now watching your wallet: \n\`${wallet}\`\nYou’ll get alerts instantly 👀`, { parse_mode: "Markdown" });

  // Register webhook dynamically on Helius
  const res = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${process.env.HELIUS_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookURL: `${process.env.BASE_URL}/helius-webhook`,
      transactionTypes: ["TRANSFER", "EXECUTE", "CREATE"],
      accountAddresses: [wallet],
      webhookType: "transaction",
      authHeader: "optional-secret-if-you-want"
    })
  });

  if (!res.ok) {
    ctx.reply("⚠️ Couldn’t register the webhook on Helius. Please try again later.");
  } else {
    ctx.reply("🛰️ Webhook registered successfully! I’ll notify you of any new activity.");
  }
});

app.post("/helius-webhook", (req, res) => {
  const data = req.body;
  console.log("🚀 Webhook received:", data);
  res.sendStatus(200);
  // TODO: Notify user via Telegram here
});

app.listen(process.env.PORT || 3000, () => {
  console.log("TrenchesBot running...");
});

bot.launch();
