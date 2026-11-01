/* ==========================================================================
   RADAR FUSION — NAVIGATION & PAGE LIFECYCLE
   Handles floating navbar, active indicators, scroll progress, mobile drawer.
   ========================================================================== */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // 1. Page Fade-In Transition
    var pageWrapper = document.querySelector('.page-fade') || document.querySelector('.page-wrapper');
    if (pageWrapper) {
      pageWrapper.classList.add('page-fade');
      requestAnimationFrame(function () {
        pageWrapper.classList.add('page-loaded');
      });
    }

    // 2. Active Page Link Detection
    var currentPath = window.location.pathname.split('/').pop() || 'index.html';
    var navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && (href === currentPath || (currentPath === '' && href === 'index.html'))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // 3. Scroll Progress Indicator
    var progressBar = document.getElementById('scroll-progress');
    if (progressBar) {
      window.addEventListener('scroll', function () {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        progressBar.style.width = progress + '%';
      }, { passive: true });
    }

    // 4. Mobile Hamburger Drawer Toggle
    var hamburger = document.querySelector('.nav-hamburger');
    var mobileDrawer = document.querySelector('.mobile-nav-drawer');

    if (hamburger && mobileDrawer) {
      hamburger.addEventListener('click', function () {
        var isOpen = mobileDrawer.classList.contains('open');
        if (isOpen) {
          mobileDrawer.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
        } else {
          mobileDrawer.classList.add('open');
          hamburger.setAttribute('aria-expanded', 'true');
        }
      });

      // Close drawer on link click
      mobileDrawer.querySelectorAll('.nav-link').forEach(function (l) {
        l.addEventListener('click', function () {
          mobileDrawer.classList.remove('open');
        });
      });
    }

    // 5. Accordion Interactivity
    document.querySelectorAll('.accordion-header').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.accordion-item');
        if (!item) return;
        var isOpen = item.classList.contains('open');
        // Close siblings if in single-expand mode
        var parentAccordion = item.closest('.accordion');
        if (parentAccordion && !parentAccordion.hasAttribute('data-multi')) {
          parentAccordion.querySelectorAll('.accordion-item').forEach(function (sibling) {
            sibling.classList.remove('open');
          });
        }
        if (!isOpen) item.classList.add('open');
        else item.classList.remove('open');
      });
    });
  });
})();

