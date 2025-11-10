import fs from "fs";

const FILE_PATH = "./data.json";

// Load data at startup
let data = {};
if (fs.existsSync(FILE_PATH)) {
  try {
    data = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
  } catch (err) {
    console.error("Failed to parse data.json, starting fresh:", err);
    data = {};
  }
}

/**
 * Save current memory data to file
 */
function save() {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error saving data.json:", err);
  }
}

/**
 * Get or initialize user data by chatId
 */
export function getUser(chatId) {
  if (!data[chatId]) {
    data[chatId] = { wallets: [], premium: false };
    save();
  }
  return data[chatId];
}

/**
 * Save user data
 */
export function saveUser(chatId, userData) {
  data[chatId] = userData;
  save();
}

/**
 * Reset all users (admin/dev use only)
 */
export function resetAll() {
  data = {};
  save();
}
