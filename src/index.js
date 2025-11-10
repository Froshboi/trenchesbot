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

// 🪙 Handle any text message (wallet input)
bot.on("text", async (ctx) => {
  const wallet = ctx.message.text.trim();
  const userId = ctx.from.id;

  // ✅ Simple Solana address validation
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return ctx.reply("❌ That doesn’t look like a valid Solana wallet address.");
  }

  if (walletExists(userId, wallet)) {
    return ctx.reply("⚠️ You’re already watching this wallet, bro!");
  }

  addWallet(userId, wallet);
  await ctx.deleteMessage(ctx.message.message_id); // delete the wallet message
  await ctx.reply(`✅ Watching wallet:\n\`${wallet}\`\nI’ll notify you about major transactions.`, { parse_mode: "Markdown" });

  await showMainMenu(ctx);
});

// 👁️ View user wallets
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
      "🚧 Adding more than 1 wallet requires premium access.\n\n💸 Send 0.05 SOL to unlock:\n`" +
        process.env.DEV_WALLET +
        "`\n\nOnce confirmed, I’ll grant access.",
      { parse_mode: "Markdown" }
    );
  }
  await ctx.reply("💼 Send me the wallet address you want to add.");
});

// 📈 SOL price
bot.action("sol_price", async (ctx) => {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const data = await res.json();
    const price = data.solana.usd;
    const advice =
      price < 100
        ? "🟢 Bro, SOL’s cheap — might be a good time to buy!"
        : price < 150
        ? "🟡 Market’s steady, hodl strong."
        : "🔴 SOL’s pumping! Might be time to take profits!";
    await ctx.reply(`💰 Current SOL price: *$${price}*\n\n${advice}`, { parse_mode: "Markdown" });
  } catch (e) {
    await ctx.reply("⚠️ Couldn’t fetch SOL price right now.");
  }
});

// ⚡ Copy trade setup (premium)
bot.action("copy_trade", async (ctx) => {
  return ctx.reply(
    "⚙️ Copy trading is a premium feature.\n\n💸 Pay 0.05 SOL to `" +
      process.env.DEV_WALLET +
      "` to unlock.\n\nOnce active, I’ll help you mirror trades from your watched wallets.",
    { parse_mode: "Markdown" }
  );
});

// 🚀 Express server (for Deployra)
app.get("/", (req, res) => res.send("TrenchesBot is live!"));

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Server running on port " + (process.env.PORT || 3000))
);

// 🤖 Launch bot
bot.launch();
