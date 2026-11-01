/* ==========================================================================
   RADAR FUSION — SCROLL REVEAL & STAT COUNT-UP ENGINE
   Uses IntersectionObserver for single-fire 600-800ms ease-out animations.
   ========================================================================== */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Helper: Count up smoothly
    function animateCount(el) {
      if (el.hasAttribute('data-counted')) return;
      el.setAttribute('data-counted', 'true');

      var target = parseFloat(el.getAttribute('data-count'));
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var duration = 1200; // ms
      var startTime = null;

      if (reducedMotion || isNaN(target)) {
        el.textContent = prefix + target.toFixed(decimals) + suffix;
        return;
      }

      function step(now) {
        if (!startTime) startTime = now;
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic curve
        var ease = 1 - Math.pow(1 - progress, 3);
        var current = target * ease;
        el.textContent = prefix + current.toFixed(decimals) + suffix;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = prefix + target.toFixed(decimals) + suffix;
        }
      }

      requestAnimationFrame(step);
    }

    // Helper: Trigger SVG draw paths
    function triggerPathDraw(container) {
      var paths = container.querySelectorAll('.draw-path');
      paths.forEach(function (p) {
        p.classList.add('drawn');
      });
    }

    if (!('IntersectionObserver' in window) || reducedMotion) {
      // Immediate fallback
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('revealed');
      });
      document.querySelectorAll('[data-count]').forEach(animateCount);
      document.querySelectorAll('.draw-path').forEach(function (p) { p.classList.add('drawn'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var target = entry.target;
          target.classList.add('revealed');

          // Check if target or any child is a count-up element
          if (target.hasAttribute('data-count')) {
            animateCount(target);
          }
          target.querySelectorAll('[data-count]').forEach(animateCount);

          // Check for SVG draw paths
          triggerPathDraw(target);

          obs.unobserve(target);
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.12
    });

    document.querySelectorAll('.reveal').forEach(function (el) {
      observer.observe(el);
    });
  });
})();

