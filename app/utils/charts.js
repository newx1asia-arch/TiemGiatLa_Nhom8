// Vẽ biểu đồ bằng SVG ngay trên server - KHÔNG cần thư viện ngoài, không cần internet.
// Mỗi hàm trả về chuỗi SVG; trong view dùng {{{ ... }}} (3 dấu ngoặc) để hiển thị.

const PALETTE = ['#1f4e8c', '#2a9d8f', '#e9a23b', '#c0504d', '#7a5ea8', '#4aa3df', '#8a94a3'];
const GRID = '#e3e8ef';
const TEXT = '#5b6778';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const round = (n) => Math.round(n * 10) / 10;

// Số ngắn gọn cho trục: 1.500.000 -> 1,5tr ; 20.000 -> 20k
function short(n) {
    if (n >= 1e6) return String(round(n / 1e6)).replace('.', ',') + 'tr';
    if (n >= 1e3) return String(round(n / 1e3)).replace('.', ',') + 'k';
    return String(round(n));
}

const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

// Trục Y: chia 4 khoảng đều nhau với số "tròn". integer=true cho dữ liệu đếm (số đơn).
function axis(maxVal, integer) {
    const max = Math.max(maxVal, integer ? 4 : 1);
    const p = Math.pow(10, Math.floor(Math.log10(max / 4)));
    const step = [1, 2, 2.5, 5, 10].map(f => f * p).find(s => s * 4 >= max) || 10 * p;
    return { top: step * 4, step };
}

// Chỉ hiện một số nhãn trục X cho khỏi chồng chữ; luôn hiện nhãn cuối, bỏ nhãn sát cuối nếu quá gần.
function showTick(i, n, every) {
    if (i === n - 1) return true;
    return i % every === 0 && (n - 1 - i) >= Math.ceil(every / 2);
}

function emptySvg(w, h, msg) {
    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img"><text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="13" fill="${TEXT}">${esc(msg)}</text></svg>`;
}

// Biểu đồ đường + vùng tô (1 chuỗi dữ liệu). data: [{ label, value, tip? }]
function lineChart(data, opts = {}) {
    const w = 640, h = opts.height || 250;
    const pl = 52, pr = 16, pt = 16, pb = 32;
    if (!data.length) return emptySvg(w, h, 'Chưa có dữ liệu');

    const color = opts.color || PALETTE[0];
    const fmt = opts.format || short;
    const { top, step } = axis(Math.max(...data.map(d => d.value)), opts.integer);
    const iw = w - pl - pr, ih = h - pt - pb;
    const X = (i) => (data.length === 1 ? pl + iw / 2 : pl + (iw * i) / (data.length - 1));
    const Y = (v) => pt + ih * (1 - v / top);

    let g = '';
    for (let k = 0; k <= 4; k++) {
        const v = step * k, y = Y(v);
        g += `<line x1="${pl}" y1="${y}" x2="${w - pr}" y2="${y}" stroke="${GRID}"/>`
           + `<text x="${pl - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${TEXT}">${esc(fmt(v))}</text>`;
    }

    const every = Math.ceil(data.length / 8);
    let xl = '';
    data.forEach((d, i) => {
        if (showTick(i, data.length, every)) {
            xl += `<text x="${X(i)}" y="${h - 10}" text-anchor="middle" font-size="11" fill="${TEXT}">${esc(d.label)}</text>`;
        }
    });

    const pts = data.map((d, i) => `${round(X(i))},${round(Y(d.value))}`);
    const area = `${round(X(0))},${Y(0)} ${pts.join(' ')} ${round(X(data.length - 1))},${Y(0)}`;
    const dots = data.map((d, i) =>
        `<circle cx="${round(X(i))}" cy="${round(Y(d.value))}" r="${data.length > 20 ? 2.5 : 4}" fill="#fff" stroke="${color}" stroke-width="2">`
        + `<title>${esc(d.tip || `${d.label}: ${nf(d.value)}`)}</title></circle>`).join('');

    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opts.label || 'Biểu đồ đường')}">`
        + g + `<polygon points="${area}" fill="${color}" fill-opacity=".12"/>`
        + `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
        + dots + xl + `</svg>`;
}

// Biểu đồ cột nhóm (1 hoặc nhiều chuỗi).
// categories: [{ label, values: [v1, v2, ...] }]   series: [{ name, color? }]
function columnChart(categories, series, opts = {}) {
    const w = 640, h = opts.height || 260;
    const pl = 46, pr = 12, pt = series.length > 1 ? 34 : 16, pb = 34;
    if (!categories.length) return emptySvg(w, h, 'Chưa có dữ liệu');

    const fmt = opts.format || short;
    const all = categories.flatMap(c => c.values);
    const { top, step } = axis(Math.max(...all, 0), opts.integer !== false && !opts.format);
    const iw = w - pl - pr, ih = h - pt - pb;
    const Y = (v) => pt + ih * (1 - v / top);
    const colW = iw / categories.length;
    const groupW = Math.min(colW * 0.72, 56 * series.length);
    const barW = groupW / series.length;
    const colors = series.map((s, i) => s.color || PALETTE[i % PALETTE.length]);

    let g = '';
    for (let k = 0; k <= 4; k++) {
        const v = step * k, y = Y(v);
        g += `<line x1="${pl}" y1="${y}" x2="${w - pr}" y2="${y}" stroke="${GRID}"/>`
           + `<text x="${pl - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${TEXT}">${esc(fmt(v))}</text>`;
    }

    const everyLabel = Math.ceil(categories.length / 10);
    let bars = '', labels = '';
    categories.forEach((c, i) => {
        const gx = pl + colW * i + (colW - groupW) / 2;
        c.values.forEach((v, j) => {
            const bh = Math.max(v > 0 ? 2 : 0, ih * (v / top));
            bars += `<rect x="${round(gx + barW * j + 1)}" y="${round(pt + ih - bh)}" width="${round(barW - 2)}" height="${round(bh)}" rx="2" fill="${colors[j]}">`
                  + `<title>${esc(`${c.label} · ${series[j].name}: ${nf(v)}`)}</title></rect>`;
        });
        if (showTick(i, categories.length, everyLabel)) {
            labels += `<text x="${round(pl + colW * i + colW / 2)}" y="${h - 12}" text-anchor="middle" font-size="11" fill="${TEXT}">${esc(cut(c.label, 12))}</text>`;
        }
    });

    let legend = '';
    if (series.length > 1) {
        let x = pl;
        series.forEach((s, j) => {
            legend += `<rect x="${x}" y="8" width="10" height="10" rx="2" fill="${colors[j]}"/>`
                    + `<text x="${x + 15}" y="17" font-size="11.5" fill="${TEXT}">${esc(s.name)}</text>`;
            x += 15 + s.name.length * 6.6 + 18;
        });
    }

    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opts.label || 'Biểu đồ cột')}">`
        + legend + g + bars + labels + `</svg>`;
}

// Biểu đồ tròn dạng vòng (donut).
// items: [{ label, value, color? }]  ->  { svg, legend: [{ label, value, percent, color }], total }
function donut(items, opts = {}) {
    const size = 180, c = size / 2, r = 66, sw = 26;
    const C = 2 * Math.PI * r;
    const total = items.reduce((s, i) => s + i.value, 0);
    const legend = items.map((it, i) => ({
        label: it.label,
        value: it.value,
        percent: total ? Math.round((it.value / total) * 100) : 0,
        color: it.color || PALETTE[i % PALETTE.length]
    }));

    let rings = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${GRID}" stroke-width="${sw}"/>`;
    let offset = 0;
    legend.forEach(l => {
        if (!total || l.value <= 0) return;
        const len = (l.value / total) * C;
        rings += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${l.color}" stroke-width="${sw}"`
               + ` stroke-dasharray="${round(len)} ${round(C - len)}" stroke-dashoffset="${round(-offset)}"`
               + ` transform="rotate(-90 ${c} ${c})"><title>${esc(`${l.label}: ${nf(l.value)} (${l.percent}%)`)}</title></circle>`;
        offset += len;
    });

    const centerMain = opts.centerText !== undefined ? opts.centerText : nf(total);
    const svg = `<svg class="chart-svg donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(opts.label || 'Biểu đồ tròn')}">`
        + rings
        + `<text x="${c}" y="${c + 2}" text-anchor="middle" font-size="${String(centerMain).length > 9 ? 15 : 22}" font-weight="700" fill="#1a2433">${esc(centerMain)}</text>`
        + `<text x="${c}" y="${c + 20}" text-anchor="middle" font-size="11" fill="${TEXT}">${esc(opts.centerSub || '')}</text>`
        + `</svg>`;

    return { svg, legend, total };
}

module.exports = { lineChart, columnChart, donut, short, PALETTE };
