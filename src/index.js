import express from "express";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { getUser, saveUser } from "./utils/storage.js";
import { isValidWallet, checkPremiumPayment } from "./utils/solana.js";

dotenv.config();

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

app.use(express.json());

// --- 🟢 START COMMAND ---
bot.start(async (ctx) => {
  await ctx.deleteMessage().catch(() => {});
  const user = getUser(ctx.chat.id);
  const name = ctx.from.first_name || "bro";

  await ctx.reply(
    `👋 Yo ${name}!\n\nI'm *TrenchesBot*, your AI-powered Solana wallet watcher.\n\n💼 You can track wallet activity, check SOL prices, or even copy-trade — all from right here.\n\nSend me a wallet address to start watching (1 wallet free).`,
    { parse_mode: "Markdown" }
  );
});

// --- 💸 ADD WALLET ---
bot.command("addwallet", async (ctx) => {
  await ctx.deleteMessage().catch(() => {});
  const user = getUser(ctx.chat.id);

  if (!user.premium && user.wallets.length >= 1) {
    await ctx.reply(
      `⚠️ Free users can only track *1 wallet.*\n\nUpgrade to premium (0.05 SOL) to unlock unlimited wallets.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "💰 Upgrade Now", callback_data: "upgrade_premium" }],
          ],
        },
        parse_mode: "Markdown",
      }
    );
    return;
  }

  await ctx.reply("🔹 Send me the *wallet address* you want to watch:", {
    parse_mode: "Markdown",
  });
  user.awaitingWallet = true;
  saveUser(ctx.chat.id, user);
});

// --- 💬 HANDLE WALLET INPUT ---
bot.on("text", async (ctx) => {
  const user = getUser(ctx.chat.id);
  const message = ctx.message.text.trim();

  // Delete message for privacy
  setTimeout(() => ctx.deleteMessage(ctx.message.message_id).catch(() => {}), 2000);

  if (user.awaitingWallet) {
    if (!(await isValidWallet(message))) {
      await ctx.reply("❌ That doesn't look like a valid Solana wallet, bro. Try again.");
      return;
    }

    user.wallets.push({ address: message, name: `Wallet #${user.wallets.length + 1}` });
    delete user.awaitingWallet;
    saveUser(ctx.chat.id, user);

    await ctx.reply(
      `✅ Watching wallet:\n\`${message}\`\n\nI'll notify you when something big goes down.`,
      { parse_mode: "Markdown" }
    );
    return;
  }
});

// --- 📜 VIEW WALLETS ---
bot.command("mywallets", async (ctx) => {
  await ctx.deleteMessage().catch(() => {});
  const user = getUser(ctx.chat.id);

  if (!user.wallets.length) {
    await ctx.reply("👀 You aren’t watching any wallets yet. Use /addwallet to get started.");
    return;
  }

  const list = user.wallets.map((w, i) => `${i + 1}. \`${w.address}\``).join("\n");
  await ctx.reply(`📊 *Your tracked wallets:*\n\n${list}`, { parse_mode: "Markdown" });
});

// --- 💰 CHECK SOL PRICE ---
bot.command("price", async (ctx) => {
  await ctx.deleteMessage().catch(() => {});
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
  const data = await res.json();
  const price = data.solana.usd;

  let advice = "🟢 Time to load up, soldier.";
  if (price > 200) advice = "🚀 We moonin’, bro. Strap in.";
  else if (price < 80) advice = "🧠 Smart money’s buying this dip.";

  await ctx.reply(`💰 *SOL Price:* $${price}\n\n${advice}`, { parse_mode: "Markdown" });
});

// --- 💎 PREMIUM UPGRADE ---
bot.action("upgrade_premium", async (ctx) => {
  await ctx.deleteMessage().catch(() => {});
  const fee = parseFloat(process.env.PREMIUM_FEE_SOL || 0.05);

  await ctx.reply(
    `💎 To unlock unlimited wallets, send *${fee} SOL* to this address:\n\n\`${process.env.DEV_WALLET}\`\n\nOnce done, tap /premium to verify your payment.`,
    { parse_mode: "Markdown" }
  );
});

// --- 🔍 VERIFY PREMIUM PAYMENT ---
bot.command("premium", async (ctx) => {
  await ctx.deleteMessage().catch(() => {});
  const user = getUser(ctx.chat.id);

  await ctx.reply("⏳ Checking for your payment on-chain... hang tight.");

  const paid = await checkPremiumPayment(ctx.from.id.toString());
  if (paid) {
    user.premium = true;
    saveUser(ctx.chat.id, user);
    await ctx.reply("✅ Payment confirmed, bro! You’re now premium — unlimited wallets unlocked.");
  } else {
    await ctx.reply("❌ No payment found yet. Try again in a few minutes or double-check the address.");
  }
});

// --- 🌐 EXPRESS SERVER + BOT LAUNCH ---
app.get("/", (req, res) => res.send("TrenchesBot is online."));
app.listen(process.env.PORT || 3000, () => console.log("Server running..."));
bot.launch().then(() => console.log("🚀 TrenchesBot online!"));
