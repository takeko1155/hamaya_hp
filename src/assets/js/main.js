(() => {
  const root = document.documentElement;
  root.classList.add('js');

  // --- reveal on scroll ---
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  // --- header: transparent over the hero, turns white as the hero scrolls away ---
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  let ticking = false;
  const updateHeader = () => {
    ticking = false;
    let p = 1;
    if (hero) {
      const end = hero.offsetHeight - header.offsetHeight;
      const start = end * 0.3; // stay clear for the first part of the photo
      p = Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
    }
    header.style.setProperty('--p', p.toFixed(3));
    header.style.setProperty('--bg', Math.sqrt(p).toFixed(3));
    header.classList.toggle('on-light', p >= 0.35);
    header.classList.toggle('scrolled', p >= 1);
  };
  updateHeader();
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); }
  }, { passive: true });
  window.addEventListener('resize', updateHeader);

  // --- mobile nav ---
  const toggle = document.querySelector('.nav-toggle');
  const setNav = (open) => {
    root.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  };
  toggle.addEventListener('click', () => setNav(!root.classList.contains('nav-open')));
  document.querySelectorAll('.global-nav a').forEach((a) => a.addEventListener('click', () => setNav(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

  // --- hero slideshow: slow dissolve loop ---
  const slides = [...document.querySelectorAll('.hero-slide')];
  if (slides.length > 1) {
    const HOLD = 8000;
    const FADE = 3000;
    let current = 0;
    const ready = new Set([0]);
    const load = (i) =>
      new Promise((resolve) => {
        const el = slides[i];
        if (ready.has(i) || !el.dataset.bg) return resolve();
        const img = new Image();
        img.onload = img.onerror = () => {
          el.style.backgroundImage = `url(${el.dataset.bg})`;
          ready.add(i);
          resolve();
        };
        img.src = el.dataset.bg;
      });
    const advance = async () => {
      const next = (current + 1) % slides.length;
      await load(next);
      if (!document.hidden) {
        const prev = slides[current];
        prev.classList.replace('is-active', 'is-leaving');
        setTimeout(() => prev.classList.remove('is-leaving'), FADE + 100);
        slides[next].classList.add('is-active');
        current = next;
      }
      setTimeout(advance, HOLD);
    };
    setTimeout(advance, HOLD);
    window.addEventListener('load', () => slides.forEach((_, i) => load(i)));
  }

  // --- menu tabs ---
  const tabs = [...document.querySelectorAll('.menu-tab')];
  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });

  // --- menu viewer ---
  const viewer = document.querySelector('.viewer');
  if (!viewer || typeof viewer.showModal !== 'function') return;
  const vImg = viewer.querySelector('img');
  const vCount = viewer.querySelector('.viewer-count');
  let pages = [];
  let index = 0;

  const show = (i) => {
    index = (i + pages.length) % pages.length;
    const btn = pages[index];
    vImg.src = btn.dataset.full;
    vImg.alt = btn.querySelector('img').alt;
    vCount.textContent = `${index + 1} / ${pages.length}`;
    // preload neighbours
    [index + 1, index - 1].forEach((n) => {
      const b = pages[(n + pages.length) % pages.length];
      if (b) new Image().src = b.dataset.full;
    });
  };

  document.querySelectorAll('.menu-grid button').forEach((btn) => {
    btn.addEventListener('click', () => {
      pages = [...btn.closest('.menu-grid').querySelectorAll('button')];
      show(pages.indexOf(btn));
      viewer.showModal();
    });
  });

  viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
  viewer.querySelector('.viewer-prev').addEventListener('click', () => show(index - 1));
  viewer.querySelector('.viewer-next').addEventListener('click', () => show(index + 1));
  viewer.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
  });
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer || e.target.classList.contains('viewer-stage')) viewer.close();
  });

  // swipe
  let sx = null;
  let sy = null;
  const stage = viewer.querySelector('.viewer-stage');
  stage.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
    sx = sy = null;
  });
})();
