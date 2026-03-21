/* ============================================
   TechBlog - Homepage Interactions
   Scroll reveal, mouse parallax, staggered animations
   ============================================ */

(function () {
  'use strict';

  /* ===== Scroll Reveal with IntersectionObserver ===== */
  function initScrollReveal() {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -40px 0px'
    });

    // Observe all elements with reveal class
    document.querySelectorAll('.reveal-on-scroll').forEach(function (el) {
      revealObserver.observe(el);
    });

    // Watch for dynamically added article cards
    var grid = document.getElementById('articles-grid');
    if (grid) {
      var mutationObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              // Direct card
              if (node.classList && node.classList.contains('article-card')) {
                node.classList.add('reveal-on-scroll');
                revealObserver.observe(node);
              }
              // Cards inside a container
              if (node.querySelectorAll) {
                node.querySelectorAll('.article-card').forEach(function (card) {
                  card.classList.add('reveal-on-scroll');
                  revealObserver.observe(card);
                });
              }
            }
          });
        });
      });

      mutationObserver.observe(grid, { childList: true });
    }

    return revealObserver;
  }

  /* ===== Subtle Mouse Parallax on Hero ===== */
  function initHeroParallax() {
    var hero = document.querySelector('.hero-new');
    if (!hero) return;

    var title = hero.querySelector('.hero-title');
    var orbs = document.querySelectorAll('.aurora-orb');

    var rafId = null;
    var targetX = 0, targetY = 0;
    var currentX = 0, currentY = 0;

    document.addEventListener('mousemove', function (e) {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function animate() {
      // Smooth interpolation
      currentX += (targetX - currentX) * 0.04;
      currentY += (targetY - currentY) * 0.04;

      // Move aurora orbs slightly
      orbs.forEach(function (orb, i) {
        var factor = (i + 1) * 8;
        orb.style.transform = 'translate(' + (currentX * factor) + 'px, ' + (currentY * factor) + 'px)';
      });

      rafId = requestAnimationFrame(animate);
    }

    animate();

    // Cleanup on page hide
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
      } else {
        animate();
      }
    });
  }

  /* ===== Tag Pill Click Handler ===== */
  function initTagPills() {
    document.querySelectorAll('.hero-tag').forEach(function (tag) {
      tag.addEventListener('click', function () {
        var keyword = this.getAttribute('data-tag');
        if (!keyword) return;

        var searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.value = keyword;
        }

        if (window.App && window.App.onSearch) {
          window.App.onSearch(keyword);
        }

        // Smooth scroll to articles
        var articlesSection = document.querySelector('.home-articles-section');
        if (articlesSection) {
          articlesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* ===== Initialize ===== */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }
  }

  function onReady() {
    initScrollReveal();
    initHeroParallax();
    initTagPills();
  }

  init();
})();
