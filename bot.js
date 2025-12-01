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
    console.error("❌ BOT_TOKEN belum di set di Railway Variables!");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// === FILE DATABASE ===
const PRODUCT_FILE = "./products.json";
const PAYMENT_FILE = "./payments.json";

function loadProducts() {
    if (!fs.existsSync(PRODUCT_FILE)) fs.writeFileSync(PRODUCT_FILE, "[]");
    return JSON.parse(fs.readFileSync(PRODUCT_FILE));
}

function saveProducts(data) {
    fs.writeFileSync(PRODUCT_FILE, JSON.stringify(data, null, 2));
}

function loadPayments() {
    if (!fs.existsSync(PAYMENT_FILE)) fs.writeFileSync(PAYMENT_FILE, "[]");
    return JSON.parse(fs.readFileSync(PAYMENT_FILE));
}

function savePayments(data) {
    fs.writeFileSync(PAYMENT_FILE, JSON.stringify(data, null, 2));
}

// === SESSION ===
const userSession = {};


// =====================
// === START COMMAND ====
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
    userSession[uid] = { step: "prod_name", data: {} };
    ctx.reply("Masukkan nama produk:");
});


// === TEXT INPUT HANDLER ===
bot.on("text", (ctx) => {
    const uid = ctx.from.id;
    const msg = ctx.message.text;
    if (!userSession[uid]) return;

    const S = userSession[uid];

    // --- Produk ---
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

        const list = loadProducts();
        list.push(S.data);
        saveProducts(list);

        delete userSession[uid];
        return ctx.reply("✅ Produk berhasil ditambahkan!");
    }

    // --- Payment ---
    if (S.step === "payment_method") {
        S.data.method = msg;
        S.step = "payment_number";
        return ctx.reply(`Masukkan nomor/ID untuk *${msg}*:`);
    }

    if (S.step === "payment_number") {
        S.data.number = msg;

        const list = loadPayments();
        list.push(S.data);
        savePayments(list);

        delete userSession[uid];
        return ctx.reply(`💳 Payment *${S.data.method}* berhasil ditambahkan!`);
    }
});


// ======================
// ==== LIST PRODUK =====
// ======================

bot.action("list_produk", (ctx) => {
    const list = loadProducts();

    if (list.length === 0) return ctx.reply("📭 Produk masih kosong.");

    let text = "📦 *Daftar Produk:*\n\n";

    list.forEach((p, i) => {
        text += `#${i + 1}\n📌 *${p.nama}*\n💰 ${p.harga}\n📝 ${p.deskripsi}\n🖼 ${p.gambar}\n\n`;
    });

    ctx.replyWithMarkdown(text);
});


// ===========================
// ===== DELETE PRODUK =======
// ===========================

bot.action("delete_product", (ctx) => {
    const list = loadProducts();

    if (list.length === 0) return ctx.reply("Tidak ada produk.");

    const buttons = list.map((p, i) => [
        Markup.button.callback(`${p.nama} (ID ${i})`, `delprod_${i}`)
    ]);

    ctx.reply("Pilih produk yang akan dihapus:", Markup.inlineKeyboard(buttons));
});

bot.action(/delprod_(\d+)/, (ctx) => {
    const id = Number(ctx.match[1]);
    const list = loadProducts();

    const removed = list.splice(id, 1);
    saveProducts(list);

    ctx.reply(`🗑 Produk *${removed[0].nama}* berhasil dihapus.`);
});


// =======================
// ==== DELETE PAYMENT ====
// =======================

bot.action("del_payment", (ctx) => {
    const list = loadPayments();

    if (list.length === 0) return ctx.reply("Belum ada payment.");

    const buttons = list.map((p, i) => [
        Markup.button.callback(`${p.method} (${p.number})`, `delpay_${i}`)
    ]);

    ctx.reply("Pilih payment yang ingin dihapus:", Markup.inlineKeyboard(buttons));
});

bot.action(/delpay_(\d+)/, (ctx) => {
    const id = Number(ctx.match[1]);
    const list = loadPayments();

    const removed = list.splice(id, 1);
    savePayments(list);

    ctx.reply(`❌ Payment *${removed[0].method}* berhasil dihapus.`);
});


// ===================
// ====== API ========
// ===================

app.get("/products", (req, res) => res.json(loadProducts()));
app.get("/payments", (req, res) => res.json(loadPayments()));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});


// =====================
// ==== START SERVER ====
// =====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server berjalan di port ${PORT}`));
bot.launch().then(() => console.log("🤖 Bot Telegram aktif!"));
