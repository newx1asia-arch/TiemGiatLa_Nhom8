// Quản lý khách hàng tại quầy (nhân viên + chủ tiệm): tìm khách, thêm khách vãng lai, cấp mật khẩu.
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const { generateCode } = require('../utils/generateCode');
const resetTokens = require('../utils/resetTokens');

const PHONE_REGEX = /^0\d{9}$/;
const MAX_PASSWORD_LENGTH = 72;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const NOTICES = {
    ok: {
        created: 'Đã tạo hồ sơ khách hàng.',
        activated: 'Đã cấp mật khẩu. Khách có thể đăng nhập bằng số điện thoại và mật khẩu này (nên đổi mật khẩu ở trang Hồ sơ).'
    },
    err: {
        notfound: 'Không tìm thấy khách hàng, hoặc khách này đã có mật khẩu.'
    }
};

async function render(req, res, { error = null, success = null, old = {}, status = 200, resetLink = null } = {}) {
    const q = str(req.query.q).slice(0, 60);
    const filter = {};
    if (q) {
        const rx = { $regex: escapeRegex(q), $options: 'i' };
        filter.$or = [{ name: rx }, { phone: rx }, { code: rx }];
    }
    const rows = await Customer.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    const viewerIsOwner = req.user && req.user.role === 'owner';
    const customers = rows.map((c) => ({
        _id: c._id, code: c.code, name: c.name, phone: c.phone, address: c.address,
        points: c.points || 0, role: c.role || 'customer',
        noAccount: !c.password, // khách vãng lai chưa có tài khoản đăng nhập
        // Nhân viên chỉ đặt lại được mật khẩu của khách; chủ tiệm đặt lại được cả nhân viên (không đặt lại của chủ tiệm khác)
        canReset: !!c.password && (c.role === 'customer' || (viewerIsOwner && c.role === 'staff'))
    }));
    res.status(status).render('admin/customers', {
        layout: 'admin',
        pageTitle: 'Khách hàng',
        customers, q, old, error, success, resetLink,
        backTo: '/admin/customers' + (q ? '?q=' + encodeURIComponent(q) : '')
    });
}

class CustomerAdminController {
    // [GET] /admin/customers
    async index(req, res, next) {
        try {
            await render(req, res, { success: NOTICES.ok[req.query.ok] || null, error: NOTICES.err[req.query.err] || null });
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/customers - tạo khách vãng lai (tên + SĐT, chưa cần mật khẩu)
    async create(req, res, next) {
        try {
            const name = str(req.body.name);
            const phone = str(req.body.phone);
            const address = str(req.body.address).slice(0, 500);
            const old = { name, phone, address };
            if (!name || name.length > 255) return render(req, res, { error: 'Vui lòng nhập họ tên khách (tối đa 255 ký tự).', old, status: 400 });
            if (!PHONE_REGEX.test(phone)) return render(req, res, { error: 'Số điện thoại không hợp lệ (VD: 0912345678).', old, status: 400 });

            const dup = await Customer.findOne({ phone });
            if (dup) return render(req, res, { error: `Số điện thoại này đã có hồ sơ: ${dup.name} (${dup.code}).`, old, status: 400 });

            try {
                await Customer.create({
                    code: await generateCode('customer', 'KH'),
                    name, phone, address, password: null, walkIn: true, createdBy: req.user._id
                });
            } catch (e) {
                if (e && e.code === 11000) return render(req, res, { error: 'Số điện thoại này vừa được tạo hồ sơ.', old, status: 400 });
                throw e;
            }
            res.redirect('/admin/customers?ok=created&q=' + encodeURIComponent(phone));
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/customers/:id/activate - cấp mật khẩu cho khách vãng lai (sau khi nhân viên đã xác minh khách tại quầy)
    async activate(req, res, next) {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/admin/customers?err=notfound');
            const password = typeof req.body.password === 'string' ? req.body.password : '';
            if (password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
                return render(req, res, { error: `Mật khẩu phải từ 8 đến ${MAX_PASSWORD_LENGTH} ký tự.`, status: 400 });
            }
            const hashed = await bcrypt.hash(password, 10);
            // Chỉ cấp được cho hồ sơ CHƯA có mật khẩu: không thể ghi đè mật khẩu của tài khoản đang dùng
            const updated = await Customer.findOneAndUpdate(
                { _id: req.params.id, password: null },
                { $set: { password: hashed, walkIn: false } },
                { new: true }
            );
            if (!updated) return res.redirect('/admin/customers?err=notfound');
            res.redirect('/admin/customers?ok=activated&q=' + encodeURIComponent(updated.phone));
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/customers/:id/reset-link - tạo link đặt lại mật khẩu (dùng 1 lần, 30 phút) cho khách QUÊN MẬT KHẨU.
    // Nhân viên chỉ làm sau khi đã xác minh đúng khách tại quầy, rồi đưa link cho khách tự đặt mật khẩu mới
    // (nhân viên không biết mật khẩu của khách).
    async resetLink(req, res, next) {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/admin/customers?err=notfound');
            const target = await Customer.findById(req.params.id);
            if (!target || !target.password) return res.redirect('/admin/customers?err=notfound');
            const allowed = target.role === 'customer' || (req.user.role === 'owner' && target.role === 'staff');
            if (!allowed) return render(req, res, { error: 'Bạn không có quyền đặt lại mật khẩu cho tài khoản này.', status: 403 });

            const raw = await resetTokens.createToken(target._id);
            const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
            await render(req, res, {
                success: `Đã tạo link đặt lại mật khẩu cho ${target.name} (${target.phone}). Link dùng 1 lần, hết hạn sau 30 phút - hãy đưa cho khách ngay.`,
                resetLink: `${base}/auth/reset/${raw}`
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CustomerAdminController();
