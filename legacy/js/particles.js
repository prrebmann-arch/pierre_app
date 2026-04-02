// ===== HERO PARTICLES + IMMERSIVE SCROLL EFFECTS =====

(function () {
  const canvas = document.getElementById('hero-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], mouse = { x: -999, y: -999 }, raf;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const COUNT = 90;
  const CONNECT_DIST = 160;
  const MOUSE_DIST = 200;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width = rect.width * devicePixelRatio;
    H = canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function init() {
    resize();
    particles = [];
    const w = W / devicePixelRatio, h = H / devicePixelRatio;
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
        r: Math.random() * 2.5 + 1.5, a: Math.random() * 0.4 + 0.4,
      });
    }
  }

  function draw() {
    const w = W / devicePixelRatio, h = H / devicePixelRatio;
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_DIST && dist > 0) {
        const force = (MOUSE_DIST - dist) / MOUSE_DIST * 1.2;
        p.vx += (dx / dist) * force; p.vy += (dy / dist) * force;
      }
      p.vx *= 0.97; p.vy *= 0.97; p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
      if (!isSafari) { ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(255,80,80,0.6)'; }
      ctx.beginPath(); ctx.arc(p.x, p.y, isSafari ? p.r + 1 : p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,100,100,${isSafari ? Math.min(p.a + 0.2, 0.9) : p.a})`; ctx.fill();
      if (!isSafari) ctx.shadowBlur = 0;
    }
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(255,80,80,${(1 - dist / CONNECT_DIST) * 0.25})`; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(draw);
  }

  const hero = canvas.parentElement;
  hero.addEventListener('mousemove', (e) => { const r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  hero.addEventListener('mouseleave', () => { mouse.x = -999; mouse.y = -999; });
  window.addEventListener('resize', () => { cancelAnimationFrame(raf); init(); draw(); });

  function tryInit() {
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) { setTimeout(tryInit, 200); return; }
    init(); draw();
  }
  tryInit();

  // ═══════════════════════════════════════
  // ── HERO TEXT LETTER-BY-LETTER REVEAL ──
  // ═══════════════════════════════════════
  const heroH1 = document.querySelector('#landing-screen .hero h1');
  if (heroH1 && !heroH1.dataset.split) {
    heroH1.dataset.split = '1';
    const html = heroH1.innerHTML;
    // Wrap each character in a span (preserve HTML tags like <span> and <br>)
    let charIdx = 0;
    const wrapped = html.replace(/(<[^>]+>)|([^<])/g, (match, tag, char) => {
      if (tag) return tag;
      if (char === ' ') return ' ';
      const delay = 0.03 * charIdx++;
      return `<span class="hero-char" style="animation-delay:${delay.toFixed(2)}s">${char}</span>`;
    });
    heroH1.innerHTML = wrapped;
    heroH1.classList.add('hero-text-animated');
  }

  // ═══════════════════════════════════════
  // ── COUNTER ANIMATION ON HERO STATS ──
  // ═══════════════════════════════════════
  const statValues = document.querySelectorAll('#landing-screen .hero-stat-value');
  let countersStarted = false;
  function animateCounters() {
    if (countersStarted) return;
    countersStarted = true;
    statValues.forEach(el => {
      const text = el.textContent.trim();
      const match = text.match(/^(\d+)/);
      if (!match) return;
      const target = parseInt(match[1]);
      const suffix = text.replace(/^\d+/, '');
      let current = 0;
      const duration = 1500;
      const start = performance.now();
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
        current = Math.round(target * eased);
        el.textContent = current + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }
  // Trigger counters when hero stats become visible
  const statsObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { animateCounters(); statsObs.disconnect(); } });
  }, { threshold: 0.5 });
  const heroStats = document.querySelector('#landing-screen .hero-stats');
  if (heroStats) statsObs.observe(heroStats);

  // ═══════════════════════════════════════
  // ── PARALLAX ON SCROLL ──
  // ═══════════════════════════════════════
  const heroContent = document.querySelector('#landing-screen .hero-content');
  const orb1 = document.querySelector('.hero-orb-1');
  const orb2 = document.querySelector('.hero-orb-2');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const heroH = hero.offsetHeight;

    // Hero parallax
    if (scrollY < heroH) {
      const ratio = scrollY / heroH;
      if (heroContent) {
        heroContent.style.transform = `translateY(${scrollY * 0.4}px)`;
        heroContent.style.opacity = Math.max(0, 1 - ratio * 2);
      }
      if (orb1) orb1.style.transform = `translate(${scrollY * 0.12}px, ${scrollY * -0.25}px)`;
      if (orb2) orb2.style.transform = `translate(${scrollY * -0.18}px, ${scrollY * -0.15}px)`;
      canvas.style.opacity = Math.max(0, 1 - ratio * 1.5);
    }

    // No JS parallax on sections — CSS handles reveals


  }, { passive: true });

  // ═══════════════════════════════════════
  // ── SCROLL REVEAL WITH 3D ──
  // ═══════════════════════════════════════
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('scroll-revealed');
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('#landing-screen .bento-card, #landing-screen .step-card, #landing-screen .pricing-card, #landing-screen .section-header').forEach(el => {
    el.classList.add('scroll-reveal');
    revealObs.observe(el);
  });
})();
