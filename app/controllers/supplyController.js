const Supply = require('../models/Supply');

// Danh sách vật tư mặc định theo mục 2.4
const DEFAULT_SUPPLIES = [
    { name: 'Xà phòng',    unit: 'kg',  quantity: 20,  minStock: 5 },
    { name: 'Nước xả',     unit: 'lít', quantity: 30,  minStock: 10 },
    { name: 'Bao bì',      unit: 'cái', quantity: 200, minStock: 50 },
    { name: 'Vật tư khác', unit: 'cái', quantity: 10,  minStock: 3 }
];

class SupplyController {
    // GET /supplies
    async index(req, res) {
        try {
            // Nếu kho còn trống thì tạo sẵn các vật tư mặc định
            if ((await Supply.countDocuments()) === 0) {
                await Supply.insertMany(DEFAULT_SUPPLIES);
            }

            const supplies = await Supply.find().sort({ name: 1 }).lean();
            supplies.forEach(s => { s.isLow = s.quantity <= s.minStock; });
            const lowCount = supplies.filter(s => s.isLow).length;
            res.render('supplies/index', { supplies, lowCount });
        } catch (err) {
            console.error(err);
            res.status(500).send('Lỗi khi tải kho vật tư');
        }
    }

    // GET /supplies/create
    createForm(req, res) {
        res.render('supplies/form', { supply: null });
    }

    // POST /supplies
    async store(req, res) {
        await Supply.create(req.body);
        res.redirect('/supplies');
    }

    // GET /supplies/:id/edit
    async editForm(req, res) {
        const supply = await Supply.findById(req.params.id).lean();
        if (!supply) return res.redirect('/supplies');
        res.render('supplies/form', { supply });
    }

    // PUT /supplies/:id
    async update(req, res) {
        await Supply.findByIdAndUpdate(req.params.id, req.body);
        res.redirect('/supplies');
    }

    // POST /supplies/:id/adjust  (nhập / xuất kho)
    async adjust(req, res) {
        const amount = Number(req.body.amount);
        const supply = await Supply.findById(req.params.id);
        if (!supply || !(amount > 0)) return res.redirect('/supplies');

        if (req.body.type === 'out') {
            if (supply.quantity < amount) {
                return res.status(400).send('Số lượng xuất vượt quá tồn kho!');
            }
            supply.quantity -= amount;
        } else {
            supply.quantity += amount;
        }
        await supply.save();
        res.redirect('/supplies');
    }

    // DELETE /supplies/:id
    async destroy(req, res) {
        await Supply.findByIdAndDelete(req.params.id);
        res.redirect('/supplies');
    }
}

module.exports = new SupplyController();