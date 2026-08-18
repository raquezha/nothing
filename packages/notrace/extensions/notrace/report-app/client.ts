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

    function escapeHtmlClient(str) {
      if (str == null) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function renderJsonBlockClient(title, val) {
      const text = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
      return '<section class="block"><h4>' + escapeHtmlClient(title) + '</h4><pre>' + escapeHtmlClient(text) + '</pre></section>';
    }
    function renderEventBodyClient(ev) {
      if (!ev) return '';
      let html = '';
      if (ev.type === 'llm_completion') {
        if (ev.inputPayload && ev.inputPayload.messages && ev.inputPayload.messages.length) {
          let msgs = ev.inputPayload.messages.map(m => {
            let content = typeof m.content === 'string' ? '<div class="chat-text">' + escapeHtmlClient(m.content) + '</div>' : '<pre class="chat-tool-body">' + escapeHtmlClient(JSON.stringify(m.content || '', null, 2)) + '</pre>';
            return '<div class="msg ' + escapeHtmlClient(m.role || '') + '"><div class="msg-head"><span class="msg-role">' + escapeHtmlClient(m.role || '') + '</span></div><div class="msg-content">' + content + '</div></div>';
          }).join('');
          html += '<section class="block"><h4>Input Messages</h4>' + msgs + '</section>';
        }
        if (ev.stopReason && ev.stopReason !== 'stop' && ev.stopReason !== 'toolUse') html += renderJsonBlockClient('Stop Reason', ev.stopReason);
        if (ev.errorMessage) html += renderJsonBlockClient('Error Message', ev.errorMessage);
        let out = typeof ev.outputContent === 'string' ? '<div class="chat-text">' + escapeHtmlClient(ev.outputContent) + '</div>' : '<pre class="chat-tool-body">' + escapeHtmlClient(JSON.stringify(ev.outputContent || '', null, 2)) + '</pre>';
        html += '<section class="block"><h4>Output</h4><div class="msg-content">' + out + '</div></section>';
        if (ev.usage) html += renderJsonBlockClient('Usage', ev.usage);
      } else if (ev.type === 'tool_start') {
        let args = typeof ev.args === 'string' ? ev.args : JSON.stringify(ev.args, null, 2);
        html += '<section class="block"><h4>Arguments</h4><div class="msg-content"><div class="chat-tool-use"><div class="chat-tool-header">Execution Input</div><pre class="chat-tool-body">' + escapeHtmlClient(args) + '</pre></div></div></section>';
      } else if (ev.type === 'tool_end') {
        let res = typeof ev.result === 'string' ? ev.result : JSON.stringify(ev.result, null, 2);
        let title = ev.isError ? 'Error Result' : 'Result';
        html += '<section class="block"><h4>' + title + '</h4><div class="msg-content"><div class="chat-tool-use"><div class="chat-tool-header">Execution Output</div><pre class="chat-tool-body">' + escapeHtmlClient(res) + '</pre></div></div></section>';
      } else {
        let details = {};
        if (ev.epochId != null) details.epochId = ev.epochId;
        if (ev.workerId != null) details.workerId = ev.workerId;
        if (ev.reason != null) details.reason = ev.reason;
        if (ev.tokensBefore != null) details.tokensBefore = ev.tokensBefore;
        if (ev.tokensAfter != null) details.tokensAfter = ev.tokensAfter;
        html += renderJsonBlockClient(Object.keys(details).length > 0 ? 'Boundary Details' : 'Event', Object.keys(details).length > 0 ? details : ev);
      }
      return '<div class="event-body"><div class="stack">' + html + '</div></div>';
    }

    document.querySelectorAll('details[data-lazy-event-body], details[data-lazy-event-index]').forEach((details) => {
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        if (details.querySelector('.event-body')) return;
        if (details.hasAttribute('data-lazy-event-body')) {
          const html = decodeURIComponent(details.getAttribute('data-lazy-event-body') || '');
          details.insertAdjacentHTML('beforeend', html);
        } else if (details.hasAttribute('data-lazy-event-index')) {
          const idx = parseInt(details.getAttribute('data-lazy-event-index') || '0', 10);
          const dataEl = document.getElementById('notrace-data');
          if (!dataEl) return;
          try {
            if (!window.__NOTRACE_DATA__) {
              window.__NOTRACE_DATA__ = JSON.parse(dataEl.textContent || '{}');
            }
            const events = window.__NOTRACE_DATA__?.events || [];
            const visibleEvents = events.filter(e => e.type !== 'session_start' && e.type !== 'turn_start');
            const ev = visibleEvents[idx] || events[idx];
            if (ev) {
              details.insertAdjacentHTML('beforeend', renderEventBodyClient(ev));
            }
          } catch {}
        }
      }, { once: false });
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
