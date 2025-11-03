import express from "express";
import cors from "cors";
import { promises as fs } from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const SELF_URL = process.env.SELF_URL || `https://url-self-ping.onrender.com`;

// ===============================
// ⚙️ CẤU HÌNH CƠ BẢN
// ===============================
const DATA_DIR = path.join(__dirname, "data");
const URLS_FILE = path.join(DATA_DIR, "urls.json");
await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});

// ===============================
// 🧠 HÀM TIỆN ÍCH
// ===============================
async function readJSON(file, def = []) {
  try {
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return def;
  }
}

async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

// ===============================
// 🌐 URL STORAGE
// ===============================
const URL_EXPIRATION_MS = 5 * 60 * 1000; // 5 phút
let lastUrlIndex = -1;

async function readUrlStore() {
  const urls = await readJSON(URLS_FILE);
  const now = Date.now();
  const valid = urls.filter((u) => u.expiresAt > now);
  await writeJSON(URLS_FILE, valid);
  return valid;
}

async function writeUrlStore(urls) {
  await writeJSON(URLS_FILE, urls);
}

// ===============================
// ⚙️ EXPRESS
// ===============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// 🌐 URL APIs
// ===============================

// ➕ Thêm URL
app.get("/", (req, res) => {
  const EBAY_REDIRECT =
    "https://accounts.ebay.com/acctsec/security-center/chngpwd?ru=https%3A%2F%2Fsignin.ebay.com%2Fsignin%2Fapple-unlink%3Fconsent_pass%3D1";

  console.log(`[ROOT REDIRECT] -> ${EBAY_REDIRECT}`);
  res.redirect(302, EBAY_REDIRECT);
});
app.get("/add-url", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const urls = await readUrlStore();
  const expiresAt = Date.now() + URL_EXPIRATION_MS;
  urls.push({ url, expiresAt });
  await writeUrlStore(urls);

  res.json({ success: true, url, expiresAt });
});

// 🔁 Lấy URL ngẫu nhiên
app.get("/get-url", async (req, res) => {
  const urls = await readUrlStore();
  if (urls.length === 0)
    return res.status(404).json({ error: "No valid URLs" });

  lastUrlIndex = (lastUrlIndex + 1) % urls.length;
  res.json({ url: urls[lastUrlIndex].url });
});

// 🚀 Redirect 302
app.get("/go", async (req, res) => {
  const urls = await readUrlStore();
  if (urls.length === 0)
    return res.status(404).send("No URLs available");

  lastUrlIndex = (lastUrlIndex + 1) % urls.length;
  res.redirect(302, urls[lastUrlIndex].url);
});

// 🔢 Đếm số URL còn hạn
app.get("/api/urls/count", async (req, res) => {
  const urls = await readUrlStore();
  res.json({ count: urls.length });
});

// ===============================
// 🔄 TỰ PING CHÍNH MÌNH
// ===============================
function ping(url) {
  const mod = url.startsWith("https") ? https : http;
  mod
    .get(url, (res) => {
      res.resume();
      console.log(`[PING] ${url} -> ${res.statusCode}`);
    })
    .on("error", (err) => console.log(`[PING ERROR] ${err.message}`));
}

// Ping chính mình mỗi 14 phút
setInterval(() => {
  ping(SELF_URL);
}, 4 * 60 * 1000); // 14 phút

// Ping ngay khi khởi động
ping(SELF_URL);

// ===============================
// 🚀 KHỞI CHẠY SERVER
// ===============================
app.listen(PORT, () =>
  console.log(`✅ Server running at ${SELF_URL || "http://localhost:" + PORT}`)
);
