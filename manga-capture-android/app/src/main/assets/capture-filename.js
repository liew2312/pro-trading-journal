(function () {
    if (window.MangaCaptureFilename) return;
    const chapter = /(?:ตอนที่|ตอน|chapter|ch\.?|episode|ep\.?)\s*[-:]?\s*([0-9๐-๙]+(?:[.\-][0-9๐-๙]+)*)/i;
    function clean(value) {
        return value.replace(/^(?:อ่านมังงะ|อ่านการ์ตูน|มังงะเรื่อง|read manga)\s*/i, '')
            .replace(/\s*(?:แปลไทย|อ่านฟรี)(?:\s.*)?$/i, '')
            .replace(/\s*[|｜].*$/, '').trim();
    }
    function fromTitle(value) {
        const match = chapter.exec(value);
        if (!match) return '';
        const series = clean(value.slice(0, match.index));
        return series ? series + ' ตอนที่ ' + match[1] : '';
    }
    function sanitize(value) {
        // Avoid separators and controls while retaining Thai text and decimal chapter numbers.
        return value.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim();
    }
    function create() {
        const headings = Array.from(document.querySelectorAll('h1')).map(el => el.textContent || '');
        const candidates = headings.concat(document.title || '');
        let name = candidates.map(fromTitle).find(Boolean);
        if (!name) name = clean(headings.find(text => text.trim()) || document.title || 'Manga');
        name = sanitize(name || 'Manga');
        // Stay comfortably within common file-system UTF-8 filename byte limits.
        const tail = / ตอนที่ [0-9๐-๙]+(?:[.\-][0-9๐-๙]+)*$/.exec(name);
        const suffix = tail ? tail[0] : '';
        const chars = Array.from(suffix ? name.slice(0, -suffix.length) : name); const encoder = new TextEncoder();
        while (encoder.encode(chars.join('') + suffix).length > 210 && chars.length) chars.pop();
        return ((chars.join('') + suffix).replace(/[. ]+$/g, '') || 'Manga') + '.pdf';
    }
    window.MangaCaptureFilename = { create, fromTitle, sanitize };
})();
