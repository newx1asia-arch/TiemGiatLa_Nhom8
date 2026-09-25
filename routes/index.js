// routes/index.js
const siteRouter = require('./site');
const authRouter = require('./auth');
const customerRouter = require('./customer');

// TODO (mục 2.2 - 2.5): sẽ bổ sung thêm khi làm các module tiếp theo:
// const orderRouter = require('./order');       // Quản lý đơn hàng/dịch vụ
// const inventoryRouter = require('./inventory'); // Quản lý kho vật tư
// const reportRouter = require('./report');       // Báo cáo/thống kê

function route(app) {
    app.use('/auth', authRouter);
    app.use('/me', customerRouter);
    app.use('/', siteRouter);
}

module.exports = route;
