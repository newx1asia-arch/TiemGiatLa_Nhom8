// Tài khoản ngân hàng nhận tiền chuyển khoản (dùng để sinh mã QR VietQR trên hóa đơn).
// Đặt trong file .env (hoặc biến môi trường trên Render/Docker):
//   BANK_BIN=970436                  # mã ngân hàng (BIN) - xem bảng BANKS bên dưới
//   BANK_ACCOUNT=0123456789          # số tài khoản nhận tiền
//   BANK_ACCOUNT_NAME=NGUYEN VAN A   # tên chủ tài khoản (hiển thị cho khách đối chiếu)
//   BANK_NAME=Vietcombank            # (tuỳ chọn) tên ngân hàng; bỏ trống sẽ tự điền theo BIN
// Thiếu BANK_BIN hoặc BANK_ACCOUNT thì hóa đơn không hiện mã QR.

// Một số ngân hàng phổ biến (BIN theo danh sách NAPAS)
const BANKS = {
    '970436': 'Vietcombank',
    '970415': 'VietinBank',
    '970418': 'BIDV',
    '970405': 'Agribank',
    '970422': 'MB Bank',
    '970407': 'Techcombank',
    '970416': 'ACB',
    '970432': 'VPBank',
    '970423': 'TPBank',
    '970403': 'Sacombank',
    '970441': 'VIB',
    '970437': 'HDBank'
};

function getBankConfig(env = process.env) {
    const bin = String(env.BANK_BIN || '').trim();
    const account = String(env.BANK_ACCOUNT || '').trim();
    if (!/^\d{6}$/.test(bin) || !/^[0-9A-Za-z]{4,19}$/.test(account)) return null;
    return {
        bin,
        account,
        accountName: String(env.BANK_ACCOUNT_NAME || '').trim().slice(0, 60),
        bankName: String(env.BANK_NAME || '').trim().slice(0, 40) || BANKS[bin] || 'Ngân hàng (BIN ' + bin + ')'
    };
}

module.exports = { BANKS, getBankConfig };
