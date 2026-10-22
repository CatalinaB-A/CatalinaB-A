const toggle = document.querySelector('.toggle');
const menu = document.getElementById('menu');

toggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});

menu.addEventListener('click', (event) => {
  if (event.target.matches('a')) {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
});

document.getElementById('year').textContent = new Date().getFullYear();

const root = document.documentElement;
const scheme = matchMedia('(prefers-color-scheme: dark)');
const themeBtn = document.querySelector('.theme');
const isDark = () => root.dataset.theme === 'dark';

const color = name => getComputedStyle(root).getPropertyValue(name).trim();

const nameEl = document.getElementById('name');
const eyeEl = document.getElementById('eye');
const tunnelEl = document.getElementById('tunnel');

const eyeOptions = () => ({
  size: 0.27,
  fill: 1,
  interactive: true,
  hoverStrength: 0.7,
  sclera: color('--eye-sclera'),
  iris: color('--eye-iris'),
  irisDeep: color('--eye-iris-deep'),
  irisLight: color('--eye-iris-light'),
  lash: color('--eye-lash'),
  skin: color('--eye-skin'),
  skinDeep: color('--eye-skin-deep')
});

const tunnelOptions = () => ({
  cableColor: color('--gold'),
  pulseColor: color('--gold'),
  tunnelColor: color('--gold'),
  tunnelOpacity: 0.12,
  cableCount: 64,
  speed: 0.06,
  pulseLength: 0.4,
  pulseDensity: 0.28,
  sway: 0.8,
  bend: 0.5,
  size: 1.05,
  fadeNear: 0.62,
  fadeFar: 1.9,
  brightness: 0.8,
  opacity: isDark() ? 0.38 : 0.22,
  lightMode: !isDark(),
  mouseStrength: 0.08,
  clickSurge: false,
  dpr: 1.5
});

const eye = eyeEl && window.createEye ? window.createEye(eyeEl, eyeOptions()) : null;
const tunnel = tunnelEl && window.createLightTunnel
  ? window.createLightTunnel(tunnelEl, tunnelOptions())
  : null;

if (nameEl && window.createBlurText) {
  window.createBlurText(nameEl, {
    text: nameEl.textContent.trim(),
    effect: 'blur',
    animateBy: 'words',
    direction: 'top',
    staggerFrom: 'center',
    trigger: 'view',
    delay: 110,
    stepDuration: 0.5,
    blur: 14,
    distance: 26
  });
}

const tr = key => (window.i18n ? window.i18n.t(key) : key);

const syncTheme = () => {
  const dark = isDark();
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.setAttribute('aria-label', tr(dark ? 'a11y.themeLight' : 'a11y.themeDark'));
};

const applyTheme = () => {
  if (eye) eye.update(eyeOptions());
  if (tunnel) tunnel.update(tunnelOptions());
};

const storedTheme = () => {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
};

themeBtn.addEventListener('click', () => {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try {
    localStorage.setItem('theme', root.dataset.theme);
  } catch {
    /* almacenamiento bloqueado: el tema dura la sesión */
  }
  syncTheme();
  applyTheme();
});

scheme.addEventListener('change', () => {
  if (storedTheme()) return;
  root.dataset.theme = scheme.matches ? 'dark' : 'light';
  syncTheme();
  applyTheme();
});

syncTheme();

/* --- sección activa en el menú --- */
const navLinks = Array.from(document.querySelectorAll('#menu a[href^="#"]'));
const spySections = navLinks
  .map(link => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if (spySections.length && 'IntersectionObserver' in window) {
  const spy = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-42% 0px -52% 0px' });

  spySections.forEach(section => spy.observe(section));
}

/* --- editor de contenido local, bloque a bloque --- */
window.createContentEditor({
  editable: 'main h2, main h3, main p, main dt, main dd, main li, .foot p',
  storageKey: 'site-content',
  downloadName: 'index.html',
  onEditingChange: open => window.stylePanel?.setOpen(open)
});

document.addEventListener('langchange', syncTheme);
