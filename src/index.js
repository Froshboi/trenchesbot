import express from "express";
import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import {
  addWallet,
  getWallets,
  walletExists,
} from "./storage.js";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(express.json());

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 👋 /start command
bot.start(async (ctx) => {
  const name = ctx.from.first_name || "friend";
  await ctx.reply(
    `👋 Yo ${name}!\n\nI'm TrenchesBot, your AI-powered Solana wallet watcher.\n\n💼 You can track wallet activity, check SOL prices, or even copy-trade — all from right here.\n\nSend me a wallet address to start watching (1 wallet free).`
  );
});

// 🎯 Main menu (after wallet added or command)
async function showMainMenu(ctx) {
  return ctx.reply(
    "📍 Choose an option below:",
    Markup.inlineKeyboard([
      [Markup.button.callback("💰 View Wallets", "view_wallets")],
      [Markup.button.callback("➕ Add Another Wallet", "add_wallet")],
      [Markup.button.callback("📈 Check SOL Price", "sol_price")],
      [Markup.button.callback("⚡ Copy Trade Setup", "copy_trade")],
    ])
  );
}

// 🪙 Handle wallet input from user
bot.on("text", async (ctx) => {
  const wallet = ctx.message.text.trim();
  const userId = ctx.from.id;

  // Ignore commands like /start
  if (wallet.startsWith("/")) return;

  // Validate wallet address
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return ctx.reply("❌ That doesn’t look like a valid Solana wallet address.");
  }

  if (walletExists(userId, wallet)) {
    return ctx.reply("⚠️ You’re already watching this wallet!");
  }

  addWallet(userId, wallet);
  await ctx.deleteMessage(ctx.message.message_id); // remove user input
  await ctx.reply(`✅ Watching wallet:\n\`${wallet}\`\nI’ll notify you about major transactions.`, { parse_mode: "Markdown" });

  await showMainMenu(ctx);
});

// 👁️ View wallets
bot.action("view_wallets", async (ctx) => {
  const userId = ctx.from.id;
  const wallets = getWallets(userId);
  if (wallets.length === 0)
    return ctx.reply("😅 You’re not watching any wallets yet. Send one to start!");
  const list = wallets.map((w, i) => `${i + 1}. \`${w}\``).join("\n");
  await ctx.reply(`👀 Your watched wallets:\n${list}`, { parse_mode: "Markdown" });
});

// ➕ Add another wallet (paywalled)
bot.action("add_wallet", async (ctx) => {
  const userId = ctx.from.id;
  const wallets = getWallets(userId);
  if (wallets.length >= 1) {
    return ctx.reply(
      `🚧 Adding more than 1 wallet requires premium access.\n\n💸 Send 0.05 SOL to: \`${process.env.DEV_WALLET}\`\nThen confirm your payment to unlock.`,
      { parse_mode: "Markdown" }
    );
  }
  await ctx.reply("💼 Send me the wallet address you want to add.");
});

// 📈 Check SOL price
bot.action("sol_price", async (ctx) => {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const data = await res.json();
    const price = data.solana.usd;
    const advice =
      price < 100
        ? "🟢 Cheap entry! Might be time to buy."
        : price < 150
        ? "🟡 Market steady — hodl strong."
        : "🔴 SOL pumping! Consider taking profits!";
    await ctx.reply(`💰 Current SOL price: *$${price}*\n\n${advice}`, { parse_mode: "Markdown" });
  } catch (err) {
    await ctx.reply("⚠️ Couldn’t fetch SOL price right now.");
  }
});

// ⚡ Copy trade setup (premium)
bot.action("copy_trade", async (ctx) => {
  return ctx.reply(
    `⚙️ Copy trading is a premium feature.\n\n💸 Send 0.05 SOL to: \`${process.env.DEV_WALLET}\` to unlock.\nI’ll guide you through mirroring trades once active.`,
    { parse_mode: "Markdown" }
  );
});

// 🏠 Back to menu
bot.action("back_to_menu", async (ctx) => showMainMenu(ctx));

// ---------- Express server for Deployra ----------
app.get("/", (req, res) => res.send("TrenchesBot is live!"));

// Telegram webhook endpoint
app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Set Telegram webhook using BASE_URL
  if (process.env.BASE_URL) {
    const webhookUrl = `${process.env.BASE_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ Webhook set to: ${webhookUrl}`);
  } else {
    console.log("⚠️ BASE_URL not set. Bot will use polling instead of webhook.");
  }

  bot.launch();
});
