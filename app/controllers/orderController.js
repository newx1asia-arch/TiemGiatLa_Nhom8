// controllers/orderController.js
const Order = require('../models/Order'); // Model Đơn hàng
const Customer = require('../models/Customer'); // Model Khách hàng (Thêm dòng này để tra cứu)

// 1. Hiển thị trang tạo đơn hàng (truyền danh sách khách hàng ra view để chọn cho tiện)
exports.renderCreateOrder = async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: -1 }); // Lấy danh sách khách hàng
        res.render('orders/create', { customers }); 
    } catch (error) {
        res.status(500).send("Lỗi tải trang tạo đơn: " + error.message);
    }
};

// 2. Xử lý lưu đơn hàng (Mục 2.2: Chọn dịch vụ, tính tiền, hẹn ngày trả)
exports.createOrder = async (req, res) => {
    try {
        let { customerId, returnDate, servicesSelected, paymentMethod } = req.body; 

        // 💡 XỬ LÝ QUAN TRỌNG: Tìm kiếm khách hàng dù người dùng nhập ObjectId, Mã KH hay Số điện thoại
        let customer;
        if (customerId) {
            customerId = customerId.trim();
            if (customerId.match(/^[0-9a-fA-F]{24}$/)) {
                // Nếu đúng định dạng ObjectId của MongoDB
                customer = await Customer.findById(customerId);
            } else {
                // Nếu nhập mã code (VD: KH00002) hoặc số điện thoại
                customer = await Customer.findOne({ 
                    $or: [{ code: customerId }, { phone: customerId }, { username: customerId }] 
                });
            }
        }

        if (!customer) {
            return res.status(400).send("Lỗi: Không tìm thấy khách hàng! Vui lòng kiểm tra lại mã hoặc số điện thoại khách hàng.");
        }

        // Sinh mã đơn hàng tự động (dùng cho mã vạch)
        const code = 'DH' + Date.now().toString().slice(-8);

        // Tính toán chi tiết từng dịch vụ và tổng tiền
        let totalAmount = 0;
        const listServices = Array.isArray(servicesSelected) ? servicesSelected : [servicesSelected];
        
        const servicesFormatted = listServices.map(item => {
            const unitPrice = Number(item.unitPrice) || 0;
            const quantity = Number(item.quantity) || 0;
            const subtotal = unitPrice * quantity;
            totalAmount += subtotal;
            return {
                serviceName: item.serviceName,
                unitPrice,
                quantity,
                subtotal
            };
        });

        // Tạo và lưu đơn hàng mới vào MongoDB với _id chuẩn của khách hàng tìm được
        const newOrder = new Order({
            code,
            customer: customer._id, // Đã chuẩn hóa thành ObjectId
            services: servicesFormatted,
            returnDate,
            totalAmount,
            paymentMethod: paymentMethod || 'cash',
            paymentStatus: 'unpaid'
        });

        await newOrder.save();
        
        // Chuyển hướng sang trang hóa đơn có tích hợp mã vạch và in
        res.redirect(`/orders/invoice/${newOrder._id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Lỗi tạo đơn hàng: " + error.message);
    }
};

// 3. Xem chi tiết hóa đơn (để hiển thị mã vạch & in)
exports.getInvoice = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('customer');
        if (!order) {
            return res.status(404).send("Không tìm thấy đơn hàng!");
        }
        res.render('orders/invoice', { order });
    } catch (error) {
        res.status(500).send("Lỗi tải hóa đơn: " + error.message);
    }
};