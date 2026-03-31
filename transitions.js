/**
 * transitions.js — Page & Section transition system
 *
 * Подключи перед </body>:
 *   <script src="transitions.js"></script>
 *
 * Для page transition задай на <body>:
 *   <body data-transition-color="#xxxxxx">
 */

(function () {
  'use strict';

  /* ── Настройки ──────────────────────────────── */
  const TIMING = {
    waveIn:    320,   // ms — волна едет снизу вверх
    waveHold:  80,    // ms — пауза под overlay
    waveOut:   320,   // ms — волна уходит вверх
    sectionIn: 380,   // ms — fade-in целевой секции
    pageIntro: 500,   // ms — fade-in при первой загрузке
  };

  /* Цвет overlay для каждой секции */
  const SECTION_COLORS = {
    hero: '#7B52E8',
    cs2:  '#FF6B1A',
    dota: '#C0392B',
    fifa: '#0099FF',
    pubg: '#F5C518',
  };

  const DEFAULT_COLOR = '#1a1a2e';

  /* ── Создание overlay ───────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'pt-overlay';
  document.body.appendChild(overlay);

  /* ── Утилиты ────────────────────────────────── */

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Какая секция сейчас видна больше всего */
  function getCurrentSection() {
    const ids = ['hero', 'cs2', 'dota', 'fifa', 'pubg'];
    let best = null, bestArea = 0;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (visible > bestArea) { bestArea = visible; best = el; }
    }
    return best;
  }

  /* Сбросить overlay в исходное состояние (спрятан снизу) */
  function resetOverlay() {
    overlay.className = '';
    overlay.style.clipPath = 'inset(100% 0 0 0)';
    overlay.style.backgroundColor = '';
  }

  /* ── Анимация секции: fade + scale ─────────── */
  function animateSectionIn(el) {
    el.style.transition = 'none';
    el.style.opacity    = '0';
    el.style.transform  = 'scale(0.98)';

    // Форсируем reflow перед запуском transition
    void el.offsetHeight;

    el.style.transition = `opacity ${TIMING.sectionIn}ms ease, transform ${TIMING.sectionIn}ms ease`;
    el.style.opacity    = '1';
    el.style.transform  = 'scale(1)';

    setTimeout(() => {
      el.style.transition = '';
      el.style.opacity    = '';
      el.style.transform  = '';
    }, TIMING.sectionIn);
  }

  /* ── Переход к секции ───────────────────────── */
  let isAnimating = false;

  function navigateToSection(targetId) {
    if (isAnimating) return;

    const target = document.getElementById(targetId);
    if (!target) return;

    /* Не анимируем переход к той же секции */
    const current = getCurrentSection();
    if (current && current.id === targetId) return;

    if (prefersReducedMotion()) {
      target.scrollIntoView({ behavior: 'instant' });
      return;
    }

    isAnimating = true;

    const color = SECTION_COLORS[targetId] || DEFAULT_COLOR;
    overlay.style.backgroundColor = color;

    /* 1. Волна едет снизу вверх */
    overlay.className = 'pt-wave-in';

    setTimeout(() => {
      /* 2. Overlay закрыл экран — мгновенно прыгаем к секции */
      overlay.className = 'pt-wave-hold';
      target.scrollIntoView({ behavior: 'instant' });

      setTimeout(() => {
        /* 3. Подготовить секцию невидимой перед началом открытия */
        target.style.transition = 'none';
        target.style.opacity    = '0';
        target.style.transform  = 'scale(0.98)';
        void target.offsetHeight;

        /* 4. Волна уходит вверх */
        overlay.className = 'pt-wave-out';

        /* 5. Fade-in секции — начинаем чуть раньше окончания волны */
        setTimeout(() => {
          animateSectionIn(target);

          setTimeout(() => {
            resetOverlay();
            isAnimating = false;
          }, TIMING.waveOut - 80);

        }, 60);

      }, TIMING.waveHold);

    }, TIMING.waveIn);
  }

  /* ── Перехват кликов по якорным ссылкам ─────── */
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href || !href.startsWith('#')) return;

    const targetId = href.slice(1);
    if (!document.getElementById(targetId)) return;

    /* Не анимируем ссылку на #hero (лого) — просто скроллим */
    if (targetId === 'hero') {
      e.preventDefault();
      if (prefersReducedMotion()) {
        document.getElementById('hero').scrollIntoView({ behavior: 'instant' });
      } else {
        navigateToSection('hero');
      }
      return;
    }

    e.preventDefault();
    navigateToSection(targetId);
  });

  /* ── Перехват scroll2() ─────────────────────── */
  /* scroll2 вызывается из onclick на кнопках.
     Переопределяем после DOMContentLoaded чтобы
     не конфликтовать с определением в <script>. */
  window.addEventListener('DOMContentLoaded', function () {
    window.scroll2 = function (id) {
      navigateToSection(id);
    };
  });

  /* ── Первая загрузка страницы ───────────────── */
  function introAnimation() {
    if (prefersReducedMotion()) {
      document.body.style.opacity = '1';
      return;
    }
    document.body.classList.add('pt-intro');
    setTimeout(() => {
      document.body.classList.remove('pt-intro');
      document.body.classList.add('pt-ready');
    }, TIMING.pageIntro);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', introAnimation);
  } else {
    introAnimation();
  }

  /* ── Page transitions (для межстраничной навигации) ── */
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return;          // якоря — уже обработали
    if (a.target === '_blank') return;
    if (a.hasAttribute('download')) return;
    if (a.protocol === 'javascript:') return;
    if (a.origin !== location.origin) return;           // внешние
    if (a.pathname === location.pathname && !a.hash) return; // та же страница

    e.preventDefault();

    if (prefersReducedMotion()) {
      location.href = a.href;
      return;
    }

    if (isAnimating) return;
    isAnimating = true;

    const color = a.dataset.transitionColor
      || document.body.dataset.transitionColor
      || DEFAULT_COLOR;

    overlay.style.backgroundColor = color;
    overlay.className = 'pt-wave-in';

    document.body.classList.add('pt-exit');

    setTimeout(() => {
      location.href = a.href;
    }, TIMING.waveIn + TIMING.waveHold);
  });

  /* ── bfcache: кнопка "назад" ────────────────── */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      isAnimating = false;
      resetOverlay();
      document.body.classList.remove('pt-exit', 'pt-intro', 'pt-ready');
      document.body.style.opacity = '1';
    }
  });

})();
