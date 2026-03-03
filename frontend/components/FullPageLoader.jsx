export default function FullPageLoader({
  visible = true,
  overlay = false,
  badge = "LuminaLib",
  title = "Preparing your reader workspace",
  description = "Loading your account and library shell.",
}) {
  if (!visible) {
    return null;
  }

  const shellClassName = overlay
    ? "fixed inset-0 z-50 bg-slate-950/20 backdrop-blur-sm"
    : "min-h-screen bg-[linear-gradient(135deg,#f6f2e9_0%,#dfe7f2_45%,#f8fafc_100%)] text-slate-900";
  const panelClassName = overlay
    ? "mx-4 w-full max-w-md rounded-3xl border border-white/70 bg-white/95 px-8 py-10 shadow-[0_30px_90px_rgba(15,23,42,0.16)]"
    : "px-6";

  return (
    <div className={shellClassName}>
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={title}
        className="mx-auto flex min-h-screen max-w-4xl items-center justify-center text-center text-slate-900"
      >
        <div className={panelClassName}>
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            {badge}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  );
}
