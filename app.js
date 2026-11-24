// Copy buttons for manifest URLs.
document.querySelectorAll('button.copy').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const input = document.getElementById(btn.dataset.copy);
    const label = btn.querySelector('span');
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand('copy');
    }
    btn.classList.add('done');
    label.textContent = 'Copied';
    setTimeout(() => { btn.classList.remove('done'); label.textContent = 'Copy'; }, 1800);
  });
});

// Hero carousel: advances every few seconds; pauses while hovered, focused or
// hidden, and doesn't autoplay for people who prefer reduced motion.
const carousel = document.querySelector('.carousel');
if (carousel) {
  const track = carousel.querySelector('.carousel-track');
  const slides = [...track.children];
  const dots = [...carousel.querySelectorAll('.carousel-dots button')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let at = 0;
  let paused = false;
  // Screenshots load lazily; start the current and next ones before they slide in.
  const preload = (j) => { const im = slides[(j + slides.length) % slides.length].querySelector('img'); if (im) im.loading = 'eager'; };
  const go = (i) => {
    at = (i + slides.length) % slides.length;
    preload(at); preload(at + 1); preload(at - 1);
    track.style.transform = `translateX(${-100 * at}%)`;
    slides.forEach((s, j) => { s.inert = j !== at; });
    dots.forEach((d, j) => d.setAttribute('aria-current', String(j === at)));
  };
  addEventListener('load', () => { preload(1); preload(-1); });
  carousel.querySelector('.prev').addEventListener('click', () => go(at - 1));
  carousel.querySelector('.next').addEventListener('click', () => go(at + 1));
  dots.forEach((d, j) => d.addEventListener('click', () => go(j)));
  carousel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(at - 1);
    if (e.key === 'ArrowRight') go(at + 1);
  });
  carousel.addEventListener('mouseenter', () => { paused = true; });
  carousel.addEventListener('mouseleave', () => { paused = false; });
  carousel.addEventListener('focusin', () => { paused = true; });
  carousel.addEventListener('focusout', () => { paused = false; });
  let touchStart = null;
  track.addEventListener('touchstart', (e) => { touchStart = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', (e) => {
    if (touchStart === null) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(dx) > 50) go(at + (dx < 0 ? 1 : -1));
    touchStart = null;
  });
  if (!reduced && slides.length > 1) {
    setInterval(() => { if (!paused && !document.hidden) go(at + 1); }, 5000);
  }
}

// Screenshot lightbox, one gallery per module.
const dialog = document.querySelector('.lightbox');
const lbImg = dialog.querySelector('img');
const lbCap = dialog.querySelector('figcaption');
const prev = dialog.querySelector('.prev');
const next = dialog.querySelector('.next');
const galleries = {};
document.querySelectorAll('[data-gallery-json]').forEach((el) => {
  galleries[el.dataset.galleryJson] = JSON.parse(el.textContent);
});
let current = null;
let index = 0;
let opener = null;

function show(i) {
  const list = galleries[current];
  index = (i + list.length) % list.length;
  const shot = list[index];
  lbImg.src = shot.src;
  lbImg.width = shot.w;
  lbImg.height = shot.h;
  lbImg.alt = shot.alt;
  lbCap.textContent = `${shot.alt}  ·  ${index + 1} / ${list.length}`;
  prev.hidden = next.hidden = list.length < 2;
}

document.querySelectorAll('[data-gallery]').forEach((btn) => {
  btn.addEventListener('click', () => {
    current = btn.dataset.gallery;
    opener = btn;
    show(Number(btn.dataset.index));
    dialog.showModal();
  });
});
prev.addEventListener('click', () => show(index - 1));
next.addEventListener('click', () => show(index + 1));
dialog.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') show(index - 1);
  if (e.key === 'ArrowRight') show(index + 1);
});
// Click outside the image closes.
dialog.addEventListener('click', (e) => {
  if (e.target === dialog || e.target.tagName === 'FIGURE') dialog.close();
});
dialog.addEventListener('close', () => opener?.focus());

// Swipe on touch screens.
let touchX = null;
dialog.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
dialog.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  touchX = null;
});
