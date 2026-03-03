"use client";

export default function ReaderConsensus({
  detailLoading,
  readerConsensus,
}) {
  return (
    <div className="rounded-2xl bg-slate-100 p-4">
      <p className="text-sm font-medium text-slate-500">Reader Consensus</p>
      <p className="mt-2 text-sm leading-7 text-slate-700">
        {detailLoading ? "Refreshing review signals..." : readerConsensus || "No reader insight yet."}
      </p>
    </div>
  );
}
