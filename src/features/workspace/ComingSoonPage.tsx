import { Sparkles } from '@/components/brand/Icons';
import { Button } from '@/components/ui/button';

export function ComingSoonPage({ title, description, onHome }: { title: string; description: string; onHome: () => void }) {
  return (
    <section className="m3-panel m3-empty">
      <span className="m3-row-icon"><Sparkles size={22} /></span>
      <h1>{title}</h1>
      <span className="m3-chip">Coming soon</span>
      <p>{description}</p>
      <Button variant="secondary" onClick={onHome}>Go to Home</Button>
    </section>
  );
}
