const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => res.send('Bot is Online!'));

app.listen(port, () => {
  console.log(`Server jalan di http://localhost:${port}`);
});

// ... kode bot Node.js kamu di bawah sini ...

const {
    default: makeWASocket,
    useMultiFileAuthState,
    jidNormalizedUser,
    delay
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const readline = require("readline");

// =====================================
// KONFIGURASI BOT
// =====================================
const TELEGRAM_TOKEN = "8751003558:AAHG7C5VfQz_X5YPlZiZtG4VUtKXPjJzs64";
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const userState = {}; 
global.userFixState = {};

// Fungsi Reset State agar tidak tabrakan
function resetAllStates(chatId) {
    delete userState[chatId];
    delete global.userFixState[chatId];
}

// Auto-Load FixWA Command
let fixwa;
const fixwaPath = path.join(__dirname, 'commands', 'fixwa.js');
if (fs.existsSync(fixwaPath)) {
    fixwa = require(fixwaPath);
    console.log("✅ Module FixWA Loaded!");
}

const getRegionInfo = (number) => {
    if (number.startsWith('62')) return { name: "Indonesia", flag: "🇮🇩" };
    if (number.startsWith('77')) return { name: "Kazakhstan", flag: "🇰🇿" };
    if (number.startsWith('7')) return { name: "Russia", flag: "🇷🇺" };
    if (number.startsWith('237')) return { name: "Cameroon", flag: "🇨🇲" };
    if (number.startsWith('1')) return { name: "USA", flag: "🇺🇸" };
    return { name: "International", flag: "🌎" };
};

// Fungsi Format Nomor (Spasi setelah kode negara)
const formatSpacedNumber = (num) => {
    if (num.startsWith('62')) return `+62 ${num.slice(2)}`;
    if (num.startsWith('7')) return `+7 ${num.slice(1)}`;
    if (num.startsWith('1')) return `+1 ${num.slice(1)}`;
    if (num.startsWith('237')) return `+237 ${num.slice(3)}`;
    return `+${num}`;
};

// =====================================
// KONEKSI WHATSAPP
// =====================================
async function startZenu() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        browser: ["Zenu Scanner", "Chrome", "1.0.0"]
    });

    if (!sock.authState.creds.registered) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const phoneNumber = await new Promise(resolve => rl.question("Nomor WA Bot (62xxx): ", resolve));
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`\n👉 KODE PAIRING: ${code}\n`);
        rl.close();
    }

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (up) => {
        if (up.connection === "open") console.log("✅ WhatsApp Connected!");
        if (up.connection === "close") startZenu();
    });

    // =====================================
    // LOGIKA PESAN TELEGRAM
    // =====================================
    bot.on("message", async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        if (!text) return;

        // Handler Tombol Menu
        if (text === "/start") {
            resetAllStates(chatId);
            return bot.sendMessage(chatId, `✨ *ZENU MULTI-CHECKER V3* ✨\n───────────────────────\nSystem: \`Ready All Region\` 🌎\n───────────────────────`, {
                reply_markup: {
                    keyboard: [["🔍 CEK BIO", "📨 FIX WA"], ["📊 STATUS"]],
                    resize_keyboard: true
                },
                parse_mode: "Markdown"
            });
        }

        if (text === "📨 FIX WA") {
            resetAllStates(chatId);
            if (fixwa) return fixwa.execute(bot, chatId);
            return bot.sendMessage(chatId, "⚠️ File `commands/fixwa.js` tidak ditemukan.");
        }

        if (text === "🔍 CEK BIO") {
            resetAllStates(chatId);
            userState[chatId] = "waiting_numbers";
            return bot.sendMessage(chatId, "📝 *PASTE LIST NOMOR ANDA*", { parse_mode: "Markdown" });
        }

        // --- PROSES FIX WA ---
        if (global.userFixState[chatId] === "waiting_fix_number" && !text.startsWith("/")) {
            if (["🔍 CEK BIO", "📨 FIX WA", "📊 STATUS"].includes(text)) return;
            return fixwa.processFix(bot, chatId, text.replace(/\D/g, ''));
        }

        // --- PROSES SCANNING BIO ---
        if (userState[chatId] === "waiting_numbers" && !text.startsWith("/")) {
            if (["🔍 CEK BIO", "📨 FIX WA", "📊 STATUS"].includes(text)) return;
            
            const raw = text.split(/[\s\n,]+/).filter(v => v.length > 5);
            const numbers = raw.map(v => v.replace(/\D/g, '')).slice(0, 500);
            
            if (numbers.length === 0) return bot.sendMessage(chatId, "❌ Tidak ada nomor valid.");

            const loadingMsg = await bot.sendMessage(chatId, `🚀 *Mulai Scanning...*`, { parse_mode: "Markdown" });
            let db = { verified: [], lowMeta: [], normal: [], invalid: [] };

            for (let i = 0; i < numbers.length; i++) {
                let num = numbers[i];
                if (num.startsWith('08')) num = '62' + num.slice(1);
                const region = getRegionInfo(num);
                const jid = jidNormalizedUser(num + "@s.whatsapp.net");

                // UI Progress favortimu
                const progress = Math.floor(((i + 1) / numbers.length) * 100);
                const bar = "■".repeat(Math.floor(progress / 10)) + "□".repeat(10 - Math.floor(progress / 10));

                await bot.editMessageText(
                    `⚡ *ZENU AGGRESSIVE SCAN* ⚡\n\n` +
                    `Progress: [${bar}] ${progress}%\n` +
                    `Status: \`${i + 1}/${numbers.length}\` Nomor\n` +
                    `Target: \`${formatSpacedNumber(num)}\` ${region.flag}\n\n` +
                    `✅ Verified: ${db.verified.length} | 💼 LowMeta: ${db.lowMeta.length}\n` +
                    `👤 Regular: ${db.normal.length} | ❌ Dead: ${db.invalid.length}`,
                    { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "Markdown" }
                ).catch(() => null);

                try {
                    const [exists] = await sock.onWhatsApp(jid);
                    if (exists) {
                        await sock.presenceSubscribe(jid);
                        await delay(800);
                        let status = await sock.fetchStatus(jid).catch(() => null);
                        const business = await sock.getBusinessProfile(jid).catch(() => null);

                        if (!status || status.status === 'Disponible') {
                            await delay(1000);
                            status = await sock.fetchStatus(jid).catch(() => null);
                        }

                        const isVerified = business?.verified_name || business?.isVerified || false;
                        const item = { num, region, bio: status?.status || "Bio Private", setAt: status?.setAt ? new Date(status.setAt).toLocaleString("id-ID") : "Hidden", biz: business };

                        if (isVerified) db.verified.push(item);
                        else if (business) db.lowMeta.push(item);
                        else db.normal.push(item);
                    } else {
                        db.invalid.push(num);
                    }
                } catch (e) { db.invalid.push(num); }
                await delay(Math.floor(Math.random() * 1500) + 1500);
            }

            // --- GENERATE TXT (SORTED & SPACED) ---
            let report = `ZENU RESULT - ${new Date().toLocaleString("id-ID")}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            const buildSection = (list, title) => {
                if (list.length === 0) return "";
                let res = `[ ${title} (${list.length}) ]\n`;
                list.forEach((item, idx) => {
                    res += `${idx + 1}. Nomor: ${formatSpacedNumber(item.num)} (${item.region.flag})\n   ├─ Bio: ${item.bio}\n   ├─ Sejak: ${item.setAt}\n${item.biz ? `   └─ Biz: ${item.biz.name || 'Business Account'}\n` : ''}\n`;
                });
                return res + `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            };

            report += buildSection(db.verified, "VERIFIED META");
            report += buildSection(db.lowMeta, "BUSINESS LOW META");
            report += buildSection(db.normal, "REGULAR PERSONAL");
            
            if (db.invalid.length > 0) {
                report += `[ TIDAK TERDAFTAR (${db.invalid.length}) ]\n`;
                report += db.invalid.map(n => formatSpacedNumber(n)).join(", ") + "\n";
            }

            fs.writeFileSync("cekbio.txt", report);
            await bot.sendDocument(chatId, "cekbio.txt", { caption: "✅ *Scan Selesai!* Laporan sudah dirapikan." });
            resetAllStates(chatId);
        }
    });
}
startZenu();