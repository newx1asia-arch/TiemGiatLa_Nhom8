const express = require('express');
const router = express.Router();
const aiController = require('../app/controllers/aiController');

// Trợ lý AI nhận JSON (các route khác của dự án chỉ nhận form). Giới hạn 20KB. Mã CSRF gửi qua header x-csrf-token.
router.use(express.json({ limit: '20kb' }));
router.post('/chat', aiController.chat);

// Lỗi đọc JSON (sai định dạng / quá lớn) -> trả JSON gọn thay vì trang lỗi HTML
router.use((err, req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
        return res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
    }
    next(err);
});

module.exports = router;
