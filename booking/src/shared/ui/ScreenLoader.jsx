const ScreenLoader = () => (
  <div className="flex min-h-[60vh] grow flex-col items-center justify-center gap-4">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-600 border-t-accent" />
    <p className="text-sm text-mist-muted">Loading…</p>
  </div>
);

export { ScreenLoader };
