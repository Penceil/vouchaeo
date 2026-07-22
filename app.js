/* ==========================================================================
   vouchaeo — interactions
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

/* --- Hero: rotate the AI platform lockup every 2s -------------------------- */
(function initBrandRotator() {
  const rotator = document.getElementById('brand-rotator');
  if (!rotator) return;

  const brands = [...rotator.querySelectorAll('.brand')];
  if (brands.length < 2 || reduceMotion) return;

  let index = 0;

  setInterval(() => {
    const current = brands[index];
    index = (index + 1) % brands.length;
    const next = brands[index];

    current.classList.remove('is-active');
    current.classList.add('is-leaving');
    next.classList.add('is-active');

    setTimeout(() => current.classList.remove('is-leaving'), 450);
  }, 2000);
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

  function render() {
    steps.forEach((step) => step.classList.toggle('is-active', Number(step.dataset.step) === current));
    backBtn.hidden = current === 1;
    nextBtn.innerHTML = current === total
      ? 'Book my demo<span class="btn-solid__arrow">→</span>'
      : 'Continue<span class="btn-solid__arrow">→</span>';
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
        from_name: name || 'vouchaeo website',
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
    } catch (err) {
      error.textContent = `We could not send that — ${err.message}. Please try again, or email hey@vouchaeo.com.`;
    } finally {
      nextBtn.removeAttribute('aria-busy');
      render();
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
  const KEY = 'vouchaeo.cookie-consent';
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

/* --- Hero email capture: hand off to the demo wizard, prefilled ------------ */
(function initWaitlist() {
  const form = document.querySelector('.waitlist');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const input = form.querySelector('input[type="email"]');
    if (!input?.value) return;

    Modals.show('demo-modal');
    const target = document.querySelector('#demo-form input[name="email"]');
    if (target) target.value = input.value;

    input.value = '';
    input.blur();
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
        from_name: 'vouchaeo website',
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
