/**
 * transitions.js — Page transition system
 *
 * Подключи в каждой странице ПЕРЕД </body>:
 *   <script src="transitions.js"></script>
 *
 * Для задания цвета overlay на конкретной странице
 * добавь data-атрибут на <body> или <main>:
 *   <body data-transition-color="#FF6B1A">
 *
 * Если атрибут не задан — используется #1a1a2e (тёмный нейтральный).
 */

(function () {
  'use strict';

  /* ── Настройки ──────────────────────────────── */
  const TIMING = {
    pageOut:    400,   // ms — fade out текущей страницы
    waveIn:     350,   // ms — волна едет снизу вверх
    waveHold:   150,   // ms — пауза (overlay заполняет экран)
    waveOut:    350,   // ms — волна уходит вверх
    pageIn:     400,   // ms — fade in новой страницы
    pageIntro:  500,   // ms — fade in при первой загрузке
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

  function getTransitionColor(targetDoc) {
    // Ищем цвет на <body> или <main> целевой страницы
    const sources = targetDoc
      ? [targetDoc.body, targetDoc.querySelector('main')]
      : [document.body, document.querySelector('main')];

    for (const el of sources) {
      if (el && el.dataset.transitionColor) {
        return el.dataset.transitionColor;
      }
    }
    return DEFAULT_COLOR;
  }

  function isInternalLink(a) {
    // Игнорируем: внешние, якорные, target="_blank", download, javascript:
    if (!a.href)                          return false;
    if (a.target === '_blank')            return false;
    if (a.hasAttribute('download'))       return false;
    if (a.getAttribute('href').startsWith('#')) return false;
    if (a.protocol === 'javascript:')     return false;

    const isSameOrigin = a.origin === location.origin;
    const isSameFile   = a.pathname === location.pathname;

    // Внешний домен
    if (!isSameOrigin) return false;

    // Тот же файл — только якорь (уже отсеяли #anchor выше)
    // но если href = тот же путь без хэша — тоже не анимируем, чтобы не дёргать
    if (isSameFile && !a.hash) return false;
    if (isSameFile && a.hash)  return false; // якорная навигация на той же странице

    return true;
  }

  /* ── Состояние ──────────────────────────────── */
  let isNavigating = false;

  /* ── Очищаем все pt-* классы на body ────────── */
  function clearBodyClasses() {
    document.body.classList.remove('pt-intro', 'pt-exit', 'pt-enter', 'pt-ready');
  }

  function clearOverlayClasses() {
    overlay.classList.remove('pt-wave-in', 'pt-wave-hold', 'pt-wave-out');
  }

  /* ── Первая загрузка страницы ───────────────── */
  function introAnimation() {
    if (prefersReducedMotion()) {
      document.body.style.opacity = '1';
      return;
    }

    clearBodyClasses();
    document.body.classList.add('pt-intro');

    setTimeout(() => {
      clearBodyClasses();
      document.body.classList.add('pt-ready');
    }, TIMING.pageIntro);
  }

  /* ── Переход: текущая страница → новая ────────
   *
   * Сценарий:
   * 1. Получаем цвет overlay для целевой страницы
   * 2. Запускаем page-out (fade + scale) параллельно с wave-in
   * 3. Overlay держится TIMING.waveHold
   * 4. Переходим на новую страницу (location.href)
   *    — новая страница запустит introAnimation()
   *    — но overlay уже нарисован? Нет: overlay — часть DOM текущей страницы
   *    — поэтому на новой странице transition.js запустит обычный introAnimation
   *
   * Для SPA-подобного behaviour (без перезагрузки страницы) нужен fetch+replaceState —
   * это сложнее. Для многостраничного сайта стандартный переход через location.href
   * достаточен: новая страница появится с intro-анимацией.
   * ─────────────────────────────────────────────
   */
  function navigateTo(url, color) {
    if (isNavigating) return;
    isNavigating = true;

    if (prefersReducedMotion()) {
      location.href = url;
      return;
    }

    /* Устанавливаем цвет волны */
    overlay.style.backgroundColor = color;

    /* 1. Запускаем wave-in и page-out одновременно */
    clearBodyClasses();
    clearOverlayClasses();

    document.body.classList.add('pt-exit');
    overlay.classList.add('pt-wave-in');

    /* 2. После wave-in — держим overlay */
    setTimeout(() => {
      clearOverlayClasses();
      overlay.classList.add('pt-wave-hold');

      /* 3. Переходим на новую страницу */
      setTimeout(() => {
        location.href = url;
      }, TIMING.waveHold);

    }, TIMING.waveIn);
  }

  /* ── Обработчик кликов (делегирование) ─────── */
  document.addEventListener('click', function (e) {
    // Ищем ближайший <a> от цели клика
    const a = e.target.closest('a');
    if (!a) return;
    if (!isInternalLink(a)) return;

    e.preventDefault();

    const url   = a.href;
    const color = a.dataset.transitionColor  // можно задать на самой ссылке
                || getTransitionColor();       // или читаем с body/main целевой страницы

    // Примечание: цвет целевой страницы мы не знаем заранее (нет fetch).
    // Правильный workflow: задавать data-transition-color на <a> ссылках
    // или читать с текущего body (можно закодировать маппинг URL → цвет).
    navigateTo(url, color);
  });

  /* ── Запуск intro при загрузке ──────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', introAnimation);
  } else {
    // DOM уже готов (скрипт в конце body)
    introAnimation();
  }

  /* ── Восстановление при popstate (кнопка "назад") ── */
  window.addEventListener('pageshow', function (e) {
    // При bfcache (быстрое восстановление из кэша браузера)
    // страница не перезагружается — нужно убрать overlay и вернуть opacity
    if (e.persisted) {
      isNavigating = false;
      clearBodyClasses();
      clearOverlayClasses();
      overlay.style.backgroundColor = '';
      overlay.style.clipPath = 'inset(100% 0 0 0)';
      document.body.style.opacity = '';
      document.body.classList.add('pt-ready');
    }
  });

})();
