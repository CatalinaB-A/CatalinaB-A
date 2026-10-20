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

const ballEl = document.getElementById('ball');
const tunnelEl = document.getElementById('tunnel');

const ballOptions = () => ({
  preset: 'plasma',
  color: color('--accent'),
  theme: isDark() ? 'dark' : 'light',
  size: 0.72,
  hoverStrength: 0.7
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

const ball = ballEl && window.createCrystalizedBall
  ? window.createCrystalizedBall(ballEl, ballOptions())
  : null;
const tunnel = tunnelEl && window.createLightTunnel
  ? window.createLightTunnel(tunnelEl, tunnelOptions())
  : null;

const syncTheme = () => {
  const dark = isDark();
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
};

const applyTheme = () => {
  if (ball) ball.update(ballOptions());
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
