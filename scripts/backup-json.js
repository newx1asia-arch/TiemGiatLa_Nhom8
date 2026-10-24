// Sao lưu TOÀN BỘ database ra 1 file nén, KHÔNG cần cài mongodump, dùng được cho mọi cách chạy
// (Atlas gói miễn phí M0 không có sao lưu tự động -> nên chạy lệnh này mỗi ngày).
//   npm run backup                      -> backups/tgl-YYYYMMDD-HHMM.json.gz (giữ 14 bản gần nhất)
//   npm run restore -- backups/tgl-....json.gz   (khôi phục, GHI ĐÈ dữ liệu hiện tại, có hỏi xác nhận)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;
const db = require('../app/config/db');

const DIR = path.join(__dirname, '..', 'backups');
const KEEP = Number(process.env.BACKUP_KEEP || 14);
const SKIP = new Set(['sessions', 'loginattempts']); // phiên đăng nhập / đếm đăng nhập sai: không cần lưu

const serialize = (data) => zlib.gzipSync(Buffer.from(EJSON.stringify(data, { relaxed: false })));
const deserialize = (buf) => EJSON.parse(zlib.gunzipSync(buf).toString('utf8'), { relaxed: false });

async function backup() {
    const cols = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.') && !SKIP.has(n));
    const data = { version: 1, createdAt: new Date().toISOString(), database: mongoose.connection.name, collections: {} };
    for (const name of cols) data.collections[name] = await mongoose.connection.db.collection(name).find({}).toArray();

    fs.mkdirSync(DIR, { recursive: true });
    const d = new Date(); const p = (n) => String(n).padStart(2, '0');
    const file = path.join(DIR, `tgl-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json.gz`);
    fs.writeFileSync(file, serialize(data));
    const counts = Object.entries(data.collections).map(([k, v]) => `${k}:${v.length}`).join(', ');
    console.log(`✅ Đã sao lưu: ${file} (${(fs.statSync(file).size / 1024).toFixed(1)} KB)\n   ${counts}`);

    const old = fs.readdirSync(DIR).filter((f) => /^tgl-.*\.json\.gz$/.test(f)).sort().reverse().slice(KEEP);
    old.forEach((f) => fs.unlinkSync(path.join(DIR, f)));
}

async function restore(file) {
    const data = deserialize(fs.readFileSync(file));
    const names = Object.keys(data.collections);
    console.log(`Bản sao lưu ngày ${data.createdAt}: ${names.map((n) => `${n}:${data.collections[n].length}`).join(', ')}`);
    const ans = await new Promise((r) => { const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout }); rl.question("Sẽ GHI ĐÈ các collection trên. Gõ 'dong y' để tiếp tục: ", (a) => { rl.close(); r(a.trim()); }); });
    if (ans !== 'dong y') { console.log('Đã hủy.'); return; }
    for (const name of names) {
        const col = mongoose.connection.db.collection(name);
        await col.deleteMany({});
        if (data.collections[name].length) await col.insertMany(data.collections[name]);
    }
    console.log('✅ Khôi phục xong. Khởi động lại app.');
}

module.exports = { serialize, deserialize };

if (require.main === module) {
    (async () => {
        const restoring = process.argv[2] === 'restore';
        const file = process.argv[3];
        if (restoring && !(file && fs.existsSync(file))) { console.log('Cách dùng: npm run restore -- backups/tgl-....json.gz'); process.exit(1); }
        if (!(await db.connect({ retries: 2, delayMs: 1500 }))) process.exit(1);
        try { restoring ? await restore(file) : await backup(); }
        catch (e) { console.error('❌', e.message || e); process.exitCode = 1; }
        await mongoose.connection.close();
    })();
}
