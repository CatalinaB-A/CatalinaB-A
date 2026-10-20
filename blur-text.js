/* BlurText (React Bits) portado a JS sin React. Usa Web Animations API. */
(function () {
  const AXES = { top: ['y', -1], bottom: ['y', 1], left: ['x', -1], right: ['x', 1] };
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  const move = (axis, value) => (axis === 'x' ? `translateX(${value}px)` : `translateY(${value}px)`);

  const buildEffect = (effect, direction, blur, distance) => {
    const [axis, sign] = AXES[direction] || AXES.top;
    const b = Math.max(0, blur);
    const d = distance;

    if (effect === 'zoom') {
      return [
        { opacity: 0, filter: `blur(${b * 1.2}px)`, transform: `scale(1.4) ${move(axis, sign * d * 0.35)}` },
        { opacity: 0.9, filter: `blur(${b * 0.2}px)`, transform: `scale(0.97) ${move(axis, -sign * d * 0.03)}` },
        { opacity: 1, filter: 'blur(0px)', transform: 'none' }
      ];
    }

    if (effect === 'tilt') {
      const rotate = axis === 'y' ? 'rotateX' : 'rotateY';
      const lean = axis === 'y' ? -sign : sign;
      return [
        { opacity: 0, filter: `blur(${b}px)`, transform: `perspective(600px) ${rotate}(${lean * 55}deg) ${move(axis, sign * d * 0.5)}` },
        { opacity: 0.95, filter: `blur(${b * 0.15}px)`, transform: `perspective(600px) ${rotate}(${-lean * 8}deg) ${move(axis, -sign * d * 0.04)}` },
        { opacity: 1, filter: 'blur(0px)', transform: 'none' }
      ];
    }

    if (effect === 'focus') {
      return [
        { opacity: 0.32, filter: `blur(${b * 1.4}px)`, transform: 'scale(1.12)' },
        { opacity: 0.95, filter: `blur(${b * 0.1}px)`, transform: 'scale(0.995)' },
        { opacity: 1, filter: 'blur(0px)', transform: 'none' }
      ];
    }

    if (effect === 'drift') {
      const h = direction === 'right' ? 1 : -1;
      const v = axis === 'y' ? sign : 0;
      return [
        { opacity: 0, filter: `blur(${b}px)`, transform: `translate(${h * d * 1.6}px, ${v * d * 0.3}px) skewX(${h * 28}deg)` },
        { opacity: 0.95, filter: `blur(${b * 0.15}px)`, transform: `translate(${-h * d * 0.06}px, 0px) skewX(${-h * 7}deg)` },
        { opacity: 1, filter: 'blur(0px)', transform: 'none' }
      ];
    }

    return [
      { opacity: 0, filter: `blur(${b}px)`, transform: move(axis, sign * d) },
      { opacity: 0.5, filter: `blur(${b / 2}px)`, transform: move(axis, (-sign * d) / 10) },
      { opacity: 1, filter: 'blur(0px)', transform: 'none' }
    ];
  };

  const buildRanks = (count, staggerFrom, seedText) => {
    const ranks = Array.from({ length: count }, (_, i) => i);
    if (staggerFrom === 'end') return ranks.map(i => count - 1 - i);
    if (staggerFrom === 'center') {
      const mid = (count - 1) / 2;
      const offset = count % 2 === 0 ? 0.5 : 0;
      return ranks.map(i => Math.abs(i - mid) - offset);
    }
    if (staggerFrom === 'random') {
      let seed = 2166136261;
      for (let i = 0; i < seedText.length; i++) seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619) >>> 0;
      const next = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const order = ranks.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      order.forEach((piece, rank) => {
        ranks[piece] = rank;
      });
    }
    return ranks;
  };

  function createBlurText(element, options) {
    const o = {
      text: element.textContent.trim(),
      effect: 'blur',
      animateBy: 'words',
      direction: 'top',
      staggerFrom: 'start',
      trigger: 'view',
      delay: 200,
      stepDuration: 0.35,
      blur: 10,
      distance: 50,
      loop: false,
      loopDelay: 2,
      threshold: 0.1,
      rootMargin: '0px',
      onAnimationComplete: null,
      ...(options || {})
    };

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const keyframes = buildEffect(o.effect, o.direction, o.blur, o.distance);
    const words = o.text.split(' ');
    const pieces = [];

    element.textContent = '';
    const full = document.createElement('span');
    full.className = 'sr-only';
    full.textContent = o.text;
    element.appendChild(full);

    words.forEach((word, w) => {
      const last = w === words.length - 1;
      if (o.animateBy === 'words') {
        const piece = document.createElement('span');
        piece.textContent = last ? word : `${word}\u00A0`;
        piece.style.display = 'inline-block';
        element.appendChild(piece);
        pieces.push({ el: piece });
        return;
      }
      Array.from(word).forEach(char => {
        const piece = document.createElement('span');
        piece.textContent = char;
        piece.style.display = 'inline-block';
        element.appendChild(piece);
        pieces.push({ el: piece });
      });
      if (!last) {
        const space = document.createElement('span');
        space.textContent = '\u00A0';
        space.style.display = 'inline-block';
        element.appendChild(space);
        pieces.push({ el: space });
      }
    });

    const ranks = buildRanks(pieces.length, o.staggerFrom, o.text);
    const maxRank = ranks.reduce((max, rank) => Math.max(max, rank), 0);
    const stepMs = o.stepDuration * 1000;
    const total = stepMs + maxRank * o.delay;
    let timers = [];
    let animations = [];
    let observer = null;
    let played = false;

    const clear = () => {
      timers.forEach(id => clearTimeout(id));
      timers = [];
      animations.forEach(animation => animation.cancel());
      animations = [];
    };

    const show = () => {
      pieces.forEach(({ el }) => {
        el.style.opacity = '1';
        el.style.filter = 'none';
        el.style.transform = 'none';
      });
    };

    const play = () => {
      clear();
      pieces.forEach((piece, index) => {
        const delay = ranks[index] * o.delay;
        const animation = piece.el.animate(keyframes, {
          duration: stepMs,
          delay,
          easing: EASE,
          fill: 'both'
        });
        animations.push(animation);
      });
      timers.push(setTimeout(() => {
        if (o.onAnimationComplete) o.onAnimationComplete();
        if (o.loop) timers.push(setTimeout(play, Math.max(0, o.loopDelay) * 1000));
      }, total));
    };

    let interaction = null;
    if (reduced) {
      show();
    } else if (o.trigger === 'load') {
      play();
    } else if (o.trigger === 'hover' || o.trigger === 'click') {
      interaction = o.trigger === 'hover' ? 'pointerenter' : 'click';
      element.style.cursor = o.trigger === 'click' ? 'pointer' : '';
      element.addEventListener(interaction, play);
    }

    if (o.trigger === 'view' && !reduced) {
      observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting || played) return;
        played = true;
        play();
        observer.disconnect();
      }, { threshold: o.threshold, rootMargin: o.rootMargin });
      observer.observe(element);
    }

    return {
      replay: play,
      destroy() {
        clear();
        if (observer) observer.disconnect();
        if (interaction) element.removeEventListener(interaction, play);
      }
    };
  }

  window.createBlurText = createBlurText;
})();
