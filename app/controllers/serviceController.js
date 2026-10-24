// Bảng giá dịch vụ - CHỈ chủ tiệm (routes/admin.js đặt requireOwner).
const mongoose = require('mongoose');
const Service = require('../models/Service');
const catalog = require('../utils/serviceCatalog');
const { UNITS, CATEGORIES } = require('../config/business');

const NOTICES = {
    ok: {
        created: 'Đã thêm dịch vụ mới.',
        updated: 'Đã lưu thay đổi. Giá mới chỉ áp dụng cho đơn lập sau đó, đơn cũ giữ nguyên giá.',
        shown: 'Đã hiện dịch vụ trên bảng giá.',
        hidden: 'Đã ẩn dịch vụ khỏi bảng giá (đơn cũ vẫn giữ nguyên).'
    },
    err: {
        notfound: 'Không tìm thấy dịch vụ.',
        last: 'Phải còn ít nhất một dịch vụ đang bán, không thể ẩn dịch vụ cuối cùng.',
        weight: 'Không ẩn được giá giặt theo ký. Muốn đổi giá, hãy sửa đơn giá ngay trên dòng đó.'
    }
};

class ServiceController {
    // [GET] /admin/services
    async index(req, res, next) {
        try {
            const services = (await catalog.listAll()).map((s) => ({
                ...s,
                isWeight: catalog.catOf(s) === CATEGORIES.weight,
                isGarment: catalog.catOf(s) === CATEGORIES.garment,
                lockedUnit: catalog.catOf(s) !== CATEGORIES.service, // giá ký luôn là kg, món đồ luôn tính theo món
                unitOptions: UNITS.map((u) => ({ value: u, selected: u === s.unit }))
            }));
            res.render('admin/services', {
                layout: 'admin',
                pageTitle: 'Bảng giá dịch vụ',
                services,
                unitOptions: UNITS.map((u) => ({ value: u })),
                success: NOTICES.ok[req.query.ok] || null,
                error: res.locals.formError || NOTICES.err[req.query.err] || null,
                old: res.locals.formOld || {}
            });
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/services - thêm dịch vụ
    async create(req, res, next) {
        try {
            const body = req.body || {};
            const isGarment = body.category === CATEGORIES.garment;
            // Món đồ luôn tính theo "món" (số nguyên)
            const input = catalog.validateServiceInput(isGarment ? { ...body, unit: 'món' } : body);
            if (input.error) {
                res.status(400);
                res.locals.formError = input.error;
                res.locals.formOld = { name: body.name, price: body.price, unit: body.unit };
                return new ServiceController().index(req, res, next);
            }
            const all = await catalog.listAll();
            const maxSort = all.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0);
            await Service.create({
                ...input.value,
                category: isGarment ? CATEGORIES.garment : CATEGORIES.service,
                byWeight: isGarment && body.byWeight === 'on',
                key: await catalog.uniqueKey(input.value.name),
                active: true,
                sortOrder: maxSort + 10,
                updatedBy: req.user._id
            });
            res.redirect('/admin/services?ok=created');
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/services/:id - sửa tên / đơn vị / đơn giá
    async update(req, res, next) {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/admin/services?err=notfound');
            const current = (await catalog.listAll()).find((x) => String(x._id) === String(req.params.id));
            if (!current) return res.redirect('/admin/services?err=notfound');
            const cat = catalog.catOf(current);
            const body = req.body || {};
            // Giá giặt theo ký luôn là "kg"; món đồ luôn là "món": bỏ qua đơn vị do trình duyệt gửi
            const forcedUnit = cat === CATEGORIES.weight ? 'kg' : (cat === CATEGORIES.garment ? 'món' : body.unit);
            const input = catalog.validateServiceInput({ ...body, unit: forcedUnit });
            if (input.error) {
                res.status(400);
                res.locals.formError = input.error;
                return new ServiceController().index(req, res, next);
            }
            const extra = cat === CATEGORIES.garment ? { byWeight: body.byWeight === 'on' } : {};
            const updated = await Service.findOneAndUpdate(
                { _id: req.params.id },
                { $set: { ...input.value, ...extra, updatedBy: req.user._id, updatedAt: new Date() } },
                { new: true }
            );
            if (!updated) return res.redirect('/admin/services?err=notfound');
            res.redirect('/admin/services?ok=updated');
        } catch (error) {
            next(error);
        }
    }

    // [POST] /admin/services/:id/toggle - ẩn / hiện (không xóa để lịch sử đơn vẫn đối chiếu được)
    async toggle(req, res, next) {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) return res.redirect('/admin/services?err=notfound');
            const all = await catalog.listAll();
            const svc = all.find((s) => String(s._id) === String(req.params.id));
            if (!svc) return res.redirect('/admin/services?err=notfound');

            if (catalog.catOf(svc) === CATEGORIES.weight) return res.redirect('/admin/services?err=weight');
            const willHide = svc.active !== false;
            if (willHide && all.filter((s) => s.active !== false && catalog.catOf(s) !== CATEGORIES.weight).length <= 1) return res.redirect('/admin/services?err=last');

            await Service.updateOne({ _id: svc._id }, { $set: { active: !willHide, updatedBy: req.user._id, updatedAt: new Date() } });
            res.redirect('/admin/services?ok=' + (willHide ? 'hidden' : 'shown'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ServiceController();
