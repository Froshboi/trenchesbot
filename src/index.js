import express from "express";
import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { addWallet, removeWallet, getWallets, walletExists } from "./storage.js";
import { checkWalletActivity } from "./solana.js";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const bot = new Telegraf(process.env.BOT_TOKEN);

// ---------- START COMMAND ----------
bot.start(async (ctx) => {
  await ctx.reply(
    "👋 Yo fam! I’m *TrenchesBot* — your Solana wallet watcher and alpha sidekick.\n\nLet’s get started 🔥",
    { parse_mode: "Markdown" }
  );

  await ctx.reply("Press the button below to begin 👇", Markup.keyboard([["🚀 Start Tracking"]]).resize());
});

// ---------- MENU SYSTEM ----------
bot.hears("🚀 Start Tracking", async (ctx) => {
  const wallets = getWallets(ctx.from.id);
  if (wallets.length === 0) {
    await ctx.reply("💼 You don’t have any wallets added yet.\nSend your first wallet address to start tracking 👇");
  } else {
    await sendMainMenu(ctx);
  }
});

bot.command("menu", async (ctx) => sendMainMenu(ctx));

async function sendMainMenu(ctx) {
  await ctx.reply(
    "🏦 Main Menu — What’s the move?",
    Markup.keyboard([
      ["➕ Add Wallet", "👀 View Wallets"],
      ["💰 Solana Price", "🚫 Remove Wallet"],
    ])
      .resize()
      .oneTime()
  );
}

// ---------- ADD WALLET ----------
bot.hears("➕ Add Wallet", async (ctx) => {
  const wallets = getWallets(ctx.from.id);
  if (wallets.length >= 1) {
    return ctx.reply(
      "⚠️ Bro, free users can only track *one wallet.*\nUpgrade to premium to track more 💸",
      Markup.keyboard([["💳 Upgrade to Premium"], ["🏠 Back to Menu"]]).resize()
    );
  }
  ctx.session = { waitingForWallet: true };
  await ctx.reply("👀 Drop your Solana wallet address below 👇");
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();

  // only process wallet entry if session active
  if (ctx.session?.waitingForWallet) {
    const wallet = text;
    const userId = ctx.from.id;

    if (!/^([1-9A-HJ-NP-Za-km-z]{32,44})$/.test(wallet)) {
      return ctx.reply("❌ Invalid wallet address. Try again.");
    }

    if (walletExists(userId, wallet)) {
      return ctx.reply("⚠️ You’re already tracking this wallet.");
    }

    addWallet(userId, wallet);
    ctx.session.waitingForWallet = false;

    return ctx.reply(`✅ Wallet added:\n\`${wallet}\`\n\nI’ll ping you when it moves 💸`, {
      parse_mode: "Markdown",
      ...Markup.keyboard([["🏠 Back to Menu"]]).resize(),
    });
  }

  // handle general wallet input from start
  if (/^([1-9A-HJ-NP-Za-km-z]{32,44})$/.test(text)) {
    const userId = ctx.from.id;
    if (walletExists(userId, text)) {
      return ctx.reply("⚠️ You’re already watching this wallet!");
    }
    addWallet(userId, text);
    return ctx.reply(`✅ Watching wallet:\n\`${text}\`\nI’ll keep you updated fam 👀`, {
      parse_mode: "Markdown",
    });
  }
});

// ---------- VIEW WALLETS ----------
bot.hears("👀 View Wallets", async (ctx) => {
  const wallets = getWallets(ctx.from.id);
  if (wallets.length === 0) {
    return ctx.reply("💼 You haven’t added any wallets yet.");
  }
  await ctx.reply(`📜 Your wallets:\n${wallets.map((w) => `• \`${w}\``).join("\n")}`, {
    parse_mode: "Markdown",
  });
});

// ---------- REMOVE WALLET ----------
bot.hears("🚫 Remove Wallet", async (ctx) => {
  const wallets = getWallets(ctx.from.id);
  if (wallets.length === 0) {
    return ctx.reply("🤷‍♂️ You’ve got no wallets to remove.");
  }

  await ctx.reply(
    "Which wallet do you wanna remove?",
    Markup.keyboard([...wallets.map((w) => [w]), ["🏠 Back to Menu"]]).resize()
  );
});

bot.hears(/^([1-9A-HJ-NP-Za-km-z]{32,44})$/, async (ctx) => {
  const wallet = ctx.message.text.trim();
  const userId = ctx.from.id;
  if (walletExists(userId, wallet)) {
    removeWallet(userId, wallet);
    return ctx.reply(`🗑️ Removed wallet:\n\`${wallet}\``, { parse_mode: "Markdown" });
  }
});

// ---------- SOLANA PRICE ----------
bot.hears("💰 Solana Price", async (ctx) => {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    const data = await res.json();
    const price = data.solana.usd;
    const sentiment = price > 180 ? "🚀 Bro, SOL flying — maybe take profits 💸" : price < 130 ? "📉 Cheap entry — stack some bags!" : "🧘 Hold steady, king. Patience pays.";
    await ctx.reply(`💰 *SOL Price:* $${price}\n\n${sentiment}`, { parse_mode: "Markdown" });
  } catch (err) {
    await ctx.reply("❌ Couldn’t fetch SOL price. Market’s acting weird 🥴");
  }
});

// ---------- UPGRADE PROMPT ----------
bot.hears("💳 Upgrade to Premium", async (ctx) => {
  await ctx.reply("💎 Premium gets you:\n- Multiple wallets\n- Copy trading access\n- Real-time alerts\n\n💸 Send payment to: `soon.sol`\nThen DM your TX ID to unlock.", { parse_mode: "Markdown" });
});

// ---------- BACK TO MENU ----------
bot.hears("🏠 Back to Menu", async (ctx) => sendMainMenu(ctx));

// ---------- WEBHOOK ----------
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body);
  res.status(200).send("OK");
});

// ---------- HEALTH CHECK ----------
app.get("/", (req, res) => res.send("TrenchesBot is running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  const webhookUrl = `${process.env.BASE_URL}/bot${process.env.BOT_TOKEN}`;
  await bot.telegram.setWebhook(webhookUrl);
  console.log(`✅ Webhook set to: ${webhookUrl}`);
});
