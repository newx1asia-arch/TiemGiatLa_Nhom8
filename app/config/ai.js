// Cấu hình trợ lý AI tư vấn khách hàng. Hỗ trợ 2 nhà cung cấp, đặt khóa trong .env:
//   GEMINI_API_KEY=AIza...              # Google Gemini - CÓ GÓI MIỄN PHÍ. Lấy tại aistudio.google.com/apikey
//   ANTHROPIC_API_KEY=sk-ant-...        # Claude (Anthropic) - trả phí. Lấy tại console.anthropic.com > API Keys
//   AI_MODEL=gemini-3.8-flash           # (tuỳ chọn) đổi model. Mặc định: Gemini = gemini-3.8-flash, Claude = claude-haiku-5-5
//   SHOP_INFO="Địa chỉ: ...; Giờ mở cửa: 7h-21h; Hotline: 09xx..."   # (tuỳ chọn) thông tin tiệm để AI trả lời đúng
// Có cả hai khóa thì ưu tiên Gemini. Không có khóa nào thì khung chat AI tự ẩn, các chức năng khác không ảnh hưởng.
// KHÔNG đưa khóa lên GitHub.
const DEFAULT_MODELS = { gemini: 'gemini-3.8-flash', claude: 'claude-haiku-5-5' };
const DEFAULT_MODEL = DEFAULT_MODELS.claude; // giữ lại cho code cũ

function getAiConfig(env = process.env) {
    const geminiKey = String(env.GEMINI_API_KEY || '').trim();
    const claudeKey = String(env.ANTHROPIC_API_KEY || '').trim();
    const provider = geminiKey ? 'gemini' : (claudeKey ? 'claude' : '');
    return {
        enabled: !!provider,
        provider,
        apiKey: provider === 'gemini' ? geminiKey : claudeKey,
        model: String(env.AI_MODEL || '').trim() || DEFAULT_MODELS[provider] || DEFAULT_MODEL,
        shopInfo: String(env.SHOP_INFO || '').trim().slice(0, 600),
        maxTokens: provider === 'gemini' ? 2000 : 700, // Gemini tính cả phần "suy nghĩ" vào giới hạn nên cần rộng hơn
        timeoutMs: 30000
    };
}

module.exports = { getAiConfig, DEFAULT_MODEL, DEFAULT_MODELS };
