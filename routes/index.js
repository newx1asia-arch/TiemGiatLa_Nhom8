// routes/index.js
const siteRouter = require('./site');
const authRouter = require('./auth');
const customerRouter = require('./customer');
const orderRouter = require('./order');
const suppliesRouter = require('./supplies'); // Quản lý kho vật tư (mục 2.4)
const tipsRouter = require('./tips');
const adminRouter = require('./admin');
const aiRouter = require('./ai');             // Trợ lý AI tư vấn khách hàng       // Khu vực quản trị cho nhân viên / chủ tiệm
// TODO (mục 2.5): sẽ bổ sung thêm khi làm module tiếp theo:
// const reportRouter = require('./report');       // Báo cáo/thống kê

function route(app) {
    app.use('/auth', authRouter);
    app.use('/me', customerRouter);
    app.use('/orders', orderRouter);
    app.use('/supplies', suppliesRouter);
    app.use('/tips', tipsRouter);
    app.use('/ai', aiRouter);
    app.use('/admin', adminRouter);
    app.use('/', siteRouter);
}

module.exports = route;