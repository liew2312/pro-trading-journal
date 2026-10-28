(function () {
    if (window.MangaCapturePrepare) return;
    function images() {
        const reader = document.querySelector('#readerarea,.readerarea');
        return Array.from(reader ? reader.querySelectorAll('img') : document.images)
            .filter(el => getComputedStyle(el).display !== 'none');
    }
    function snapshot() {
        const list = images();
        return { total: list.length, loaded: list.filter(el => el.complete && el.naturalWidth > 0).length,
            height: document.documentElement.scrollHeight };
    }
    function focus(index) {
        const list = images();
        if (list[index]) list[index].scrollIntoView({ block: 'center', behavior: 'instant' });
        return snapshot();
    }
    window.MangaCapturePrepare = { snapshot, focus };
})();
