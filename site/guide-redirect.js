const destination = document.getElementById('guide-destination');
if (destination instanceof HTMLAnchorElement) {
  const next = new URL(destination.href);
  if (!next.hash) next.hash = window.location.hash;
  window.location.replace(next.href);
}
