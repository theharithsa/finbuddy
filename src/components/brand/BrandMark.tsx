export function BrandMark({ className = '' }: { className?: string }) {
  return <span className={`finbuddy-mark ${className}`} aria-hidden="true" />;
}

export function Wordmark() {
  return <span className="m3-wordmark"><BrandMark /><strong>FinBuddy</strong></span>;
}
