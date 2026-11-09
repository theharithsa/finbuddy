import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import App from './App';
import { initializeRum, reportRuntimeFailure } from './lib/operation-monitoring';
import { ThemeProvider } from './contexts/ThemeContext';

import './main.css';
import './styles/theme.css';
import './index.css';
import './styles/finbuddy.css';

initializeRum();

const root = document.getElementById('root');
if (!root) throw new Error('Missing FinBuddy application root');

createRoot(root).render(
  <ErrorBoundary onError={reportRuntimeFailure} fallback={<main className="fb-empty fb-fullscreen"><h1>FinBuddy couldn’t open</h1><button className="fb-button fb-primary" onClick={() => location.reload()}>Reload FinBuddy</button></main>}>
    <ThemeProvider defaultTheme="light" storageKey="finbuddy-ui-theme">
      <App />
    </ThemeProvider>
  </ErrorBoundary>,
);
