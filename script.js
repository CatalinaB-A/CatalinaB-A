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
