// Extract latest assistant message from ChatGPT web UI.
// Intended to be executed via browser "evaluate" in the page context.
// Returns: { ok, text, links:[{href,text}], html, error }

(function () {
  function norm(s) {
    return (s || "").replace(/\u00a0/g, " ").replace(/[\t\r]+/g, " ").trim();
  }

  try {
    // Heuristic: pick the last element that looks like an assistant message.
    // ChatGPT DOM changes often, so we avoid brittle selectors.
    const candidates = [];

    // 1) Try role-based containers.
    document.querySelectorAll('[role="article"], article, main, [data-message-author-role]').forEach(el => {
      const role = el.getAttribute('data-message-author-role');
      if (role === 'assistant') candidates.push(el);
    });

    // 2) Fallback: look for blocks containing typical citation links.
    if (candidates.length === 0) {
      document.querySelectorAll('main a').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('http') || href.startsWith('https')) {
          const container = a.closest('article') || a.closest('[role="article"]') || a.closest('div');
          if (container) candidates.push(container);
        }
      });
    }

    // De-dup
    const uniq = [];
    const seen = new Set();
    for (const el of candidates) {
      if (!el) continue;
      const key = el;
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(el);
    }

    const last = uniq.length ? uniq[uniq.length - 1] : null;
    if (!last) {
      return { ok: false, error: 'No assistant message container found.' };
    }

    const text = norm(last.innerText);
    const links = Array.from(last.querySelectorAll('a'))
      .map(a => ({ href: a.href, text: norm(a.textContent) }))
      .filter(x => x.href && (x.href.startsWith('http://') || x.href.startsWith('https://')));

    return {
      ok: true,
      text,
      links,
      html: last.innerHTML,
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
})();
