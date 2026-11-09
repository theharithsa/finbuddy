import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';

const AccountApp = lazy(() => import('@/features/workspace/AccountApp'));
const DemoWorkspace = lazy(() => import('@/features/workspace/DemoWorkspace'));

export default function App() {
  const demo = new URLSearchParams(window.location.search).get('demo') === '1';
  return (
    <>
      <Suspense fallback={<div className="m3-loading m3-fullscreen" role="status">Opening FinBuddy…</div>}>
        {demo ? <DemoWorkspace /> : <AccountApp />}
      </Suspense>
      <Toaster
        position="bottom-center"
        offset={{ bottom: 'var(--finbuddy-toast-bottom, 24px)' }}
        mobileOffset={{ bottom: 'var(--finbuddy-toast-bottom, 16px)' }}
      />
    </>
  );
}
