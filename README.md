# TrenchesBot with Helius + /follow + Paywall

This version adds:
- Helius webhook endpoint (`/helius-webhook`) so you can register a Helius webhook for real-time decoded transaction events.
- Telegram command `/follow <wallet>` and conversational replies.
- Simple UI at `/ui?user=<telegramId>` to list and remove followed wallets.
- Paywall: users can follow 1 wallet free; additional wallets require a 0.05 SOL payment to your dev wallet with their Telegram ID in the memo. The bot verifies the payment before adding wallets beyond the free limit.

## Quick setup
1. Copy `.env.example` to `.env` and fill in values (especially `SOLANA_RPC_URL` with your Helius API key).
2. `npm install`
3. `npm run dev`

## Helius webhook
- Configure your Helius dashboard to POST decoded transaction events to:
  `https://<your-public-domain>/helius-webhook`
- The webhook will include decoded instructions; the bot will parse transfers and notify followers.

## Payment flow
- When a user tries to add more than 1 wallet, the bot asks them to send **0.05 SOL** to `DEV_WALLET` and include their Telegram ID as a Memo.
- The user sends the tx signature to the bot (via chat or UI). The bot verifies the tx via `getTransaction` and checks a transfer of exactly 0.05 SOL to `DEV_WALLET` with the Memo = telegramId.

Security: Never store private keys. This starter uses in-memory storage; for production use a database.

