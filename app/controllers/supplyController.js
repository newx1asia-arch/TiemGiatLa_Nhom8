const mongoose = require('mongoose');
const Supply = require('../models/Supply');

// Danh sách vật tư mặc định theo mục 2.4
const DEFAULT_SUPPLIES = [
    { name: 'Xà phòng',    unit: 'kg',  quantity: 20,  minStock: 5 },
    { name: 'Nước xả',     unit: 'lít', quantity: 30,  minStock: 10 },
    { name: 'Bao bì',      unit: 'cái', quantity: 200, minStock: 50 },
    { name: 'Vật tư khác', unit: 'cái', quantity: 10,  minStock: 3 }
];

const MAX_QTY = 1000000;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, fallback) => {
    if (v === undefined || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= MAX_QTY ? n : null; // null = không hợp lệ
};

// Chỉ lấy đúng các trường cho phép từ form (chống mass assignment) và kiểm tra giá trị
function pickSupply(body) {
    const data = {
        name: str(body.name, 100),
        unit: str(body.unit, 20) || 'cái',
        quantity: num(body.quantity, 0),
        minStock: num(body.minStock, 5),
        price: num(body.price, 0),
        note: str(body.note, 500)
    };
    if (!data.name) return { error: 'Vui lòng nhập tên vật tư.' };
    if ([data.quantity, data.minStock, data.price].includes(null)) {
        return { error: 'Số lượng, ngưỡng cảnh báo và giá phải là số từ 0 đến 1.000.000.' };
    }
    return { data };
}

const badId = (req) => !mongoose.isValidObjectId(req.params.id);

class SupplyController {
    // GET /supplies
    async index(req, res) {
        try {
            if ((await Supply.countDocuments()) === 0) {
                await Supply.insertMany(DEFAULT_SUPPLIES);
            }
            const supplies = await Supply.find().sort({ name: 1 }).lean();
            supplies.forEach(s => { s.isLow = s.quantity <= s.minStock; });
            const lowCount = supplies.filter(s => s.isLow).length;
            res.render('supplies/index', { layout: 'admin', pageTitle: 'Kho vật tư', supplies, lowCount });
        } catch (err) {
            console.error(err);
            res.status(500).send('Lỗi khi tải kho vật tư');
        }
    }

    // GET /supplies/create
    createForm(req, res) {
        res.render('supplies/form', { layout: 'admin', pageTitle: 'Thêm vật tư', supply: null });
    }

    // POST /supplies
    async store(req, res, next) {
        try {
            const { data, error } = pickSupply(req.body);
            if (error) {
                return res.status(400).render('supplies/form', {
                    layout: 'admin', pageTitle: 'Thêm vật tư', supply: req.body, error
                });
            }
            await Supply.create(data);
            res.redirect('/supplies');
        } catch (err) {
            next(err);
        }
    }

    // GET /supplies/:id/edit
    async editForm(req, res, next) {
        try {
            if (badId(req)) return res.redirect('/supplies');
            const supply = await Supply.findById(req.params.id).lean();
            if (!supply) return res.redirect('/supplies');
            res.render('supplies/form', { layout: 'admin', pageTitle: 'Sửa vật tư', supply });
        } catch (err) {
            next(err);
        }
    }

    // PUT /supplies/:id
    async update(req, res, next) {
        try {
            if (badId(req)) return res.redirect('/supplies');
            const { data, error } = pickSupply(req.body);
            if (error) {
                return res.status(400).render('supplies/form', {
                    layout: 'admin', pageTitle: 'Sửa vật tư', supply: { ...req.body, _id: req.params.id }, error
                });
            }
            await Supply.findByIdAndUpdate(req.params.id, { $set: data }, { runValidators: true });
            res.redirect('/supplies');
        } catch (err) {
            next(err);
        }
    }

    // POST /supplies/:id/adjust  (nhập / xuất kho) - dùng lệnh nguyên tử, không đọc-rồi-ghi
    async adjust(req, res, next) {
        try {
            if (badId(req)) return res.redirect('/supplies');
            const amount = Number(req.body.amount);
            if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_QTY) return res.redirect('/supplies');

            if (req.body.type === 'out') {
                const updated = await Supply.findOneAndUpdate(
                    { _id: req.params.id, quantity: { $gte: amount } }, // chỉ trừ khi đủ tồn kho
                    { $inc: { quantity: -amount } },
                    { new: true }
                );
                if (!updated) return res.status(400).send('Số lượng xuất vượt quá tồn kho!');
            } else {
                await Supply.updateOne({ _id: req.params.id }, { $inc: { quantity: amount } });
            }
            res.redirect('/supplies');
        } catch (err) {
            next(err);
        }
    }

    // DELETE /supplies/:id
    async destroy(req, res, next) {
        try {
            if (badId(req)) return res.redirect('/supplies');
            await Supply.findByIdAndDelete(req.params.id);
            res.redirect('/supplies');
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new SupplyController();
