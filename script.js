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

const ballEl = document.getElementById('ball');
if (ballEl && window.createCrystalizedBall) {
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const options = () => ({
    preset: 'plasma',
    color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    theme: scheme.matches ? 'dark' : 'light',
    size: 0.72,
    hoverStrength: 0.7
  });
  const ball = window.createCrystalizedBall(ballEl, options());
  scheme.addEventListener('change', () => ball.update(options()));
}

const tunnelEl = document.getElementById('tunnel');
if (tunnelEl && window.createLightTunnel) {
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const gold = () => getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
  const options = () => ({
    cableColor: gold(),
    pulseColor: gold(),
    tunnelColor: gold(),
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
    opacity: scheme.matches ? 0.38 : 0.22,
    lightMode: !scheme.matches,
    mouseStrength: 0.08,
    clickSurge: false,
    dpr: 1.5
  });
  const tunnel = window.createLightTunnel(tunnelEl, options());
  scheme.addEventListener('change', () => tunnel.update(options()));
}
