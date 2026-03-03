"use client";

function sortBooksByNewest(items) {
  return [...items].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export default function BookList({
  books,
  selectedBookId,
  bookActionId,
  catalogPage,
  catalogTotalPages,
  catalogTotalItems,
  booksLoading,
  pageSize,
  onSelectBook,
  onBookAction,
  onPageChange,
}) {
  const orderedBooks = sortBooksByNewest(books);

  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Catalog</p>
          <h3 className="mt-2 text-2xl font-semibold">Library Books</h3>
          <p className="mt-1 text-sm text-slate-500">
            Page {catalogPage} of {catalogTotalPages}
          </p>
        </div>
        {booksLoading && <span className="text-sm text-slate-500">Refreshing...</span>}
      </div>

      {orderedBooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500">
          {booksLoading
            ? "Loading library titles in the background..."
            : "No books yet. Upload the first title to start the library."}
        </div>
      ) : (
        <div className="grid gap-4">
          {orderedBooks.map((book) => {
            const isSelected = selectedBookId === book.id;
            const isBusy = bookActionId === book.id;

            return (
              <div
                key={book.id}
                className={`rounded-2xl border px-4 py-4 transition ${
                  isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <button
                      type="button"
                      onClick={() => void onSelectBook(book.id)}
                      className={`text-left text-lg font-semibold ${
                        isSelected ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {book.title}
                    </button>
                    <p className={isSelected ? "text-slate-300" : "text-slate-600"}>
                      {book.author || "Unknown author"}
                    </p>
                    <p className={`mt-2 text-sm ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                      Summary: {book.summary_status}
                    </p>
                    <p className={`text-sm ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                      File: {book.original_file_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void onBookAction(book.id, "borrow")}
                      disabled={isBusy}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isSelected
                          ? "bg-white text-slate-900 hover:bg-slate-100"
                          : "bg-slate-900 text-white hover:bg-slate-700"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {isBusy ? "Working..." : "Borrow"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onBookAction(book.id, "return")}
                      disabled={isBusy}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isSelected
                          ? "border border-white/40 text-white hover:bg-white/10"
                          : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      Return
                    </button>
                  </div>
                </div>
                {book.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {book.tags.map((tag) => (
                      <span
                        key={`${book.id}-${tag}`}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isSelected ? "bg-white/10 text-slate-100" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {catalogTotalItems > 0 && (
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-500">
            Showing page {catalogPage} with up to {pageSize} books.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void onPageChange(catalogPage - 1)}
              disabled={booksLoading || catalogPage <= 1}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => void onPageChange(catalogPage + 1)}
              disabled={booksLoading || catalogPage >= catalogTotalPages}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
