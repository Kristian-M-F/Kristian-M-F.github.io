// Landing page behaviour: header shadow and entrance animations.
// (Restoring the scroll position when coming back is done in js/shared/site.js.)
// Everything here is optional; without JavaScript or with reduced motion the page
// is fully visible and works the same.

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const header = document.querySelector(".site-header");
const updateHeaderShadow = () => header.classList.toggle("scrolled", window.scrollY > 8);
updateHeaderShadow();
window.addEventListener("scroll", updateHeaderShadow, { passive: true });

// Runs after js/shared/site.js has restored the scroll position, so sections the visitor
// already scrolled past are shown right away.
document.addEventListener("DOMContentLoaded", () => {
  if (!prefersReducedMotion) startAnimations();
});

function startAnimations() {
  document.documentElement.classList.add("motion");

  // Reveal on scroll: [data-reveal] elements fade in once, children of
  // [data-reveal-group] follow each other with a short delay.
  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    [...group.children].forEach((child, i) => {
      child.setAttribute("data-reveal", "");
      child.dataset.delay = Math.min(i, 6) * 90;
    });
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const delay = Number(entry.target.dataset.delay) || 0;
        setTimeout(() => entry.target.classList.add("visible"), delay);
        revealObserver.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );

  document.querySelectorAll("[data-reveal]").forEach((element) => {
    // Elements already scrolled past (e.g. after going back) are shown right away.
    if (element.getBoundingClientRect().bottom < 0) element.classList.add("visible");
    else revealObserver.observe(element);
  });

  // Hero: the "available" total updates as each booking slides in.
  const totalElement = document.querySelector("[data-countdown]");
  const bookingRows = [...document.querySelectorAll(".ledger-rows li")];
  if (totalElement && bookingRows.length) {
    const formatAmount = (value) =>
      "CHF " + value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const signedAmount = (row) => {
      const amount = Number(row.querySelector("b").textContent.replace(/[^\d.]/g, ""));
      return row.classList.contains("in") ? amount : -amount;
    };

    let displayed = 0;
    let target = 0;
    let frame;
    totalElement.textContent = formatAmount(0);

    const animateTo = (goal) => {
      cancelAnimationFrame(frame);
      const from = displayed;
      const startTime = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - startTime) / 260);
        displayed = from + (goal - from) * (1 - (1 - progress) ** 3);
        totalElement.textContent = formatAmount(displayed);
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    // Same timing as the CSS row animation: first row after 150 ms, then every 150 ms.
    bookingRows.forEach((row, i) => {
      setTimeout(() => {
        target += signedAmount(row);
        animateTo(target);
      }, 150 + i * 150);
    });
  }
}
