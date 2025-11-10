export async function addWallet(ctx, address, user) {
  user.wallets.push(address);
  await ctx.reply(`✅ Watching wallet:\n${address}\n\nI’ll ping you when it moves.`);
}

export async function listWallets(ctx, user) {
  if (!user?.wallets?.length) return ctx.reply("No wallets yet bro 😅");
  const msg = user.wallets.map((w, i) => `${i + 1}. ${w}`).join("\n");
  await ctx.reply(`👀 Your wallets:\n${msg}`);
}

export async function deleteWallet(ctx, user) {
  user.wallets = [];
  await ctx.reply("🗑 All wallets deleted. You can now add a new one.");
}
