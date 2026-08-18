export const COPY_SCRIPT = `(() => {
    document.querySelectorAll('[data-copy-value]').forEach((button) => {
      button.addEventListener('click', async () => {
        const value = button.getAttribute('data-copy-value') || '';
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
          }
          const previous = button.innerHTML;
          button.classList.add('copied');
          button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';
          setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = previous;
          }, 1400);
        } catch {
          button.textContent = 'ERR';
        }
      });
    });

    document.querySelectorAll('details[data-lazy-event-body]').forEach((details) => {
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        if (details.querySelector('.event-body')) return;
        const html = decodeURIComponent(details.getAttribute('data-lazy-event-body') || '');
        const template = document.createElement('template');
        template.innerHTML = html;
        details.appendChild(template.content.cloneNode(true));
      }, { once: false });
    });

    document.querySelectorAll('[data-back-link="true"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (window.history.length <= 1) return;
        event.preventDefault();
        window.history.back();
      });
    });

    const topBtn = document.querySelector('.back-to-top');
    if (topBtn) {
      const syncTopButton = () => {
        const scrollable = document.documentElement.scrollHeight > window.innerHeight + 24;
        const show = scrollable && window.scrollY > 200;
        topBtn.classList.toggle('visible', show);
      };
      window.addEventListener('scroll', syncTopButton, { passive: true });
      window.addEventListener('resize', syncTopButton);
      syncTopButton();
    }
  })();`;

export const DASHBOARD_SORT_SCRIPT = `(() => {
    const table = document.querySelector('[data-dashboard-table]');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const buttons = Array.from(document.querySelectorAll('[data-sort-key]'));
    let currentKey = 'index';
    let currentDir = 'desc';

    function icon(dir) {
      return dir === 'asc' ? '↑' : '↓';
    }

    function updateState() {
      buttons.forEach(btn => {
        const key = btn.getAttribute('data-sort-key');
        const state = btn.querySelector('.sort-state');
        if (!state) return;
        state.textContent = key === currentKey ? icon(currentDir) : '';
      });
    }

    function compare(a, b, key) {
      if (key === 'index' || key === 'started' || key === 'tokens' || key === 'cost') {
        return Number(a.dataset[key] || 0) - Number(b.dataset[key] || 0);
      }
      return String(a.dataset[key] || '').localeCompare(String(b.dataset[key] || ''));
    }

    function sortBy(key) {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const result = compare(a, b, key);
        return currentDir === 'asc' ? result : -result;
      });
      rows.forEach(row => tbody.appendChild(row));
      updateState();
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-sort-key') || 'index';
        if (currentKey === key) currentDir = currentDir === 'asc' ? 'desc' : 'asc';
        else {
          currentKey = key;
          currentDir = key === 'workflow' ? 'asc' : 'desc';
        }
        sortBy(currentKey);
      });
    });

    sortBy(currentKey);
  })();`;
