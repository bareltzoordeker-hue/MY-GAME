import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/game.css';
import '../shared/consent/banner';
import '../shared/a11y/menu';
import './a11y';
import { initContentTranslation } from '../shared/i18n/contentTranslator';
import { setLang } from '../shared/i18n';

{
  // a language chosen on the site (/game/?lang=en) applies to the game
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'ar' || q === 'he') setLang(q);
}
initContentTranslation();

if (import.meta.env.DEV && location.search.includes('shot=')) void import('./devShots').then((m) => m.runShotMode());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
