const film = document.getElementById('product-film');
const chapters = document.getElementById('tour-chapters');
if (film instanceof HTMLVideoElement && chapters) {
  chapters.addEventListener('click', (event) => {
    const link = event.target instanceof Element && event.target.closest('a[data-start]');
    if (!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    film.currentTime = Number(link.dataset.start);
    film.focus();
    film.play().catch(() => film.focus());
  });
}
