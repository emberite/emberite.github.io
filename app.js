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
