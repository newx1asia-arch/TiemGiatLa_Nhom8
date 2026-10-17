// Bảng giá dịch vụ - CHỈ chủ tiệm (routes/admin.js đặt requireOwner).
const mongoose = require('mongoose');
const Service = require('../models/Service');
const catalog = require('../utils/serviceCatalog');
const { UNITS } = require('../config/business');

const NOTICES = {
    ok: {
        created: 'Đã thêm dịch vụ mới.',
        updated: 'Đã lưu thay đổi. Giá mới chỉ áp dụng cho đơn lập sau đó, đơn cũ giữ nguyên giá.',
        shown: 'Đã hiện dịch vụ trên bảng giá.',
        hidden: 'Đã ẩn dịch vụ khỏi bảng giá (đơn cũ vẫn giữ nguyên).'
    },
    err: {
        notfound: 'Không tìm thấy dịch vụ.',
        last: 'Phải còn ít nhất một dịch vụ đang bán, không thể ẩn dịch vụ cuối cùng.'
    }
};

class ServiceController {
    // [GET] /admin/services
    async index(req, res, next) {
        try {
            const services = (await catalog.listAll()).map((s) => ({
                ...s,
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
            const input = catalog.validateServiceInput(req.body || {});
            if (input.error) {
                res.status(400);
                res.locals.formError = input.error;
                res.locals.formOld = { name: req.body.name, price: req.body.price, unit: req.body.unit };
                return new ServiceController().index(req, res, next);
            }
            const all = await catalog.listAll();
            const maxSort = all.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0);
            await Service.create({
                ...input.value,
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
            const input = catalog.validateServiceInput(req.body || {});
            if (input.error) {
                res.status(400);
                res.locals.formError = input.error;
                return new ServiceController().index(req, res, next);
            }
            const updated = await Service.findOneAndUpdate(
                { _id: req.params.id },
                { $set: { ...input.value, updatedBy: req.user._id, updatedAt: new Date() } },
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

            const willHide = svc.active !== false;
            if (willHide && all.filter((s) => s.active !== false).length <= 1) return res.redirect('/admin/services?err=last');

            await Service.updateOne({ _id: svc._id }, { $set: { active: !willHide, updatedBy: req.user._id, updatedAt: new Date() } });
            res.redirect('/admin/services?ok=' + (willHide ? 'hidden' : 'shown'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ServiceController();
