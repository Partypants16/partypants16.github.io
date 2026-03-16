(() => {
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReducedMotion) return;

  const els = Array.from(document.querySelectorAll(".reveal"));
  if (!els.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { root: null, threshold: 0.18, rootMargin: "0px 0px -10% 0px" },
  );

  for (const el of els) io.observe(el);
})();
