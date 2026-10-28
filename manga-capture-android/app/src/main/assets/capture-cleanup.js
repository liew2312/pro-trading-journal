(function () {
    if (window.MangaCaptureClean) return;
    const id = 'manga-capture-clean-style';
    window.MangaCaptureClean = {
        setEnabled(enabled) {
            let style = document.getElementById(id);
            if (!enabled) { if (style) style.remove(); return; }
            if (!/(^|\.)go-manga\.com$/i.test(location.hostname) || style) return;
            style = document.createElement('style');
            style.id = id;
            // Hide only the site's floating reading controls. Preserve layout and image coordinates.
            style.textContent = '.readingnav, .readingnav *, .scrollToTop, .scrollToTop * {' +
                'visibility:hidden!important;opacity:0!important;pointer-events:none!important;}';
            (document.head || document.documentElement).appendChild(style);
        }
    };
})();
