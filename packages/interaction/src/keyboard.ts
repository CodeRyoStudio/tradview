export interface ChartKeyboardActions {
  fitContent?: () => void;
  scrollToRealtime?: () => void;
  toggleFullscreen?: () => void;
  exportImage?: () => void;
  toggleLogScale?: () => void;
  toggleTheme?: () => void;
}

export function bindChartKeyboard(actions: ChartKeyboardActions): () => void {
  const handler = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const key = e.key.toLowerCase();
    if (key === 'f' && !e.ctrlKey && !e.metaKey) {
      actions.toggleFullscreen?.();
      e.preventDefault();
    } else if (key === 's' && !e.ctrlKey && !e.metaKey) {
      actions.exportImage?.();
      e.preventDefault();
    } else if (key === 'l' && !e.ctrlKey && !e.metaKey) {
      actions.toggleLogScale?.();
      e.preventDefault();
    } else if (key === 't' && !e.ctrlKey && !e.metaKey) {
      actions.toggleTheme?.();
      e.preventDefault();
    } else if (key === 'r' && !e.ctrlKey && !e.metaKey) {
      actions.fitContent?.();
      e.preventDefault();
    } else if (e.key === 'End' || (key === 'arrowright' && e.altKey)) {
      actions.scrollToRealtime?.();
      e.preventDefault();
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}