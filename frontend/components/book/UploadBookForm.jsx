"use client";

export default function UploadBookForm({
  uploadForm,
  fileInputResetKey,
  uploading,
  onChange,
  onSubmit,
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Ingestion</p>
        <h3 className="mt-2 text-2xl font-semibold">Upload a New Book</h3>
        <p className="mt-1 text-sm text-slate-600">
          Upload a `.txt` or `.pdf` file to trigger background summarization.
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <input
          type="text"
          name="title"
          value={uploadForm.title}
          onChange={onChange}
          placeholder="Book title"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-slate-500"
          required
        />
        <input
          type="text"
          name="author"
          value={uploadForm.author}
          onChange={onChange}
          placeholder="Author"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-slate-500"
        />
        <input
          type="text"
          name="tags"
          value={uploadForm.tags}
          onChange={onChange}
          placeholder="Tags (comma separated)"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-slate-500"
        />
        <input
          key={fileInputResetKey}
          type="file"
          name="file"
          onChange={onChange}
          accept=".txt,.pdf"
          className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm"
          required
        />
        <button
          type="submit"
          disabled={uploading}
          className="rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-300"
        >
          {uploading ? "Uploading..." : "Upload Book"}
        </button>
      </form>
    </div>
  );
}
