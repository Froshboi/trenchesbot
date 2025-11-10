import fs from "fs";

const STORAGE_FILE = "./wallets.json";

// 🗂️ Load wallets from file or start empty
function loadStorage() {
  try {
    if (!fs.existsSync(STORAGE_FILE)) return {};
    const data = fs.readFileSync(STORAGE_FILE, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("❌ Error loading storage:", err);
    return {};
  }
}

// 💾 Save wallets back to file
function saveStorage(storage) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(storage, null, 2));
}

// ➕ Add wallet for a user
export function addWallet(userId, wallet) {
  const storage = loadStorage();
  if (!storage[userId]) storage[userId] = [];
  if (!storage[userId].includes(wallet)) {
    storage[userId].push(wallet);
    saveStorage(storage);
  }
}

// ❌ Remove wallet for a user
export function removeWallet(userId, wallet) {
  const storage = loadStorage();
  if (!storage[userId]) return;
  storage[userId] = storage[userId].filter((w) => w !== wallet);
  saveStorage(storage);
}

// 👀 Get all wallets for a user
export function getWallets(userId) {
  const storage = loadStorage();
  return storage[userId] || [];
}

// 🔍 Check if wallet already exists for user
export function walletExists(userId, wallet) {
  const storage = loadStorage();
  return storage[userId]?.includes(wallet) || false;
}
