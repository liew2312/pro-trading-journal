(function () {
    if (window.MangaCaptureAnchors) return;
    const marks = {};
    function box(element) { return element.getBoundingClientRect(); }
    function images() { return Array.from(document.querySelectorAll('#readerarea img, .readerarea img')); }
    function mark(name) {
        const y = innerHeight / 2;
        const candidates = images();
        const image = candidates.find(el => { const r = box(el); return r.height > 0 && r.top <= y && r.bottom >= y; });
        const el = image || document.elementFromPoint(innerWidth / 2, y);
        if (!el) throw new Error('No content at selection');
        const r = box(el);
        // A fraction follows the same point in a manga image if its size changes after loading.
        marks[name] = { el, image: !!image, src: image ? (el.currentSrc || el.src) : '',
            fraction: r.height > 0 ? (y - r.top) / r.height : 0, offset: y - r.top };
        if (name === 'start') delete marks.end;
        return scrollY + y;
    }
    function position(name) {
        const m = marks[name];
        if (!m) throw new Error('Missing selection');
        if (!m.el.isConnected && m.image && m.src) {
            m.el = images().find(el => (el.currentSrc || el.src) === m.src);
        }
        if (!m.el || !m.el.isConnected) throw new Error('Selected content removed');
        const r = box(m.el);
        if (m.image && r.height <= 0) throw new Error('Selected image hidden');
        return scrollY + r.top + (m.image ? m.fraction * r.height : m.offset);
    }
    function resolve(nativeWidth) {
        const scale = nativeWidth / innerWidth;
        const a = Math.round(position('start') * scale);
        const b = Math.round(position('end') * scale);
        if (a < 0 || b <= a) throw new Error('Invalid selection');
        return [a, b];
    }
    window.MangaCaptureAnchors = { mark, resolve };
})();
