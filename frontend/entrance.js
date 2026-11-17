// Native browser animation of the supplied photograph; no 3D/animation library.
(() => {
  const intro = document.getElementById('cinematic-intro');
  if (!intro) return;
  const van = document.getElementById('intro-van');
  const photo = document.getElementById('intro-photo');
  const status = document.getElementById('intro-motion-status');
  const replay = document.getElementById('intro-replay');
  let animations = [], generation = 0, previousFocus, returnHash = '#home', leaving = false;

  function cancelMotion() {
    generation++;
    animations.forEach(animation => animation.cancel());
    animations = [];
    if (van) van.style.willChange = 'auto';
    const decal = document.getElementById('intro-van-decal');
    if (decal) decal.classList.remove('reveal');
  }

  function parked() {
    if (status) status.textContent = 'Your journey awaits.';
    const decal = document.getElementById('intro-van-decal');
    if (decal) decal.classList.add('reveal');
    if (replay) {
      replay.textContent = '↻ Replay van entrance';
      replay.disabled = false;
    }
  }

  async function arrive() {
    if (leaving) return;
    cancelMotion();
    const token = generation;
    if (status) status.textContent = 'Arriving in style…';
    if (replay) replay.textContent = '↻ Restart van entrance';
    if (van) van.style.willChange = 'transform';
    try {
      await photo?.decode();
    } catch {
      if (status) status.textContent = 'The reference image could not load. Entering website…';
      startJourney();
      return;
    }
    if (!intro.open || token !== generation) return;
    const travel = innerWidth / 2 + (van ? van.getBoundingClientRect().width / 2 : 400) + 80;
    if (van) {
      const body = van.animate(
        [
          { transform: `translateX(${travel}px) scale(.94) rotateY(-5deg)`, opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { transform: 'translateX(0) scale(1) rotateY(0deg)', opacity: 1 }
        ],
        { duration: 3400, easing: 'cubic-bezier(.16,.65,.23,1)', fill: 'both' }
      );
      animations.push(body);
      van.querySelectorAll('.intro-wheel').forEach(wheel =>
        animations.push(
          wheel.animate(
            [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-1080deg)' }],
            { duration: 3400, easing: 'cubic-bezier(.16,.65,.23,1)', fill: 'both' }
          )
        )
      );
      try {
        await body.finished;
      } catch {
        return;
      }
    }
    if (token === generation && intro.open) {
      parked();
      await new Promise(res => setTimeout(res, 2400));
    }
    if (token === generation && intro.open) startJourney();
  }

  function closeIntro() {
    if (!intro.open) return;
    cancelMotion();
    intro.close();
    document.body.classList.remove('intro-open');
    leaving = false;
    delete intro.dataset.state;
    if (replay) replay.disabled = false;
    const startBtn = document.getElementById('intro-start');
    if (startBtn) startBtn.disabled = false;
    if (location.hash === '#intro') history.replaceState(null, '', returnHash);
    const target = previousFocus?.isConnected && previousFocus !== document.body
      ? previousFocus
      : document.querySelector('.site-header .brand');
    target?.focus({ preventScroll: true });
    document.querySelectorAll('video').forEach(video => {
      video.play().catch(() => {});
    });
    document.dispatchEvent(new CustomEvent('rkr:intro-closed'));
  }

  function openIntro() {
    if (intro.open) return;
    previousFocus = document.activeElement;
    returnHash = location.hash && location.hash !== '#intro' ? location.hash : '#home';
    document.body.classList.add('intro-open');
    intro.showModal();
    document.querySelectorAll('video').forEach(video => video.pause());
    arrive();
  }

  async function startJourney() {
    if (!intro.open || leaving) return;
    cancelMotion();
    const token = generation;
    leaving = true;
    intro.dataset.state = 'leaving';
    if (replay) replay.disabled = true;
    const startBtn = document.getElementById('intro-start');
    if (startBtn) startBtn.disabled = true;
    returnHash = '#home';
    history.replaceState(null, '', '#home');
    document.getElementById('home')?.scrollIntoView({ behavior: 'instant' });
    const fade = intro.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 650, easing: 'ease-in-out', fill: 'both' }
    );
    animations.push(fade);
    try {
      await fade.finished;
    } catch {
      return;
    }
    if (token !== generation || !intro.open) return;
    closeIntro();
    document.querySelector('.site-header .brand')?.focus({ preventScroll: true });
  }

  document.getElementById('intro-skip')?.addEventListener('click', closeIntro);
  document.getElementById('intro-start')?.addEventListener('click', startJourney);
  document.getElementById('intro-logo')?.addEventListener('click', event => {
    event.preventDefault();
    closeIntro();
  });
  replay?.addEventListener('click', arrive);
  intro.addEventListener('click', event => {
    if (event.target.closest('#intro-skip') || event.target.closest('#intro-logo')) return;
    startJourney();
  });
  intro.addEventListener('cancel', event => {
    event.preventDefault();
    closeIntro();
  });
  document.addEventListener('visibilitychange', () => {
    if (!intro.open) return;
    animations.forEach(animation => document.hidden ? animation.pause() : animation.play());
  });
  addEventListener('hashchange', () => {
    if (location.hash === '#intro') openIntro();
  });

  const footerBottom = document.querySelector('.footer-bottom');
  if (footerBottom) {
    const launch = document.createElement('button');
    launch.type = 'button';
    launch.className = 'intro-launch';
    launch.textContent = 'Replay cinematic entrance ↗';
    launch.addEventListener('click', openIntro);
    footerBottom.append(launch);
  }

  // Play cinematic entrance automatically when entering the website
  if (!location.hash || location.hash === '#home' || location.hash === '#intro') {
    openIntro();
  }
})();
