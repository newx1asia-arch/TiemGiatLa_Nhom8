const catalog = require('../utils/serviceCatalog');

class SiteController {
    // [GET] / - Trang chủ: bảng giá lấy từ database (chủ tiệm sửa tại /admin/services)
    async home(req, res, next) {
        try {
            res.render('home', { services: await catalog.listActive() });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SiteController();
