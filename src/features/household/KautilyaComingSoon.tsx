import { Sparkles } from '@/components/brand/Icons';
import { Button } from '@/components/ui/button';

export function KautilyaComingSoon({ onHome }: { onHome: () => void }) {
  return (
    <section className="m3-panel m3-empty">
      <span className="m3-row-icon"><Sparkles size={22} /></span>
      <h1>KautilyaAI</h1>
      <span className="m3-chip">Coming soon</span>
      <p>You can track your household money from Home in the meantime.</p>
      <Button variant="secondary" onClick={onHome}>Go to Home</Button>
    </section>
  );
}
