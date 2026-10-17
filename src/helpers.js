// Các helper dùng chung cho Handlebars (tách riêng để dễ đọc và dễ kiểm thử).

const STATUS_LABELS = {
    cho_giat: 'Chờ giặt',
    dang_giat: 'Đang giặt',
    da_xong: 'Đã xong',
    da_giao: 'Đã giao',
    da_huy: 'Đã hủy'
};

const PAYMENT_LABELS = {
    cash: 'Tiền mặt',
    transfer: 'Chuyển khoản',
    prepaid_card: 'Thẻ trả trước'
};

const ROLE_LABELS = {
    staff: 'Nhân viên',
    owner: 'Chủ tiệm',
    customer: 'Khách hàng'
};

const pad = (n) => String(n).padStart(2, '0');

module.exports = {
    // {{#eq a b}}...{{else}}...{{/eq}}
    eq: function (a, b, options) {
        if (a === b) return options.fn(this);
        return options.inverse(this);
    },

    // Trả về "active" nếu đường dẫn hiện tại trùng hoặc nằm dưới href (dùng cho menu)
    isActive: (currentPath, href) => {
        if (!currentPath) return '';
        return currentPath === href || currentPath.startsWith(href + '/') ? 'active' : '';
    },
    // Chỉ "active" khi trùng khớp hoàn toàn (vd: trang chủ, tổng quan)
    isExact: (currentPath, href) => (currentPath === href ? 'active' : ''),

    dateFormat: (date) => {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    },
    dateTimeFormat: (date) => {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    formatPrice: (value) => {
        const num = Number(value) || 0;
        return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
    },
    formatNumber: (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0),

    // Nhãn hiển thị cho trạng thái đơn hàng (mục 2.3)
    statusLabel: (status) => STATUS_LABELS[status] || status,
    statusClass: (status) => `status-${(status || '').replace(/_/g, '-')}`,

    // Nhãn hiển thị cho trạng thái thẻ trả trước (mục 3 - Thẻ trả trước)
    cardStatusLabel: (status) => {
        const labels = { active: 'Đang hoạt động', locked: 'Đã khóa' };
        return labels[status] || status;
    },

    // Nhãn thanh toán
    payLabel: (method) => PAYMENT_LABELS[method] || '—',
    payStatusLabel: (status) => ({ paid: 'Đã thanh toán', refunded: 'Đã hoàn tiền' }[status] || 'Chưa thanh toán'),
    payStatusClass: (status) => ({ paid: 'badge-paid', refunded: 'badge-danger' }[status] || 'badge-unpaid'),

    // Nhãn thao tác trong nhật ký đơn
    auditLabel: (action) => ({ create: 'Lập đơn', edit: 'Sửa đơn', pay: 'Thu tiền', cancel: 'Hủy đơn', refund: 'Hoàn tiền' }[action] || action),

    roleLabel: (role) => ROLE_LABELS[role] || ROLE_LABELS.customer,

    // Chữ cái đầu của họ tên để làm avatar: "Nguyễn Tấn Tài" -> "NT"
    initials: (name) => {
        const words = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!words.length) return '?';
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    },

    currentYear: () => new Date().getFullYear()
};

module.exports.STATUS_LABELS = STATUS_LABELS;
