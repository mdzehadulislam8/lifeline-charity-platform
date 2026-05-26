/* ========================================
   UI ANIMATION HELPERS
   ======================================== */

/**
 * Initialize entrance animations on scroll
 * Elements with class 'enter-on-scroll' will animate when visible
 */
function initScrollAnimations() {
  const elements = document.querySelectorAll('.enter-on-scroll');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('enter');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/**
 * Animate numeric counters (count-up effect)
 * Usage: <div class="counter" data-target="1000">0</div>
 */
function initCounters() {
  const counters = document.querySelectorAll('.counter[data-target]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
  const target = Number(element.dataset.target) || 0;
  const duration = 1200; // milliseconds
  const increment = target / (duration / 16); // 60fps
  let current = 0;

  const updateCounter = () => {
    current += increment;
    if (current >= target) {
      element.textContent = new Intl.NumberFormat('en-BD').format(Math.round(target));
    } else {
      element.textContent = new Intl.NumberFormat('en-BD').format(Math.round(current));
      requestAnimationFrame(updateCounter);
    }
  };

  updateCounter();
}

/**
 * Animate progress bars
 * Usage: <div class="progress-bar-wrap"><div class="progress-bar" data-target="65"></div></div>
 */
function initProgressBars() {
  const bars = document.querySelectorAll('.progress-bar[data-target]');
  if (!bars.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = Number(entry.target.dataset.target) || 0;
        entry.target.style.width = Math.min(100, target) + '%';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  bars.forEach(bar => observer.observe(bar));
}

/**
 * Ripple effect on button clicks
 */
function initRippleEffect() {
  const buttons = document.querySelectorAll('button, .btn-primary, .btn-secondary, .btn-outline');
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');

      // Inject ripple CSS if not present
      if (!document.querySelector('style[data-ripple]')) {
        const style = document.createElement('style');
        style.setAttribute('data-ripple', 'true');
        style.textContent = `
          button, .btn-primary, .btn-secondary, .btn-outline {
            position: relative;
            overflow: hidden;
          }
          .ripple {
            position: absolute;
            background: rgba(255, 255, 255, 0.4);
            border-radius: 50%;
            pointer-events: none;
            animation: rippleEffect 600ms ease-out;
          }
          @keyframes rippleEffect {
            0% {
              transform: scale(0);
              opacity: 1;
            }
            100% {
              transform: scale(1);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }

      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

/**
 * Smooth fade-in for images
 */
function initLazyImageFade() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    if (img.complete) {
      img.style.opacity = '1';
    } else {
      img.style.opacity = '0';
      img.style.transition = 'opacity 600ms ease-out';
      img.onload = () => {
        img.style.opacity = '1';
      };
    }
  });
}

/**
 * Initialize all animation helpers on DOMContentLoaded
 */
function initializeAnimations() {
  initScrollAnimations();
  initCounters();
  initProgressBars();
  initRippleEffect();
  initLazyImageFade();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAnimations);
} else {
  initializeAnimations();
}

// Export for external use
if (typeof window !== 'undefined') {
  window.AnimationHelpers = {
    initScrollAnimations,
    initCounters,
    initProgressBars,
    initRippleEffect,
    initLazyImageFade,
    initializeAnimations,
    animateCounter
  };
}
