const nodemailer = require("nodemailer");
const Spinnies = require("spinnies");
const chalk = require("chalk");

// Inisialisasi Spinner untuk Terminal
const spinnies = new Spinnies();

// Konfigurasi SMTP (Tetap sesuai milikmu)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "zenu.sangalas@gmail.com",
        pass: "pbzn tqxr aggb ksao" 
    }
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Global variable untuk simpan ID pesan Telegram
if (!global.lastFixReport) global.lastFixReport = {};

module.exports = {
    // Menu Awal Fix WA
    execute: async (bot, chatId) => {
        // Hapus laporan lama di Telegram jika ada
        if (global.lastFixReport[chatId]) {
            try {
                await bot.deleteMessage(chatId, global.lastFixReport[chatId]);
            } catch (e) {}
        }

        const teks = 
            `*─── [ WHATSAPP FIX SYSTEM ] ───*\n\n` +
            `Silahkan kirim nomor WhatsApp kamu\ndengan format: \`628xxxxxxxx\`\n\n` +
            `*Status Server:* 🟢 \`Active\`\n` +
            `*Antrean:* \`Normal\`\n\n` +
            `_Bot akan memproses laporan secara otomatis._`;
        
        await bot.sendMessage(chatId, teks, { parse_mode: "Markdown" });
        global.userFixState[chatId] = "waiting_fix_number";
    },

    // Proses Pengiriman Otomatis
    processFix: async (bot, chatId, nomor) => {
        const formattedNum = nomor.startsWith('62') ? '+' + nomor : '+' + nomor;
        const spinnerId = `fix-${chatId}`;

        // 1. UI TERMINAL (Mewah)
        console.log(chalk.cyan.bold(`\n[!] Incoming FixWA Request: ${formattedNum}`));
        spinnies.add(spinnerId, { text: `Menyiapkan sistem recovery untuk ${formattedNum}...` });

        // 2. UI TELEGRAM (Loading)
        const loadingMsg = await bot.sendMessage(chatId, `⚙️ *[ 1/3 ]* _Analisis Device Redmi Note 11..._`, { parse_mode: "Markdown" });
        await delay(1500);

        // Update Terminal & Telegram
        spinnies.update(spinnerId, { text: `Mengirim paket request ke SMTP WhatsApp...` });
        await bot.editMessageText(`📨 *[ 2/3 ]* _Menghubungkan ke Android Support Server..._`, { 
            chat_id: chatId, 
            message_id: loadingMsg.message_id, 
            parse_mode: "Markdown" 
        });
        await delay(1500);

        try {
            const mailBody = 
                `Dear WhatsApp Support Team,\n\n` +
                `I am reporting a technical issue regarding my account. I cannot log in, and the app displays: "Login unavailable at this time."\n\n` +
                `Account Details:\n` +
                `- Phone Number: ${formattedNum}\n` +
                `- Device: Xiaomi Redmi Note 11\n` +
                `- OS: Android 12 (MIUI 13)\n\n` +
                `Regards.`;

            // Kirim Email
            await transporter.sendMail({
                from: "zenu.sangalas@gmail.com",
                to: "Android@support.whatsapp.com",
                subject: `Technical Issue: Login Unavailable - ${formattedNum}`,
                text: mailBody
            });

            // Update Terminal Sukses
            spinnies.succeed(spinnerId, { text: chalk.greenBright(`Success sent report for ${formattedNum}`) });

            const waktu = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

            // 3. TAMPILAN AKHIR TELEGRAM (Mewah)
            await bot.editMessageText(
                `*─── [ PROCESS COMPLETED ] ───*\n\n` +
                `✅ *Nomor:* \`${formattedNum}\`\n` +
                `🛠 *Device:* \`Xiaomi Redmi Note 11\`\n` +
                `📡 *Server:* \`Android Support (Sent)\`\n` +
                `⏰ *Waktu:* \`${waktu}\`\n\n` +
                `*Note:* _Laporan ini akan dihapus otomatis dalam 3 menit atau saat ada request baru._`,
                { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "Markdown" }
            );

            global.lastFixReport[chatId] = loadingMsg.message_id;

            // Auto Delete 3 Menit
            setTimeout(async () => {
                try {
                    if (global.lastFixReport[chatId] === loadingMsg.message_id) {
                        await bot.deleteMessage(chatId, loadingMsg.message_id);
                        delete global.lastFixReport[chatId];
                        console.log(chalk.yellow(`[!] Pesan laporan ${formattedNum} telah dihapus otomatis.`));
                    }
                } catch (err) {}
            }, 180000);

        } catch (err) {
            spinnies.fail(spinnerId, { text: chalk.red(`Gagal memproses: ${err.message}`) });
            await bot.editMessageText(`❌ *Gagal mengirim laporan.*\nTerjadi gangguan pada SMTP Server.`, { 
                chat_id: chatId, 
                message_id: loadingMsg.message_id, 
                parse_mode: "Markdown" 
            });
        }
        
        delete global.userFixState[chatId];
    }
};
