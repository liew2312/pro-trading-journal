(function () {
    if (window.MangaCaptureClean) return;
    const id = 'manga-capture-clean-style';
    const marker = 'data-manga-capture-hide';
    const known = ['.scrollToTop', '.scrolltotop', '.scroll-to-top', '.back-to-top', '.backtotop',
        '.backToTop', '.go-top', '.gotop', '.toTop', '.scrollup', '.scroll-up',
        '#scrollToTop', '#back-to-top', '#backtotop', '#go-top', '#gotop', '#toTop', '#scrollUp'];
    function markFloatingArrows() {
        document.querySelectorAll('a,button,[role="button"],[id],[class]').forEach(el => {
            const label = [el.id, el.className, el.getAttribute('title'), el.getAttribute('aria-label')].join(' ');
            const named = /(?:back[\s_-]*to[\s_-]*top|scroll[\s_-]*(?:to[\s_-]*)?(?:top|up)|go[\s_-]*top|to[\s_-]*top|กลับ(?:ไป)?(?:ด้าน)?บน|ขึ้น(?:ด้าน)?บน)/i.test(label);
            const arrow = /^[\s↑⇧⬆⌃ˆ^]+$/.test(el.textContent || '') || el.querySelector('.fa-arrow-up,.fa-angle-up,.fa-chevron-up,.fa-caret-up');
            if (!named && !arrow) return;
            // Only infer small floating controls, never reader containers or manga images.
            let target = el;
            for (let depth = 0; target && depth < 4; depth++, target = target.parentElement) {
                const position = getComputedStyle(target).position;
                const r = target.getBoundingClientRect();
                if ((position === 'fixed' || position === 'sticky') && r.width > 0 && r.width <= 180 && r.height > 0 && r.height <= 180 &&
                    !target.matches('img,canvas,video') && !target.querySelector('#readerarea,.readerarea')) {
                    target.setAttribute(marker, '1'); break;
                }
            }
        });
    }
    window.MangaCaptureClean = {
        setEnabled(enabled) {
            let style = document.getElementById(id);
            if (!enabled) {
                if (style) style.remove();
                document.querySelectorAll('[' + marker + ']').forEach(el => el.removeAttribute(marker));
                return;
            }
            if (!style) {
                style = document.createElement('style'); style.id = id;
                const selectors = known.concat('[' + marker + ']');
                if (/(^|\.)go-manga\.com$/i.test(location.hostname)) selectors.push('.readingnav');
                style.textContent = selectors.flatMap(s => [s, s + ' *']).join(',') + '{' +
                    'visibility:hidden!important;opacity:0!important;pointer-events:none!important;}';
                (document.head || document.documentElement).appendChild(style);
            }
            markFloatingArrows();
        }
    };
})();
