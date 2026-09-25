require('dotenv').config();

const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const methodOverride = require('method-override');
const session = require('express-session');

const route = require('../routes');
const db = require('../config/db');

const app = express();
const port = process.env.PORT || 3000;

// Kết nối Database
db.connect();

// Static Files & Parsing Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'tiemgiatla-secret-key-doi-lai-trong-production',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Biến toàn cục cho view: thông tin khách hàng đang đăng nhập
app.use((req, res, next) => {
    res.locals.currentCustomer = req.session.customerId
        ? { id: req.session.customerId, name: req.session.customerName }
        : null;
    res.locals.currentPath = req.path; // để header.hbs biết mục nào đang active
    next();
});

// Cấu hình Handlebars
app.engine('hbs', engine({
    extname: '.hbs',
    helpers: {
        eq: function (a, b, options) {
            if (a === b) return options.fn(this);
            return options.inverse(this);
        },
        dateFormat: (date) => {
            if (!date) return '';
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        },
        formatPrice: (value) => {
            const num = Number(value) || 0;
            return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
        },
        // Nhãn hiển thị cho trạng thái đơn hàng (mục 2.3)
        statusLabel: (status) => {
            const labels = {
                cho_giat: 'Chờ giặt',
                dang_giat: 'Đang giặt',
                da_xong: 'Đã xong',
                da_giao: 'Đã giao'
            };
            return labels[status] || status;
        },
        statusClass: (status) => `status-${(status || '').replace(/_/g, '-')}`,
        // Nhãn hiển thị cho trạng thái thẻ trả trước (mục 3 - Thẻ trả trước)
        cardStatusLabel: (status) => {
            const labels = { active: 'Đang hoạt động', locked: 'Đã khóa' };
            return labels[status] || status;
        },
        currentYear: () => new Date().getFullYear()
    }
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Routes
route(app);

// 404
app.use((req, res) => {
    res.status(404).render('home', { notFound: true });
});

app.listen(port, () => {
    console.log(`\n🚀 Server Tiệm giặt là đang chạy tại: http://localhost:${port}`);
});
