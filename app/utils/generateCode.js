const Counter = require('../models/Counter');

/**
 * Sinh mã tự tăng, VD: generateCode('customer', 'KH') => 'KH000001', 'KH000002'...
 * Dùng chung cho Mã khách hàng (2.1) và sau này là Mã đơn hàng (2.2).
 */
async function generateCode(counterName, prefix, padLength = 6) {
    const counter = await Counter.findByIdAndUpdate(
        counterName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return prefix + String(counter.seq).padStart(padLength, '0');
}

module.exports = { generateCode };
