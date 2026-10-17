// Trợ lý AI tư vấn khách hàng: POST /ai/chat nhận hội thoại (JSON), trả lời bằng chữ.
const limiter = require('../middlewares/loginLimiter');
const advisor = require('../utils/aiAdvisor');
const { getAiConfig } = require('../config/ai');

exports.chat = async (req, res) => {
    const cfg = getAiConfig();
    if (!cfg.enabled) return res.status(503).json({ error: 'Trợ lý AI chưa được bật.' });

    const customerId = req.session.customerId || null;
    try {
        // Giới hạn số câu hỏi để không bị lạm dụng làm tốn chi phí API
        const keys = customerId ? [limiter.aiUserKey(customerId)] : [limiter.aiGuestKey(req.ip)];
        const wait = await limiter.lockedFor(keys);
        if (wait > 0) {
            return res.status(429).json({ error: `Bạn đã hỏi quá nhiều. Vui lòng thử lại sau khoảng ${Math.ceil(wait / 60000)} phút hoặc hỏi nhân viên tại quầy.` });
        }
        await limiter.recordAi(customerId, req.ip);

        const { reply } = await advisor.askAdvisor({ messages: req.body && req.body.messages, customerId, config: cfg });
        res.json({ reply });
    } catch (err) {
        if (err instanceof advisor.AdvisorError) return res.status(err.status).json({ error: err.message });
        console.error('❌ Lỗi trợ lý AI:', err);
        res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại.' });
    }
};
