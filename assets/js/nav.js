// Mobile nav: hamburger toggles aria-expanded; tap outside / ESC / nav-link
// click closes. Shared across index / practice / library / transparency.
//
// Markup contract (each page):
//   <button class="hamburger" id="hamburger-btn" aria-label="Menu"
//           aria-expanded="false" aria-controls="primary-nav-links">
//     <span></span><span></span><span></span>
//   </button>
//   <ul class="nav-links" id="primary-nav-links"> ... </ul>
//
// Include with: <script src="assets/js/nav.js" defer></script>
(function () {
    function init() {
        var btn = document.getElementById('hamburger-btn');
        var nav = document.getElementById('primary-nav-links');
        if (!btn || !nav) return;

        function setOpen(open) {
            nav.classList.toggle('active', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            setOpen(!nav.classList.contains('active'));
        });

        // Tap anywhere outside the nav or hamburger -> close.
        document.addEventListener('click', function (e) {
            if (!nav.classList.contains('active')) return;
            if (e.target === btn || btn.contains(e.target) || nav.contains(e.target)) return;
            setOpen(false);
        });

        // Escape key -> close + return focus to the hamburger.
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && nav.classList.contains('active')) {
                setOpen(false);
                btn.focus();
            }
        });

        // Tapping any link inside the menu -> close (so the menu doesn't
        // stay open while the new page is loading).
        nav.addEventListener('click', function (e) {
            if (e.target.tagName === 'A') setOpen(false);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
