"use client";

export default function GlobalError({ error, reset }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fff8ee_0%,#f5f3ff_45%,#eef6ff_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <div className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-red-700">
          Application Error
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Something interrupted the workspace</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">
          The app hit an unexpected rendering error. You can retry the current route without
          leaving the session.
        </p>
        <div className="mt-6 w-full rounded-3xl border border-slate-200 bg-white/90 p-5 text-left shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Details</p>
          <p className="mt-3 break-words text-sm leading-7 text-slate-700">
            {error.message || "Unknown application error"}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="mt-8 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
