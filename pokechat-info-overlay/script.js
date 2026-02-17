(function () {
    'use strict';

    const SLIDE_DURATION_MS = 6000;
    const slidesEl = document.getElementById('slides');
    const slides = slidesEl ? Array.from(slidesEl.querySelectorAll('.slide')) : [];

    let currentIndex = 0;
    let timer = null;
    let paused = false;

    function goTo(index) {
        if (slides.length === 0) return;
        const next = ((index % slides.length) + slides.length) % slides.length;
        slides.forEach(function (s) { s.classList.remove('active'); });
        slides[next].classList.add('active');
        currentIndex = next;
    }

    function next() {
        goTo(currentIndex + 1);
    }

    function startTimer() {
        stopTimer();
        if (paused) return;
        timer = setInterval(next, SLIDE_DURATION_MS);
    }

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function setupPause() {
        var widget = document.getElementById('widget');
        if (!widget) return;
        widget.addEventListener('mouseenter', function () {
            paused = true;
            stopTimer();
        });
        widget.addEventListener('mouseleave', function () {
            paused = false;
            startTimer();
        });
    }

    if (slides.length) {
        goTo(0);
        setupPause();
        startTimer();
    }
})();
