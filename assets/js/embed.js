(function () {
  function resizeIframe(iframe) {
    if (!iframe || !iframe.contentWindow) {
      return;
    }

    try {
      const doc = iframe.contentWindow.document;
      const height = Math.max(
        doc.body ? doc.body.scrollHeight : 0,
        doc.documentElement ? doc.documentElement.scrollHeight : 0
      );
      if (height > 0) {
        iframe.style.height = Math.min(Math.max(height + 24, 520), 2200) + 'px';
      }
    } catch (err) {
      if (!iframe.dataset.fallbackLinked) {
        iframe.dataset.fallbackLinked = 'true';
        const link = iframe.parentElement && iframe.parentElement.querySelector('[data-module-link]');
        if (link) {
          link.hidden = false;
        }
      }
    }
  }

  function initAutoFrames() {
    const frames = document.querySelectorAll('iframe[data-auto-height]');
    frames.forEach(function (frame) {
      frame.addEventListener('load', function () {
        resizeIframe(frame);
        setTimeout(function () {
          resizeIframe(frame);
        }, 150);
      });
    });

    setInterval(function () {
      frames.forEach(resizeIframe);
    }, 1200);
  }

  window.addEventListener('message', function (event) {
    if (!event.data || typeof event.data !== 'object') {
      return;
    }
    if (event.data.type !== 'moduleHeight') {
      return;
    }
    const frame = document.querySelector('iframe[src$="' + event.data.module + '"]');
    if (frame && Number.isFinite(event.data.height)) {
      frame.style.height = Math.min(Math.max(event.data.height + 24, 520), 2200) + 'px';
    }
  });

  document.addEventListener('DOMContentLoaded', initAutoFrames);
})();
