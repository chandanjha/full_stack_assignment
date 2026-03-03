"use client";

const TOAST_VARIANTS = {
  success: {
    accentClassName: "bg-emerald-500",
    borderClassName: "border-emerald-200",
    label: "Success",
    labelClassName: "text-emerald-700",
  },
  error: {
    accentClassName: "bg-red-500",
    borderClassName: "border-red-200",
    label: "Error",
    labelClassName: "text-red-700",
  },
};

export default function Toast({ message, variant = "success", onDismiss }) {
  if (!message) {
    return null;
  }

  const toastVariant = TOAST_VARIANTS[variant] || TOAST_VARIANTS.success;

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-40 flex justify-center sm:justify-end">
      <div
        role="status"
        aria-live={variant === "error" ? "assertive" : "polite"}
        className={`pointer-events-auto w-full max-w-sm rounded-3xl border bg-white/95 p-4 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur ${toastVariant.borderClassName}`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-1 h-2.5 w-2.5 rounded-full ${toastVariant.accentClassName}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${toastVariant.labelClassName}`}>
              {toastVariant.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Dismiss notification"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
