import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/game.css';
import '../shared/consent/banner';
import '../shared/a11y/menu';
import './a11y';
import { initContentTranslation } from '../shared/i18n/contentTranslator';

initContentTranslation();

if (import.meta.env.DEV && location.search.includes('shot=')) void import('./devShots').then((m) => m.runShotMode());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
