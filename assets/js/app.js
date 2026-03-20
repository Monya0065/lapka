(function () {
  const LANG_KEY = 'vet_demo_lang';
  const SUPPORTED = ['ru'];

  function getPreferredLang() {
    return 'ru';
  }

  function updateLangUI(lang) {
    document.documentElement.lang = lang;

    const titleEl = document.querySelector('title[data-ru][data-en]');
    if (titleEl) {
      titleEl.textContent = titleEl.dataset[lang] || titleEl.textContent;
      document.title = titleEl.textContent;
    }

    const metaDesc = document.querySelector('meta[name="description"][data-ru][data-en]');
    if (metaDesc) {
      metaDesc.setAttribute('content', metaDesc.dataset[lang] || metaDesc.getAttribute('content') || '');
    }

    document.querySelectorAll('[data-ru][data-en]').forEach(function (el) {
      if (el.tagName === 'TITLE' || el.tagName === 'META') {
        return;
      }
      const value = el.dataset[lang];
      if (typeof value !== 'string') {
        return;
      }
      if (el.hasAttribute('data-lang-html')) {
        el.innerHTML = value;
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = value;
      } else {
        el.textContent = value;
      }
    });

    document.querySelectorAll('[data-placeholder-ru][data-placeholder-en]').forEach(function (el) {
      const key = lang === 'en' ? 'placeholderEn' : 'placeholderRu';
      const next = el.dataset[key];
      if (next) {
        el.setAttribute('placeholder', next);
      }
    });

    document.querySelectorAll('[data-alt-ru][data-alt-en]').forEach(function (el) {
      const key = lang === 'en' ? 'altEn' : 'altRu';
      const next = el.dataset[key];
      if (next) {
        el.setAttribute('alt', next);
      }
    });

    document.querySelectorAll('[data-aria-label-ru][data-aria-label-en]').forEach(function (el) {
      const key = lang === 'en' ? 'ariaLabelEn' : 'ariaLabelRu';
      const next = el.dataset[key];
      if (next) {
        el.setAttribute('aria-label', next);
      }
    });

    document.querySelectorAll('[data-title-ru][data-title-en]').forEach(function (el) {
      const key = lang === 'en' ? 'titleEn' : 'titleRu';
      const next = el.dataset[key];
      if (next) {
        el.setAttribute('title', next);
      }
    });

    document.querySelectorAll('.lang-toggle').forEach(function (btn) {
      btn.style.display = 'none';
      btn.setAttribute('aria-hidden', 'true');
    });
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, 'ru');
    updateLangUI('ru');
  }

  function initLanguageToggle() {
    const initial = getPreferredLang();
    updateLangUI(initial);
  }

  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.site-nav');
    if (!toggle || !nav) {
      return;
    }

    function closeNav() {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      const next = !nav.classList.contains('open');
      nav.classList.toggle('open', next);
      toggle.setAttribute('aria-expanded', String(next));
    });

    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeNav);
    });

    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('open')) {
        return;
      }
      if (!nav.contains(event.target) && event.target !== toggle) {
        closeNav();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeNav();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 880) {
        closeNav();
      }
    });
  }

  function initDemoModal() {
    const modal = document.querySelector('#demoModal');
    if (!modal) {
      return;
    }

    const closeBtn = modal.querySelector('[data-close-modal]');
    let lastTrigger = null;

    function close() {
      modal.setAttribute('aria-hidden', 'true');
      if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus();
      }
    }

    function open(triggerBtn) {
      lastTrigger = triggerBtn || null;
      modal.setAttribute('aria-hidden', 'false');
      const first = modal.querySelector('input, button, textarea, select');
      if (first) {
        first.focus();
      }
    }

    document.querySelectorAll('[data-open-demo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        open(btn);
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        close();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        close();
      }
    });

    const form = modal.querySelector('form');
    const msg = modal.querySelector('[data-demo-result]');
    if (form && msg) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        msg.textContent = document.documentElement.lang === 'en'
          ? 'Demo request submitted. We will contact you shortly.'
          : 'Запрос на демо отправлен. Мы свяжемся с вами в ближайшее время.';
        form.reset();
      });
    }
  }

  function initTabs() {
    const holders = document.querySelectorAll('[data-tabs]');
    holders.forEach(function (holder) {
      const buttons = holder.querySelectorAll('[data-tab-target]');
      const panels = holder.querySelectorAll('[data-tab-panel]');
      function activate(id) {
        buttons.forEach(function (btn) {
          const active = btn.dataset.tabTarget === id;
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-selected', String(active));
        });
        panels.forEach(function (panel) {
          const active = panel.id === id;
          panel.classList.toggle('active', active);
          panel.hidden = !active;
        });
      }
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          activate(btn.dataset.tabTarget);
        });
      });
      if (buttons[0]) {
        activate(buttons[0].dataset.tabTarget);
      }
    });
  }

  function initFakeAuth() {
    const forms = document.querySelectorAll('[data-demo-auth]');
    forms.forEach(function (form) {
      const result = form.querySelector('[data-auth-result]');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (result) {
          result.textContent = document.documentElement.lang === 'en'
            ? 'Demo action complete. This is a static UI without backend.'
            : 'Демо-действие выполнено. Это статический интерфейс без бэкенда.';
        }
      });
    });

    const twoFa = document.querySelector('#twoFaForm');
    if (twoFa) {
      const codeInput = twoFa.querySelector('input[name="code"]');
      const msg = twoFa.querySelector('[data-2fa-result]');
      twoFa.addEventListener('submit', function (e) {
        e.preventDefault();
        const code = (codeInput.value || '').trim();
        if (code === '123456') {
          msg.textContent = document.documentElement.lang === 'en'
            ? '2FA success. Demo access granted.'
            : '2FA успешна. Демо-доступ предоставлен.';
          msg.style.color = '#177245';
        } else {
          msg.textContent = document.documentElement.lang === 'en'
            ? 'Invalid demo code. Try 123456.'
            : 'Неверный демо-код. Используйте 123456.';
          msg.style.color = '#9e2f1e';
        }
      });
    }
  }

  function initCabinetRoleSwitch() {
    const select = document.querySelector('#roleSwitcher');
    if (!select) {
      return;
    }
    const roleBlocks = document.querySelectorAll('[data-role-panel]');
    function apply(role) {
      roleBlocks.forEach(function (block) {
        block.hidden = block.dataset.rolePanel !== role;
      });
    }
    select.addEventListener('change', function () {
      apply(select.value);
    });
    apply(select.value);
  }

  function initSafetyBanner() {
    const container = document.querySelector('main .container');
    if (!container || container.querySelector('[data-global-safety]')) {
      return;
    }

    const banner = document.createElement('section');
    banner.className = 'section safety-banner';
    banner.setAttribute('data-global-safety', 'true');
    banner.innerHTML =
      '<strong data-ru="Важно для безопасности:" data-en="Safety first:">Важно для безопасности:</strong>' +
      '<div>' +
      '<p class="small" data-ru="Сервис оценивает только срочность (GREEN / YELLOW / RED). Это не диагноз и не лечение." data-en="The service provides urgency only (GREEN / YELLOW / RED). It is not diagnosis and not treatment.">Сервис оценивает только срочность (GREEN / YELLOW / RED). Это не диагноз и не лечение.</p>' +
      '<div class="safety-points">' +
      '<span class="safety-chip" data-ru="Без лекарств" data-en="No medication advice">Без лекарств</span>' +
      '<span class="safety-chip" data-ru="Без диагнозов" data-en="No diagnosis">Без диагнозов</span>' +
      '<span class="safety-chip" data-ru="При ухудшении — срочно в клинику" data-en="If condition worsens, seek urgent care">При ухудшении — срочно в клинику</span>' +
      '</div>' +
      '</div>';

    const sections = Array.from(container.children).filter(function (child) {
      return child.classList && child.classList.contains('section');
    });
    if (sections.length > 1) {
      container.insertBefore(banner, sections[1]);
    } else {
      container.appendChild(banner);
    }
  }

  function initTableHints() {
    document.querySelectorAll('.table-wrap').forEach(function (wrap) {
      const next = wrap.nextElementSibling;
      if (next && next.classList.contains('table-hint')) {
        return;
      }
      const hint = document.createElement('p');
      hint.className = 'small table-hint';
      hint.setAttribute('data-ru', 'Если таблица не помещается, прокрутите ее по горизонтали.');
      hint.setAttribute('data-en', 'If the table does not fit, scroll horizontally.');
      hint.textContent = 'Если таблица не помещается, прокрутите ее по горизонтали.';
      wrap.insertAdjacentElement('afterend', hint);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initSafetyBanner();
    initTableHints();
    initLanguageToggle();
    initMobileNav();
    initDemoModal();
    initTabs();
    initFakeAuth();
    initCabinetRoleSwitch();
  });
})();
