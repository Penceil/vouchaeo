/* ==========================================================================
   Laud — interactions
   ========================================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --- Form delivery ---------------------------------------------------------
   Submissions are emailed by Web3Forms. The recipient address is baked into
   the access key, so it can only ever deliver to the inbox that key was
   issued for — it is safe to ship in client-side code.
   -------------------------------------------------------------------------- */
const WEB3FORMS_KEY = '3a70cbdc-7118-4855-aca0-bbb1ed94e8bc';

async function sendToInbox(fields) {
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ access_key: WEB3FORMS_KEY, ...fields }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.message || `Delivery failed (${response.status})`);
  }
  return result;
}

/* --- Hero: rotate the engine name strip every 2s --------------------------- */
(function initEngineRotator() {
  const rotator = document.getElementById('engine-rotator');
  if (!rotator) return;

  const engines = [...rotator.querySelectorAll('.engine')];
  if (engines.length < 2 || reduceMotion) return;

  let index = 0;

  setInterval(() => {
    const current = engines[index];
    index = (index + 1) % engines.length;
    const next = engines[index];

    current.classList.remove('is-active');
    current.classList.add('is-leaving');
    next.classList.add('is-active');

    setTimeout(() => current.classList.remove('is-leaving'), 450);
  }, 2000);
})();

/* --- Smooth-scroll CTAs to the visibility checker -------------------------- */
(function initScrollButtons() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-scroll]');
    if (!trigger) return;

    event.preventDefault();
    const target = document.getElementById(trigger.dataset.scroll);
    if (!target) return;

    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

    // drop focus onto the first empty field so they can start typing
    const first = [...target.querySelectorAll('input')].find((i) => !i.value) || target.querySelector('input');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), reduceMotion ? 0 : 500);
  });
})();

/* --- Mobile navigation ---------------------------------------------------- */
(function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('mobile-nav');
  if (!toggle || !nav) return;

  function close() {
    nav.hidden = true;
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    const open = nav.hidden;
    nav.hidden = !open;
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1180) close();
  });
})();

/* --- "See AEO in action": tabs + staged answer reveal ---------------------- */
(function initSimulator() {
  const tabs = [...document.querySelectorAll('.aeo__tab')];
  const panes = [...document.querySelectorAll('.sim__pane')];
  if (!tabs.length || !panes.length) return;

  let timers = [];

  function play(pane) {
    timers.forEach(clearTimeout);
    timers = [];

    const steps = [...pane.querySelectorAll('[data-reveal]')]
      .sort((a, b) => Number(a.dataset.reveal) - Number(b.dataset.reveal));

    steps.forEach((el) => el.classList.remove('is-in'));
    pane.classList.add('is-playing');
    pane.scrollTop = 0;

    steps.forEach((el, i) => {
      const delay = reduceMotion ? 0 : 90 + i * 170;
      timers.push(setTimeout(() => el.classList.add('is-in'), delay));
    });
  }

  // let the checker replay whichever pane is showing after it personalizes it
  window.__replayPane = play;

  function select(name) {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    panes.forEach((pane) => {
      const active = pane.dataset.pane === name;
      pane.hidden = !active;
      if (active) play(pane);
    });
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => select(tab.dataset.tab)));

  // play the default pane once it scrolls into view
  const stage = document.querySelector('.aeo__panel');
  const initial = tabs.find((t) => t.classList.contains('is-active')) || tabs[0];

  if (stage && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        select(initial.dataset.tab);
        io.disconnect();
      });
    }, { threshold: 0.2 });
    io.observe(stage);
  } else {
    select(initial.dataset.tab);
  }
})();

/* --- Click-through chart: grow the bars when the section scrolls in ------- */
(function initChart() {
  const chart = document.querySelector('.chart');
  if (!chart) return;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    chart.classList.add('is-in');
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      chart.classList.add('is-in');
      io.disconnect();
    });
  }, { threshold: 0.35 });

  io.observe(chart);
})();

/* --- Reveal-on-scroll: dashboard + proof bars animate when they enter view - */
(function initReveals() {
  const targets = [...document.querySelectorAll('.dash, .proof-sec')];
  if (!targets.length) return;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.3 });

  targets.forEach((el) => io.observe(el));
})();

/* --- Six AI Agents: sync the stacked module visual with the active agent --- */
(function initAgents() {
  const agents = [...document.querySelectorAll('.agent')];
  const visuals = [...document.querySelectorAll('[data-agent-visual]')];
  if (!agents.length || !visuals.length) return;

  const panel = document.getElementById('agent-panel');
  const isTabs = () => window.matchMedia('(max-width: 680px)').matches;

  function activate(id) {
    agents.forEach((a) => a.classList.toggle('is-active', a.dataset.agent === id));
    visuals.forEach((v) => v.classList.toggle('is-active', v.dataset.agentVisual === id));

    // the phone layout shows the copy under the artwork instead of in the tab
    if (panel) {
      const active = agents.find((a) => a.dataset.agent === id);
      panel.textContent = active?.querySelector('.agent__text p')?.textContent || '';
    }
  }

  agents.forEach((agent) => {
    const id = agent.dataset.agent;
    // hovering a tab strip on touch would fire on scroll, so only bind it on desktop
    agent.addEventListener('mouseenter', () => { if (!isTabs()) activate(id); });
    agent.addEventListener('focus', () => activate(id));
    agent.addEventListener('click', () => activate(id));
  });

  activate(document.querySelector('.agent.is-active')?.dataset.agent || '1');
})();

/* --- FAQ accordion -------------------------------------------------------- */
(function initFaq() {
  const items = [...document.querySelectorAll('.faq__item')];
  if (!items.length) return;

  items.forEach((item) => {
    const top = item.querySelector('.faq__top');
    if (!top) return;

    top.addEventListener('click', () => {
      const willOpen = !item.classList.contains('is-open');

      items.forEach((other) => {
        other.classList.remove('is-open');
        other.querySelector('.faq__top')?.setAttribute('aria-expanded', 'false');
      });

      if (willOpen) {
        item.classList.add('is-open');
        top.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

/* --- Modal plumbing ------------------------------------------------------- */
const Modals = (function initModals() {
  const open = [];

  function show(id) {
    const modal = document.getElementById(id);
    if (!modal || open.includes(modal)) return;

    modal.hidden = false;
    document.body.classList.add('is-locked');
    open.push(modal);

    const focusable = modal.querySelector(
      'input:not([type="hidden"]), select, textarea, button:not(.modal__close)'
    );
    (focusable || modal.querySelector('.modal__close'))?.focus({ preventScroll: true });
  }

  function hide(modal) {
    if (!modal) return;
    modal.hidden = true;
    const i = open.indexOf(modal);
    if (i > -1) open.splice(i, 1);
    if (!open.length) document.body.classList.remove('is-locked');
  }

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open-modal]');
    if (opener) {
      event.preventDefault();
      show(opener.dataset.openModal);
      return;
    }

    const closer = event.target.closest('[data-close-modal]');
    if (closer) {
      event.preventDefault();
      hide(closer.closest('.modal'));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open.length) hide(open[open.length - 1]);
  });

  return { show, hide };
})();

/* --- Book a demo: multi-step wizard --------------------------------------- */
(function initWizard() {
  const form = document.getElementById('demo-form');
  if (!form) return;

  const steps = [...form.querySelectorAll('.wiz__step')];
  const done = form.querySelector('.wiz__done');
  const actions = form.querySelector('.wiz__actions');
  const backBtn = document.getElementById('wiz-back');
  const nextBtn = document.getElementById('wiz-next');
  const bar = document.getElementById('wiz-bar');
  const counter = document.getElementById('wiz-step-num');
  const total = steps.length;

  let current = 1;

  function nextLabel() {
    return current === total
      ? 'Book my demo<span class="btn-solid__arrow">→</span>'
      : 'Continue<span class="btn-solid__arrow">→</span>';
  }

  function render() {
    steps.forEach((step) => step.classList.toggle('is-active', Number(step.dataset.step) === current));
    backBtn.hidden = current === 1;
    nextBtn.innerHTML = nextLabel();
    bar.style.width = `${(current / total) * 100}%`;
    counter.textContent = String(current);
  }

  function labelFor(field) {
    const wrap = field.closest('.field');
    const text = wrap?.querySelector('.field__label')?.textContent || field.name;
    return text.replace('*', '').replace('(optional)', '').trim();
  }

  function validate(step) {
    const error = step.querySelector('[data-error]');
    error.textContent = '';
    step.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    step.querySelector('.consent')?.classList.remove('is-invalid');

    // radio group
    const radios = [...step.querySelectorAll('input[type="radio"][required]')];
    if (radios.length && !radios.some((r) => r.checked)) {
      error.textContent = 'Pick the option that fits best so we can prep the right demo.';
      return false;
    }

    // text / select fields
    const fields = [...step.querySelectorAll('input[required], select[required], textarea[required]')]
      .filter((f) => f.type !== 'radio' && f.type !== 'checkbox');

    for (const field of fields) {
      const value = field.value.trim();

      if (!value) {
        field.classList.add('is-invalid');
        error.textContent = `${labelFor(field)} is required.`;
        field.focus();
        return false;
      }
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        field.classList.add('is-invalid');
        error.textContent = 'That email address does not look right.';
        field.focus();
        return false;
      }
      if (field.name === 'website' && !/^([a-z0-9-]+\.)+[a-z]{2,}/i.test(value.replace(/^https?:\/\//, ''))) {
        field.classList.add('is-invalid');
        error.textContent = 'Enter a website like youragency.com.';
        field.focus();
        return false;
      }
    }

    // consent last, so a missing answer above is surfaced first
    const consent = step.querySelector('input[type="checkbox"][required]');
    if (consent && !consent.checked) {
      consent.closest('.consent')?.classList.add('is-invalid');
      error.textContent = 'Please accept the terms and privacy policy to continue.';
      return false;
    }

    return true;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const step = steps[current - 1];
    if (!validate(step)) return;

    if (current < total) {
      current += 1;
      render();
      form.querySelector('.wiz__step.is-active')?.scrollTo({ top: 0 });
      return;
    }

    // finished — deliver it, then show the confirmation
    submit(step);
  });

  async function submit(step) {
    const error = step.querySelector('[data-error]');
    const data = new FormData(form);
    const get = (k) => String(data.get(k) || '').trim();
    const email = get('email');
    const name = `${get('firstName')} ${get('lastName')}`.trim();

    error.textContent = '';
    nextBtn.setAttribute('aria-busy', 'true');
    nextBtn.textContent = 'Sending…';

    try {
      await sendToInbox({
        subject: `New demo request — ${name || email} (${get('company') || 'no company'})`,
        from_name: name || 'Laud website',
        replyto: email,
        botcheck: data.get('botcheck') ? 'true' : '',
        'What brings them here': get('intent'),
        'First name': get('firstName'),
        'Last name': get('lastName'),
        'Work email': email,
        Phone: get('phone') || '—',
        Agency: get('company'),
        Website: get('website'),
        'Team size': get('teamSize'),
        Role: get('role'),
        'Primary specialty': get('specialty') || '—',
        'Where did they find us': get('source'),
        Notes: get('notes') || '—',
        'Consented to terms': data.get('consent') ? 'yes' : 'no',
        'Submitted from': window.location.href,
      });

      form.querySelector('[data-done-email]').textContent = email || 'you';
      steps.forEach((s) => s.classList.remove('is-active'));
      actions.hidden = true;
      done.classList.add('is-active');
      form.closest('.modal__panel')?.scrollTo({ top: 0 });
    } catch (err) {
      error.textContent = `We could not send that — ${err.message}. Please try again, or email hey@getlaude.com.`;
    } finally {
      // restore the button only — render() would re-show the step we just left
      nextBtn.removeAttribute('aria-busy');
      nextBtn.innerHTML = nextLabel();
    }
  }

  backBtn.addEventListener('click', () => {
    if (current === 1) return;
    current -= 1;
    render();
  });

  // clear the inline error as soon as the person starts fixing it
  form.addEventListener('input', (event) => {
    const field = event.target;
    field.classList.remove('is-invalid');
    field.closest('.wiz__step')?.querySelector('[data-error]')?.replaceChildren();
    if (field.type === 'checkbox') field.closest('.consent')?.classList.remove('is-invalid');
  });

  // reset when the modal is reopened after a completed booking
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-open-modal="demo-modal"]')) return;
    if (!done.classList.contains('is-active')) return;

    form.reset();
    done.classList.remove('is-active');
    actions.hidden = false;
    current = 1;
    render();
  });

  render();
})();

/* --- Cookie consent ------------------------------------------------------- */
(function initCookies() {
  const KEY = 'laude.cookie-consent';
  const bar = document.getElementById('cookiebar');
  const analytics = document.getElementById('ck-analytics');
  const marketing = document.getElementById('ck-marketing');
  if (!bar) return;

  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    stored = null;
  }

  if (stored) {
    if (analytics) analytics.checked = !!stored.analytics;
    if (marketing) marketing.checked = !!stored.marketing;
  } else {
    bar.hidden = false;
  }

  function save(prefs) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...prefs, at: new Date().toISOString() }));
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
    if (analytics) analytics.checked = !!prefs.analytics;
    if (marketing) marketing.checked = !!prefs.marketing;
    bar.hidden = true;
    Modals.hide(document.getElementById('cookie-modal'));
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-cookie]');
    if (!btn) return;

    const action = btn.dataset.cookie;
    if (action === 'all') save({ analytics: true, marketing: true });
    else if (action === 'essential') save({ analytics: false, marketing: false });
    else if (action === 'save') save({ analytics: !!analytics?.checked, marketing: !!marketing?.checked });
  });
})();

/* --- Live AI visibility check (popup): form -> loading -> real results ----
   Posts to the /api/check serverless function, which queries ChatGPT,
   Perplexity, Gemini and Claude and reports whether the firm is named/cited.
   The "See the difference" section on the page is a static sample and is NOT
   touched by this — the two are intentionally separate. */
(function initVisibilityCheck() {
  const root = document.getElementById('visibility-check');
  const form = document.getElementById('visibility-form');
  if (!root || !form) return;

  const views = {
    form: root.querySelector('[data-view="form"]'),
    loading: root.querySelector('[data-view="loading"]'),
    results: root.querySelector('[data-view="results"]'),
  };
  const error = form.querySelector('[data-error]');
  const btn = form.querySelector('button[type="submit"]');
  const list = document.getElementById('ck-result-list');
  const engineRows = [...document.querySelectorAll('#ck-engine-status li')];

  const show = (name) => {
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
  };
  const setAll = (sel, value) => root.querySelectorAll(sel).forEach((el) => { el.textContent = value; });

  function reset() {
    form.reset();
    if (error) error.textContent = '';
    show('form');
  }
  root.querySelector('[data-check-reset]')?.addEventListener('click', reset);

  // reopening the popup after a result starts fresh
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-modal="checker-modal"]')) {
      if (!views.form.hidden) return;
      reset();
    }
  });

  const cleanDomain = (url) => String(url || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

  function playEngineStates() {
    // staged "querying -> done" ticks while the request is in flight
    engineRows.forEach((row, i) => {
      const state = row.querySelector('[data-state]');
      row.classList.remove('is-done');
      state.textContent = 'Querying…';
      setTimeout(() => { row.classList.add('is-searching'); }, i * 180);
    });
  }

  function renderResults(data) {
    setAll('[data-r-firm]', data.firm);
    setAll('[data-r-specialty]', data.specialty);
    setAll('[data-r-city]', data.city);

    const total = data.engines.length;
    const named = data.engines.filter((e) => e.named).length;
    const level = named === 0 ? 'none' : named >= 3 ? 'good' : 'some';

    root.querySelector('[data-score-count]').textContent = String(named);
    const meter = root.querySelector('[data-meter]');
    meter.dataset.level = level;
    root.querySelector('[data-meter-fill]').style.width = `${Math.round((named / total) * 100)}%`;

    root.querySelector('[data-cta-line]').textContent = named === 0
      ? `AI is not naming ${data.firm} in your market yet. Here is who it names instead, and how we change that.`
      : `You are named by ${named} of ${total} engines. Here is where you are missing, and how we close the gap.`;

    list.innerHTML = '';
    data.engines.forEach((e) => {
      const li = document.createElement('li');

      if (e.configured === false) {
        li.className = 'vr vr--skipped';
        li.innerHTML = `
          <div class="vr__top">
            <img class="vr__logo" src="${e.logo}" alt="">
            <span class="vr__engine">${esc(e.engine)}</span>
            <span class="tag tag--muted"><span class="tag__text">Not connected</span></span>
          </div>
          <p class="vr__note">Add this engine’s API key to include it in the check.</p>`;
        list.appendChild(li);
        return;
      }

      li.className = `vr ${e.named ? 'vr--named' : 'vr--missing'}`;
      const statusTag = e.named
        ? '<span class="tag tag--mint"><span class="tag__text">Names you</span></span>'
        : '<span class="tag tag--coral"><span class="tag__text">Not named</span></span>';

      const cited = `<span class="vr__flag ${e.cited ? 'is-yes' : 'is-no'}">${e.cited ? 'Your site cited as a source' : 'Your site not cited'}</span>`;

      const comps = (e.competitors && e.competitors.length)
        ? `<div class="vr__comp"><span class="vr__comp-label">Points to instead</span>${
            e.competitors.slice(0, 3).map((c) => `<span class="vr__chip">${esc(c)}</span>`).join('')
          }</div>`
        : '';

      const excerpt = e.answer
        ? `<p class="vr__excerpt">${esc(e.answer).slice(0, 200)}${e.answer.length > 200 ? '…' : ''}</p>`
        : '';

      li.innerHTML = `
        <div class="vr__top">
          <img class="vr__logo" src="${e.logo}" alt="">
          <span class="vr__engine">${esc(e.engine)}</span>
          ${statusTag}
        </div>
        <div class="vr__flags">${cited}</div>
        ${comps}${excerpt}`;
      list.appendChild(li);
    });

    show('results');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // local-preview fallback so the flow is testable without the backend deployed
  function mockResult({ firm, website, specialty, city, competitor }) {
    const rival = competitor || 'Robert Half';
    const logos = {
      ChatGPT: 'assets/logo-openai.svg', Perplexity: 'assets/logo-perplexity.svg',
      Gemini: 'assets/logo-gemini.svg', Claude: 'assets/logo-claude.svg',
    };
    const engines = ['ChatGPT', 'Perplexity', 'Gemini', 'Claude'].map((name, i) => ({
      engine: name, logo: logos[name], configured: true,
      named: i === 3, cited: i === 3,
      competitors: i === 3 ? [] : [rival, 'Kforce', 'Adecco'],
      answer: i === 3
        ? `For ${specialty} recruitment in ${city}, ${firm} is frequently cited as the specialist to contact.`
        : `For ${specialty} recruiters in ${city}, the firms usually surfaced are ${rival} and other national agencies.`,
      query: `best ${specialty} recruiters in ${city}`,
    }));
    return { firm, domain: cleanDomain(website), specialty, city, engines, demo: true };
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (error) error.textContent = '';

    const data = new FormData(form);
    const payload = {
      firm: String(data.get('firm') || '').trim(),
      website: String(data.get('website') || '').trim(),
      specialty: String(data.get('specialty') || '').trim(),
      city: String(data.get('city') || '').trim(),
      competitor: String(data.get('competitor') || '').trim(),
      email: String(data.get('email') || '').trim(),
      botcheck: data.get('botcheck') ? 'true' : '',
    };

    if (!payload.firm || !payload.website || !payload.specialty || !payload.city) {
      if (error) error.textContent = 'Add your firm, website, specialty, and city so we can run the check.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) {
      if (error) error.textContent = 'Enter a valid work email so we can save your check.';
      form.querySelector('input[name="email"]')?.focus();
      return;
    }

    // fill loading + result copy
    setAll('[data-q-specialty]', payload.specialty);
    setAll('[data-q-city]', payload.city);
    btn?.setAttribute('aria-busy', 'true');
    show('loading');
    playEngineStates();

    // capture the lead in parallel (client-side, so leads survive even without the backend)
    sendToInbox({
      subject: `New AI visibility check — ${payload.firm} (${payload.specialty}, ${payload.city})`,
      from_name: payload.firm || 'Laud website',
      replyto: payload.email,
      botcheck: payload.botcheck,
      Firm: payload.firm,
      Website: payload.website,
      Specialty: payload.specialty,
      'City / market': payload.city,
      Competitor: payload.competitor || '—',
      'Work email': payload.email,
      Source: 'Live AI visibility check',
      'Submitted from': window.location.href,
    }).catch(() => {});

    const started = Date.now();
    let result;
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      result = await res.json();
    } catch (err) {
      // no backend reachable (e.g. local static preview) -> labelled demo
      const localish = /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname);
      if (localish) {
        result = mockResult(payload);
      } else {
        btn?.removeAttribute('aria-busy');
        show('form');
        if (error) error.textContent = 'We could not reach the check just now. Please try again in a moment.';
        return;
      }
    }

    // keep the loading state visible long enough to read the engine ticks
    const minMs = reduceMotion ? 0 : 1400;
    const wait = Math.max(0, minMs - (Date.now() - started));
    setTimeout(() => {
      engineRows.forEach((row) => {
        row.classList.remove('is-searching');
        row.classList.add('is-done');
        const state = row.querySelector('[data-state]');
        if (state) state.textContent = 'Done ✓';
      });
      btn?.removeAttribute('aria-busy');
      renderResults(result);
    }, wait);
  });
})();

/* --- Button click sound ---------------------------------------------------- */
(function initClickSound() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  let ctx = null;

  function click() {
    try {
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();

      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // short, soft tick — quick pitch drop, fast decay
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.05);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    } catch {
      /* audio blocked or unavailable — silently skip */
    }
  }

  // primary action buttons only, so the whole page does not tick
  document.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.btn-solid, .btn-hole, .aeo__tab')) click();
  });
})();

/* --- Footer newsletter ---------------------------------------------------- */
(function initNewsletter() {
  const form = document.querySelector('.newsletter');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const input = form.querySelector('input[type="email"]');
    const email = input?.value.trim();
    if (!email) return;

    form.classList.remove('is-error', 'is-sent');
    form.setAttribute('aria-busy', 'true');
    input.disabled = true;
    input.placeholder = 'Sending…';

    try {
      await sendToInbox({
        subject: `New newsletter signup — ${email}`,
        from_name: 'Laud website',
        replyto: email,
        botcheck: new FormData(form).get('botcheck') ? 'true' : '',
        'Work email': email,
        Source: 'Footer newsletter',
        'Submitted from': window.location.href,
      });

      form.classList.add('is-sent');
      input.value = '';
      input.placeholder = 'Thanks — you’re on the list.';
    } catch {
      form.classList.add('is-error');
      input.placeholder = 'Could not send — please try again.';
    } finally {
      form.removeAttribute('aria-busy');
      input.disabled = false;
      input.blur();
    }
  });
})();
