import { useEffect, useState, type RefObject } from 'react';
import { isWorkspacePage, type WorkspacePage } from './WorkspaceShell';

function destination(fallback: WorkspacePage, restoreHistory = false): WorkspacePage {
  if (location.pathname.replace(/\/$/, '') === '/finvision') return 'finvision';
  const saved: unknown = restoreHistory ? history.state?.finbuddyPage : undefined;
  return isWorkspacePage(saved) ? saved : fallback;
}
export function useWorkspaceNavigation(initial: WorkspacePage, main: RefObject<HTMLElement | null>) {
  const [page, setPage] = useState(() => destination(initial));
  useEffect(() => {
    function back() {
      setPage(destination(initial, true));
      requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
    }
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [initial, main]);
  function navigate(next: WorkspacePage) {
    if (next !== page) {
      const url = new URL(location.href);
      url.pathname = next === 'finvision' ? '/finvision' : '/';
      url.searchParams.delete('action');
      history.pushState({ finbuddyPage: next }, '', url);
      setPage(next);
    }
    window.scrollTo(0, 0);
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  }
  return { page, navigate };
}
