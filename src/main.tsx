import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import App from './App';
import { initializeRum, reportRuntimeFailure } from './lib/operation-monitoring';
import { ThemeProvider } from './contexts/ThemeContext';
import { Button } from './components/ui/button';

import '@fontsource-variable/roboto';
import './main.css';
import './styles/material.css';
import './styles/workspace.css';
import './styles/expenses.css';
import './styles/account.css';

initializeRum();

const root = document.getElementById('root');
if (!root) throw new Error('Missing FinBuddy application root');

createRoot(root).render(
  <ErrorBoundary onError={reportRuntimeFailure} fallback={<main className="m3-empty m3-fullscreen"><h1>FinBuddy couldn’t open</h1><Button onClick={() => location.reload()}>Reload FinBuddy</Button></main>}>
    <ThemeProvider defaultTheme="light" storageKey="finbuddy-ui-theme">
      <App />
    </ThemeProvider>
  </ErrorBoundary>,
);
