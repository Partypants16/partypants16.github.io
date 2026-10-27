(() => {
  const stack = document.querySelector('.widget-stack');
  if (!stack) return;
  const track = stack.querySelector('.widget-track');
  const slides = [...track.children];
  const controls = stack.querySelector('.widget-controls');
  const dots = [...controls.querySelectorAll('.widget-dots button')];
  const previous = controls.querySelector('.widget-prev');
  const next = controls.querySelector('.widget-next');
  let active = 0;
  function update() {
    active = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((dot, i) => {
      if (i === active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    previous.disabled = active === 0;
    next.disabled = active === slides.length - 1;
    slides.forEach((slide, i) => {
      slide.querySelectorAll('a').forEach(link => { link.tabIndex = i === active ? 0 : -1; });
    });
  }
  function show(index) {
    const target = Math.max(0, Math.min(slides.length - 1, index));
    track.scrollTo({left: target * track.clientWidth,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off' ? 'instant' : 'smooth'});
  }
  previous.addEventListener('click', () => show(active - 1));
  next.addEventListener('click', () => show(active + 1));
  dots.forEach((dot, index) => dot.addEventListener('click', () => show(index)));
  track.addEventListener('scroll', update, {passive: true});
  stack.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    show(event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : active + (event.key === 'ArrowRight' ? 1 : -1));
  });
  controls.hidden = false;
  update();
})();
