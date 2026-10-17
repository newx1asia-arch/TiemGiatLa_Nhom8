// Trình duyệt giả có "cookie jar" để test luồng đăng nhập / form thật qua HTTP.
class Client {
    constructor(base) { this.base = base; this.jar = {}; }

    async req(method, path, form) {
        const headers = {};
        const cookie = Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookie) headers.cookie = cookie;
        let body;
        if (form) {
            headers['content-type'] = 'application/x-www-form-urlencoded';
            body = new URLSearchParams(form).toString();
        }
        const res = await fetch(this.base + path, { method, headers, body, redirect: 'manual' });
        for (const sc of res.headers.getSetCookie()) {
            const [pair] = sc.split(';');
            const i = pair.indexOf('=');
            const k = pair.slice(0, i), v = pair.slice(i + 1);
            if (v === '' || /expires=Thu, 01 Jan 1970/i.test(sc)) delete this.jar[k]; else this.jar[k] = v;
        }
        const text = await res.text();
        return { status: res.status, headers: res.headers, text, location: res.headers.get('location'), setCookie: res.headers.getSetCookie() };
    }

    get(path) { return this.req('GET', path); }
    post(path, form) { return this.req('POST', path, form); }

    // Lấy mã CSRF hiện tại từ một trang bất kỳ có form
    async csrf(path = '/auth/login') {
        const r = await this.get(path);
        const m = /name="_csrf" value="([0-9a-f]+)"/.exec(r.text);
        if (!m) throw new Error('Không thấy _csrf trên ' + path + ' (status ' + r.status + ')');
        return m[1];
    }

    // POST kèm CSRF tự động
    async submit(path, form = {}, formPage = '/auth/login') {
        const _csrf = await this.csrf(formPage);
        return this.post(path, { _csrf, ...form });
    }

    async login(phone, password) {
        return this.submit('/auth/login', { phone, password });
    }
}

module.exports = { Client };
