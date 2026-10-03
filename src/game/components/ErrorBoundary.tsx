import { Component, type ErrorInfo, type ReactNode } from 'react';
import { deleteSave } from '../../engine/persistence/save';

/** Last line of defence: a render crash shows a way out instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Game crashed:', error, info.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <div className="text-5xl">🙈</div>
          <h1 className="text-2xl font-black mt-2">משהו השתבש</h1>
          <p className="muted mt-2 leading-relaxed">הממשלה קרסה, והפעם לא באשמתך. אפשר לנסות שוב, ואם זה חוזר – כנראה שהשמירה פגומה.</p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            <button className="btn btn-primary" onClick={() => location.reload()}>🔄 לנסות שוב</button>
            <button className="btn btn-danger" onClick={() => { deleteSave(); location.reload(); }}>🗑️ למחוק את השמירה ולהתחיל מחדש</button>
          </div>
          <p className="text-xs muted mt-3"><a href="/">חזרה לדף הבית</a></p>
        </div>
      </div>
    );
  }
}
