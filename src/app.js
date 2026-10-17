// Dựng ứng dụng Express (không kết nối DB, không mở cổng) để vừa chạy thật vừa dễ viết test.
const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const methodOverride = require('method-override');
const session = require('express-session');

const route = require('../routes');
const helpers = require('./helpers');
const csrf = require('../app/middlewares/csrf');
const securityHeaders = require('../app/middlewares/security');
const { resolveSessionSecret } = require('../config/secrets');

const isProd = process.env.NODE_ENV === 'production';

function createApp() {
    const app = express();

    app.disable('x-powered-by');

    // Chạy sau reverse proxy (Nginx, Render, Railway...): đặt TRUST_PROXY=1 để lấy đúng IP khách
    // (cần cho chống dò mật khẩu theo IP) và để cookie "secure" hoạt động qua HTTPS.
    if (process.env.TRUST_PROXY) {
        const n = Number(process.env.TRUST_PROXY);
        app.set('trust proxy', Number.isInteger(n) ? n : process.env.TRUST_PROXY);
    }

    // Kiểm tra sống cho Docker / giám sát: 200 khi đã nối được database, 503 khi chưa. Không cần đăng nhập, không lộ dữ liệu.
    app.get('/healthz', (req, res) => {
        const dbUp = require('mongoose').connection.readyState === 1;
        res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
    });

    // Static Files & Parsing Middlewares
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.urlencoded({ extended: false, limit: '100kb' })); // extended:false -> không cho gửi object lồng nhau (phòng NoSQL injection)
    app.use(methodOverride('_method'));

    // Session: lưu trong MongoDB (không mất khi restart), cookie httpOnly + sameSite
    let store;
    if (process.env.SESSION_STORE === 'memory') {
        if (isProd) throw new Error('SESSION_STORE=memory không được phép dùng ở môi trường production.');
        console.warn('⚠️  Đang dùng session lưu trong RAM (chỉ để dev/test) – mất hết khi restart.');
    } else {
        const MongoSessionStore = require('../app/utils/sessionStore');
        store = new MongoSessionStore();
    }

    app.use(session({
        name: 'tgl.sid',
        secret: resolveSessionSecret(),
        store,
        resave: false,
        saveUninitialized: false, // không tạo session cho khách vãng lai khi chưa cần
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: isProd ? 'auto' : false, // 'auto': chỉ gửi cookie qua HTTPS khi chạy production
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    }));

    app.use(securityHeaders);
    app.use(csrf);

    // Biến toàn cục cho view: thông tin người dùng đang đăng nhập
    app.use((req, res, next) => {
        const role = req.session.role || 'customer';
        res.locals.currentCustomer = req.session.customerId
            ? { id: req.session.customerId, name: req.session.customerName, role }
            : null;
        res.locals.isStaff = !!req.session.customerId && ['staff', 'owner'].includes(role);
        res.locals.isOwner = !!req.session.customerId && role === 'owner';
        res.locals.aiEnabled = require('../app/config/ai').getAiConfig().enabled; // hiện khung chat AI hay không
        res.locals.currentPath = req.path; // để menu biết mục nào đang active
        res.locals.today = new Date().toLocaleDateString('vi-VN', {
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh'
        });
        next();
    });

    // Cấu hình Handlebars (layout mặc định: main; khu vực quản trị dùng layout "admin")
    app.engine('hbs', engine({
        extname: '.hbs',
        helpers
    }));

    app.set('view engine', 'hbs');
    app.set('views', path.join(__dirname, 'views'));

    // Routes
    route(app);

    // 404
    app.use((req, res) => {
        res.status(404).render('errors/404', { pageTitle: 'Không tìm thấy trang' });
    });

    // Lỗi không bắt được trong controller (không lộ chi tiết lỗi ra cho người dùng)
    app.use((err, req, res, next) => {
        console.error(err);
        if (res.headersSent) return next(err);
        res.status(500).render('errors/500', { pageTitle: 'Có lỗi xảy ra' });
    });

    return app;
}

module.exports = createApp;
