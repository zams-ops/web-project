require("dotenv").config();
const express = require("express");
const fs = require("fs");
const { Telegraf, Markup } = require("telegraf");

const app = express();
app.use(express.json());
app.use(express.static("public"));

// === CONFIG ===
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN belum di set di .env");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// === DB FILE ===
const DB_FILE = "./db.json";

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ products: [], payments: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// === SESSION DATA ===
const userSession = {};


// =====================
// === BOT COMMANDS ====
// =====================

bot.start((ctx) => {
    ctx.reply(
        "✨ *Web Controller Bot*\nKelola website kamu disini:",
        Markup.inlineKeyboard([
            [Markup.button.callback("➕ Tambah Produk", "add_product")],
            [Markup.button.callback("📦 Lihat Produk", "list_produk")],
            [Markup.button.callback("❌ Hapus Produk", "delete_product")],
            [Markup.button.callback("💳 Tambah Payment", "add_payment")],
            [Markup.button.callback("❌ Hapus Payment", "del_payment")]
        ])
    );
});


// =====================
// ==== ADD PRODUCT ====
// =====================

bot.action("add_product", (ctx) => {
    const uid = ctx.from.id;

    userSession[uid] = {
        step: "prod_name",
        data: {}
    };

    ctx.reply("Masukkan nama produk:");
});


// === TEXT HANDLER ===

bot.on("text", (ctx) => {
    const uid = ctx.from.id;
    const msg = ctx.message.text;

    if (!userSession[uid]) return;

    const S = userSession[uid];

    // === PRODUK ===
    if (S.step === "prod_name") {
        S.data.nama = msg;
        S.step = "prod_price";
        return ctx.reply("Masukkan harga produk:");
    }

    if (S.step === "prod_price") {
        if (isNaN(msg)) return ctx.reply("Harga harus angka!");
        S.data.harga = msg;
        S.step = "prod_desc";
        return ctx.reply("Masukkan deskripsi produk:");
    }

    if (S.step === "prod_desc") {
        S.data.deskripsi = msg;
        S.step = "prod_image";
        return ctx.reply("Masukkan URL gambar produk:");
    }

    if (S.step === "prod_image") {
        S.data.gambar = msg;

        const db = loadDB();
        db.products.push(S.data);
        saveDB(db);

        delete userSession[uid];
        return ctx.reply("✅ Produk berhasil ditambahkan!");
    }

    // === PAYMENT ===

    if (S.step === "payment_method") {
        S.data.method = msg;
        S.step = "payment_number";
        return ctx.reply(`Masukkan nomor/ID pembayaran untuk *${msg}*:`);
    }

    if (S.step === "payment_number") {
        S.data.number = msg;

        const db = loadDB();
        db.payments.push(S.data);
        saveDB(db);

        delete userSession[uid];
        return ctx.reply(`💳 Payment *${S.data.method}* berhasil ditambahkan!`);
    }
});


// ===================
// === LIST PRODUK ===
// ===================

bot.action("list_produk", (ctx) => {
    const db = loadDB();

    if (db.products.length === 0)
        return ctx.reply("📭 Produk masih kosong.");

    let text = "📦 *Daftar Produk:*\n\n";

    db.products.forEach((p, i) => {
        text += `#${i + 1}\n📌 *${p.nama}*\n💰 ${p.harga}\n📝 ${p.deskripsi}\n🖼 ${p.gambar}\n\n`;
    });

    ctx.replyWithMarkdown(text);
});


// ===========================
// === DELETE PRODUK ========
// ===========================

bot.action("delete_product", (ctx) => {
    const db = loadDB();

    if (db.products.length === 0)
        return ctx.reply("Tidak ada produk.");

    const buttons = db.products.map((p, i) => [
        Markup.button.callback(`${p.nama} (ID ${i})`, `delprod_${i}`)
    ]);

    ctx.reply("Pilih produk yang akan dihapus:", Markup.inlineKeyboard(buttons));
});

bot.action(/delprod_(\d+)/, (ctx) => {
    const id = Number(ctx.match[1]);
    const db = loadDB();
    const removed = db.products.splice(id, 1);
    saveDB(db);

    ctx.reply(`🗑 Produk *${removed[0].nama}* berhasil dihapus.`);
});


// =====================
// === ADD PAYMENT =====
// =====================

bot.action("add_payment", (ctx) => {
    const uid = ctx.from.id;

    userSession[uid] = {
        step: "payment_method",
        data: {}
    };

    ctx.reply("Masukkan metode payment (Dana, OVO, BRI, dll):");
});


// =====================
// === DELETE PAYMENT ==
// =====================

bot.action("del_payment", (ctx) => {
    const db = loadDB();

    if (db.payments.length === 0)
        return ctx.reply("Belum ada payment.");

    const buttons = db.payments.map((p, i) => [
        Markup.button.callback(`${p.method} (${p.number})`, `delpay_${i}`)
    ]);

    ctx.reply("Pilih payment yang ingin dihapus:", Markup.inlineKeyboard(buttons));
});

bot.action(/delpay_(\d+)/, (ctx) => {
    const id = Number(ctx.match[1]);
    const db = loadDB();
    const removed = db.payments.splice(id, 1);
    saveDB(db);

    ctx.reply(`❌ Payment *${removed[0].method}* berhasil dihapus.`);
});


// =====================
// ===== API LIST ======
// =====================

app.get("/db.json", (req, res) => {
    res.json(loadDB());
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});


// =====================
// == START SERVICES ====
// =====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🌐 Server berjalan di port ${PORT}`));
bot.launch().then(() => console.log("🤖 Bot Telegram aktif!"));
