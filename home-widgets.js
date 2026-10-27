// Home's widget stack: the cards sit on top of each other, the next ones
// peeking out behind. Drag or swipe the top card away (mouse or touch) and it
// goes to the back. Arrows, dots and the arrow keys do the same. Without JS
// the cards fall back to a plain sideways-scrolling row (style.css).
(() => {
  const stack = document.querySelector('.widget-stack');
  if (!stack) return;
  const track = stack.querySelector('.widget-track');
  const slides = [...track.children];
  const controls = stack.querySelector('.widget-controls');
  const dots = [...controls.querySelectorAll('.widget-dots button')];
  let order = slides.map((_, i) => i);  // order[0] is the card in front
  let busy = false;
  let drag = null;

  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.motion === 'off';

  function layout() {
    order.forEach((index, pos) => {
      const slide = slides[index];
      slide.dataset.pos = Math.min(pos, 3);
      slide.style.zIndex = slides.length - pos;
      slide.inert = pos !== 0;
    });
    dots.forEach((dot, i) => {
      if (i === order[0]) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  // Runs done() once the card's slide/fade has finished (or straight away).
  function after(card, done) {
    let finished = false;
    const end = () => { if (!finished) { finished = true; done(); } };
    card.addEventListener('transitionend', e => { if (e.propertyName === 'transform') end(); }, {once: true});
    setTimeout(end, 600);
  }

  function place(card, transform, opacity) {
    card.style.transform = transform;
    card.style.opacity = opacity;
  }

  // Throw the front card off to one side (dir -1 left, 1 right) and send it to
  // the back. With a target index, keep going until that card is in front.
  function next(dir = -1, target) {
    if (busy) return;
    const card = slides[order[0]];
    do order.push(order.shift()); while (target !== undefined && order[0] !== target);
    if (still()) { place(card, '', ''); layout(); return; }
    busy = true;
    layout();
    card.style.zIndex = slides.length + 1;  // stays on top while it flies off
    place(card, `translateX(${dir * 120}%) rotate(${dir * 6}deg)`, '0');
    after(card, () => {
      card.classList.add('no-anim');
      place(card, '', '');
      layout();
      void card.offsetWidth;
      card.classList.remove('no-anim');
      busy = false;
    });
  }

  // Bring the back card (or the target) in from the left onto the front.
  function previous(target) {
    if (busy) return;
    do order.unshift(order.pop()); while (target !== undefined && order[0] !== target);
    const card = slides[order[0]];
    if (still()) { layout(); return; }
    busy = true;
    card.classList.add('no-anim');
    place(card, 'translateX(-120%) rotate(-6deg)', '0');
    layout();
    void card.offsetWidth;
    card.classList.remove('no-anim');
    place(card, '', '');
    after(card, () => { busy = false; });
  }

  function show(index) {
    const steps = order.indexOf(index);
    if (steps <= 0) return;
    if (steps <= slides.length / 2) next(-1, index);
    else previous(index);
  }

  controls.querySelector('.widget-prev').addEventListener('click', () => previous());
  controls.querySelector('.widget-next').addEventListener('click', () => next());
  dots.forEach((dot, index) => dot.addEventListener('click', () => show(index)));

  stack.addEventListener('keydown', event => {
    if (event.target.closest('.widget-controls')) return;
    const keys = {ArrowRight: () => next(), ArrowLeft: () => previous(),
      Home: () => show(0), End: () => show(slides.length - 1)};
    if (!keys[event.key]) return;
    event.preventDefault();
    keys[event.key]();
  });

  // Dragging the front card. touch-action: pan-y (style.css) keeps vertical
  // page scrolling on phones; sideways moves come here.
  track.addEventListener('pointerdown', event => {
    const card = slides[order[0]];
    if (busy || event.button > 0 || !card.contains(event.target) || event.target.closest('a, button')) return;
    drag = {card, id: event.pointerId, x: event.clientX, time: performance.now(), dx: 0, moving: false};
  });
  track.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.dx = event.clientX - drag.x;
    if (!drag.moving) {
      if (Math.abs(drag.dx) < 6) return;
      drag.moving = true;
      drag.card.setPointerCapture(drag.id);
      drag.card.classList.add('is-dragging');
    }
    place(drag.card, `translateX(${drag.dx}px) rotate(${drag.dx / drag.card.offsetWidth * 8}deg)`, '');
  });
  function release(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const {card, dx, moving, time} = drag;
    drag = null;
    if (!moving) return;
    card.classList.remove('is-dragging');
    const fast = Math.abs(dx) / (performance.now() - time) > 0.6;
    if (event.type === 'pointerup' && (Math.abs(dx) > card.offsetWidth * 0.25 || (fast && Math.abs(dx) > 30))) {
      next(Math.sign(dx));
    } else {
      place(card, '', '');
    }
  }
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);

  stack.classList.add('is-stacked');
  controls.hidden = false;
  layout();
})();
