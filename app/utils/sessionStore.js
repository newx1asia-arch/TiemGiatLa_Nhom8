// Session store lưu trong MongoDB (thay cho MemoryStore mặc định – vốn mất hết khi restart
// và bị express-session cảnh báo không dùng cho môi trường thật).
// Tự viết bằng mongoose nên không cần cài thêm thư viện.
const session = require('express-session');
const Session = require('../models/Session');

const DEFAULT_TTL = 24 * 3600 * 1000;

const expiresOf = (sess) =>
    sess && sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + DEFAULT_TTL);

class MongoSessionStore extends session.Store {
    get(sid, cb) {
        Session.findById(sid).lean().then((doc) => {
            if (!doc) return cb(null, null);
            if (doc.expires <= new Date()) {
                return Session.deleteOne({ _id: sid }).then(() => cb(null, null), () => cb(null, null));
            }
            let sess;
            try { sess = JSON.parse(doc.data); } catch (e) { return cb(null, null); }
            cb(null, sess);
        }, (err) => cb(err));
    }

    set(sid, sess, cb) {
        Session.updateOne(
            { _id: sid },
            { $set: { data: JSON.stringify(sess), expires: expiresOf(sess) } },
            { upsert: true }
        ).then(() => cb && cb(null), (err) => cb && cb(err));
    }

    touch(sid, sess, cb) {
        Session.updateOne({ _id: sid }, { $set: { expires: expiresOf(sess) } })
            .then(() => cb && cb(null), (err) => cb && cb(err));
    }

    destroy(sid, cb) {
        Session.deleteOne({ _id: sid }).then(() => cb && cb(null), (err) => cb && cb(err));
    }
}

module.exports = MongoSessionStore;
