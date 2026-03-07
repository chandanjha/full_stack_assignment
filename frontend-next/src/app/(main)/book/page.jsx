"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getSession } from "@/services/auth-service";
import {
  addBook,
  addBookReview,
  borrowBookById,
  fetchBookReviews,
  fetchBooks,
  returnBookById,
} from "@/services/book-service";

function getSummaryStatusClass(status) {
  if (status === "completed") {
    return "bg-success";
  }
  if (status === "failed") {
    return "bg-danger";
  }
  if (status === "processing") {
    return "bg-warning text-dark";
  }
  return "bg-secondary";
}

function getEmptyAddBookForm() {
  return {
    title: "",
    author: "",
    tags: "",
    file: null,
  };
}

function getEmptyReviewForm() {
  return {
    rating: "5",
    comment: "",
  };
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function getBorrowStatusClass(isBorrowed) {
  return isBorrowed ? "bg-primary" : "bg-light text-dark border";
}

const BOOKS_CACHE_TTL_MS = 2 * 60 * 1000;
const BOOKS_CACHE_KEY_PREFIX = "luminalib_books_cache_v1";
const BOOKS_PAGE_SIZE = 20;

function readBooksCache(cacheKey) {
  if (typeof window === "undefined") {
    return { books: [], meta: null };
  }

  try {
    const rawValue = window.sessionStorage.getItem(cacheKey);
    if (!rawValue) {
      return { books: [], meta: null };
    }

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") {
      return { books: [], meta: null };
    }

    if (Date.now() - Number(parsedValue.cachedAt || 0) > BOOKS_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey);
      return { books: [], meta: null };
    }

    const cachedBooks = Array.isArray(parsedValue.books) ? parsedValue.books : [];
    const hasBorrowStatusField = cachedBooks.every((book) =>
      Object.prototype.hasOwnProperty.call(book || {}, "is_borrowed_by_me")
    );
    if (!hasBorrowStatusField) {
      return { books: [], meta: null };
    }

    return {
      books: cachedBooks,
      meta: parsedValue.meta && typeof parsedValue.meta === "object" ? parsedValue.meta : null,
    };
  } catch {
    return { books: [], meta: null };
  }
}

function writeBooksCache(cacheKey, books, meta) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        books: Array.isArray(books) ? books : [],
        meta: meta && typeof meta === "object" ? meta : null,
        cachedAt: Date.now(),
      })
    );
  } catch {
    // Ignore cache write failures.
  }
}

export default function Book() {
  const session = getSession();
  const accessToken = session?.token?.access_token || "";
  const isLoggedIn = Boolean(accessToken);
  const [currentPage, setCurrentPage] = useState(1);
  const booksCacheKey = `${BOOKS_CACHE_KEY_PREFIX}:${session?.user?.id || "anonymous"}:${currentPage}:${BOOKS_PAGE_SIZE}`;

  const [books, setBooks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(isLoggedIn);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showSummaryBook, setShowSummaryBook] = useState(null);
  const [showReviewBook, setShowReviewBook] = useState(null);
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [addBookError, setAddBookError] = useState("");
  const [addBookForm, setAddBookForm] = useState(getEmptyAddBookForm());
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState("");
  const [reviewModalMode, setReviewModalMode] = useState("submit");
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState(getEmptyReviewForm());
  const [isBorrowActionInProgress, setIsBorrowActionInProgress] = useState(false);
  const [actionBookId, setActionBookId] = useState("");
  const [openActionsBookId, setOpenActionsBookId] = useState("");
  const [operationError, setOperationError] = useState("");
  const [operationMessage, setOperationMessage] = useState("");

  const loadBooks = useCallback(async () => {
    if (!isLoggedIn) {
      setBooks([]);
      setMeta(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const cachedPayload = readBooksCache(booksCacheKey);
    if (cachedPayload.books.length > 0) {
      setBooks(cachedPayload.books);
      setMeta(cachedPayload.meta);
      setIsLoading(false);
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
      setIsRefreshing(false);
    }

    setError("");
    try {
      const payload = await fetchBooks(accessToken, { page: currentPage, pageSize: BOOKS_PAGE_SIZE });
      setBooks(payload.books);
      setMeta(payload.meta || null);
      writeBooksCache(booksCacheKey, payload.books, payload.meta || null);
    } catch (requestError) {
      setError(requestError.message || "Unable to fetch books");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, booksCacheKey, currentPage, isLoggedIn]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const openAddBookModal = () => {
    setAddBookError("");
    setShowAddBookModal(true);
  };

  const closeAddBookModal = (forceClose = false) => {
    if (isAddingBook && !forceClose) {
      return;
    }
    setShowAddBookModal(false);
    setAddBookError("");
    setAddBookForm(getEmptyAddBookForm());
  };

  const handleAddBookInputChange = (event) => {
    const { name, value } = event.target;
    setAddBookForm((previousState) => ({
      ...previousState,
      [name]: value,
    }));
  };

  const handleAddBookFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setAddBookForm((previousState) => ({
      ...previousState,
      file: selectedFile,
    }));
  };

  const handleAddBookSubmit = async (event) => {
    event.preventDefault();
    setAddBookError("");
    setSuccessMessage("");

    if (!addBookForm.title.trim()) {
      setAddBookError("Title is required");
      return;
    }

    if (!addBookForm.file) {
      setAddBookError("Please choose a .txt or .pdf file");
      return;
    }

    setIsAddingBook(true);
    try {
      const payload = await addBook(accessToken, {
        title: addBookForm.title.trim(),
        author: addBookForm.author.trim(),
        tags: addBookForm.tags.trim(),
        file: addBookForm.file,
      });
      setSuccessMessage(payload?.message || "Book added successfully");
      closeAddBookModal(true);
      await loadBooks();
    } catch (requestError) {
      setAddBookError(requestError.message || "Unable to add book");
    } finally {
      setIsAddingBook(false);
    }
  };

  const handleBorrow = async (bookId) => {
    setOperationError("");
    setOperationMessage("");
    setIsBorrowActionInProgress(true);
    setActionBookId(bookId);
    try {
      const payload = await borrowBookById(accessToken, bookId);
      setBooks((previousBooks) =>
        previousBooks.map((book) =>
          book.id === bookId
            ? { ...book, is_borrowed_by_me: true }
            : book
        )
      );
      setOperationMessage(payload?.message || "Book borrowed successfully");
    } catch (requestError) {
      setOperationError(requestError.message || "Unable to borrow book");
    } finally {
      setIsBorrowActionInProgress(false);
      setActionBookId("");
    }
  };

  const handleReturn = async (bookId) => {
    setOperationError("");
    setOperationMessage("");
    setIsBorrowActionInProgress(true);
    setActionBookId(bookId);
    try {
      const payload = await returnBookById(accessToken, bookId);
      setBooks((previousBooks) =>
        previousBooks.map((book) =>
          book.id === bookId
            ? { ...book, is_borrowed_by_me: false }
            : book
        )
      );
      setOperationMessage(payload?.message || "Book returned successfully");
    } catch (requestError) {
      setOperationError(requestError.message || "Unable to return book");
    } finally {
      setIsBorrowActionInProgress(false);
      setActionBookId("");
    }
  };

  const toggleActionsMenu = (bookId) => {
    setOpenActionsBookId((previousId) => (previousId === bookId ? "" : bookId));
  };

  const loadReviewsForBook = useCallback(async (bookId) => {
    setIsLoadingReviews(true);
    setReviewError("");
    try {
      const fetchedReviews = await fetchBookReviews(accessToken, bookId);
      setReviews(fetchedReviews);
    } catch (requestError) {
      setReviewError(requestError.message || "Unable to fetch reviews");
      setReviews([]);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [accessToken]);

  const openReviewModal = async (book, mode = "submit") => {
    setShowReviewBook(book);
    setReviewModalMode(mode);
    setReviewError("");
    setReviewSuccessMessage("");
    setReviewForm(getEmptyReviewForm());
    setReviews([]);
    await loadReviewsForBook(book.id);
  };

  const closeReviewModal = () => {
    if (isSubmittingReview) {
      return;
    }
    setShowReviewBook(null);
    setReviewError("");
    setReviewSuccessMessage("");
    setReviewModalMode("submit");
    setReviewForm(getEmptyReviewForm());
    setReviews([]);
  };

  const handleReviewInputChange = (event) => {
    const { name, value } = event.target;
    setReviewForm((previousState) => ({
      ...previousState,
      [name]: value,
    }));
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!showReviewBook) {
      return;
    }

    setReviewError("");
    setReviewSuccessMessage("");

    const rating = Number(reviewForm.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setReviewError("Rating must be between 1 and 5");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const payload = await addBookReview(accessToken, showReviewBook.id, {
        rating,
        comment: reviewForm.comment.trim() || null,
      });
      setOperationError("");
      setOperationMessage(payload?.message || "Review submitted successfully");
      setShowReviewBook(null);
      setReviewError("");
      setReviewSuccessMessage("");
      setReviewForm(getEmptyReviewForm());
      setReviews([]);
    } catch (requestError) {
      setReviewError(requestError.message || "Unable to submit review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const hasBooks = books.length > 0;
  const totalPages = Math.max(meta?.total_pages || 0, 1);
  const canGoPrevious = Boolean(meta?.has_prev) && !isLoading && !isRefreshing;
  const canGoNext = Boolean(meta?.has_next) && !isLoading && !isRefreshing;
  const firstItemNumber = hasBooks ? ((currentPage - 1) * BOOKS_PAGE_SIZE) + 1 : 0;
  const lastItemNumber = hasBooks ? firstItemNumber + books.length - 1 : 0;

  const goToPreviousPage = () => {
    if (!canGoPrevious) {
      return;
    }
    setCurrentPage((previousPage) => Math.max(previousPage - 1, 1));
  };

  const goToNextPage = () => {
    if (!canGoNext) {
      return;
    }
    setCurrentPage((previousPage) => previousPage + 1);
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="text-primary mb-0">Book List</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openAddBookModal}
          disabled={!isLoggedIn}
        >
          <span className="me-1" aria-hidden="true">➕</span>
          Book
        </button>
      </div>

      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}
      {operationMessage ? <div className="alert alert-success py-2">{operationMessage}</div> : null}
      {operationError ? <div className="alert alert-danger py-2">{operationError}</div> : null}
      {isRefreshing ? <div className="text-muted small mb-2">Refreshing books...</div> : null}

      {!isLoggedIn ? (
        <div className="alert alert-warning">
          Please{" "}
          <Link href="/login" className="alert-link">
            login
          </Link>{" "}
          to view books.
        </div>
      ) : null}

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="table-responsive">
        <table className="table table-striped table-bordered table-hover align-middle">
          <thead className="table-dark">
            <tr>
              <th scope="col">#</th>
              <th scope="col">Title</th>
              <th scope="col">Author</th>
              <th scope="col">Tags</th>
              <th scope="col">Summary Status</th>
              <th scope="col">Borrow Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="7" className="text-center py-4">
                  Loading books...
                </td>
              </tr>
            ) : hasBooks ? (
              books.map((book, index) => {
                const isBorrowed = Boolean(book.is_borrowed_by_me);
                const isActionLoading = isBorrowActionInProgress && actionBookId === book.id;
                const isActionsMenuOpen = openActionsBookId === book.id;

                return (
                  <tr key={book.id}>
                  <td>{((currentPage - 1) * BOOKS_PAGE_SIZE) + index + 1}</td>
                  <td>{book.title}</td>
                  <td>{book.author || "-"}</td>
                  <td>{Array.isArray(book.tags) && book.tags.length > 0 ? book.tags.join(", ") : "-"}</td>
                  <td>
                    <span className={`badge ${getSummaryStatusClass(book.summary_status)}`}>
                      {book.summary_status || "-"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getBorrowStatusClass(isBorrowed)}`}>
                      {isBorrowed ? "Borrowed by you" : "Not borrowed"}
                    </span>
                  </td>
                  <td>
                    <div className="dropdown">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm dropdown-toggle"
                        onClick={() => toggleActionsMenu(book.id)}
                        aria-expanded={isActionsMenuOpen}
                      >
                        Actions
                      </button>
                      <div className={`dropdown-menu dropdown-menu-end ${isActionsMenuOpen ? "show" : ""}`}>
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={() => {
                            setOpenActionsBookId("");
                            setShowSummaryBook(book);
                          }}
                        >
                          View Summary
                        </button>
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={() => {
                            setOpenActionsBookId("");
                            openReviewModal(book, "submit");
                          }}
                        >
                          Submit Review
                        </button>
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={() => {
                            setOpenActionsBookId("");
                            openReviewModal(book, "view");
                          }}
                        >
                          View Reviews
                        </button>
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={async () => {
                            setOpenActionsBookId("");
                            await handleBorrow(book.id);
                          }}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? "Working..." : "Borrow"}
                        </button>
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={async () => {
                            setOpenActionsBookId("");
                            await handleReturn(book.id);
                          }}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? "Working..." : "Return"}
                        </button>
                      </div>
                    </div>
                  </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-4">
                  {isLoggedIn ? "No books found." : "No data to display."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isLoggedIn && meta ? (
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          <small className="text-muted">
            {hasBooks
              ? `Showing ${firstItemNumber}-${lastItemNumber} of ${meta.total_items || 0} books`
              : "No books to display"}
          </small>
          <div className="btn-group" role="group" aria-label="Book list pagination">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={goToPreviousPage}
              disabled={!canGoPrevious}
            >
              Previous
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled>
              Page {meta.page || currentPage} of {totalPages}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={goToNextPage}
              disabled={!canGoNext}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {showAddBookModal ? (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Add Book</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeAddBookModal}
                    disabled={isAddingBook}
                  />
                </div>
                <form onSubmit={handleAddBookSubmit}>
                  <div className="modal-body">
                    {addBookError ? <div className="alert alert-danger py-2">{addBookError}</div> : null}

                    <div className="mb-3">
                      <label htmlFor="book-title" className="form-label">
                        Title
                      </label>
                      <input
                        id="book-title"
                        name="title"
                        type="text"
                        className="form-control"
                        value={addBookForm.title}
                        onChange={handleAddBookInputChange}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="book-author" className="form-label">
                        Author
                      </label>
                      <input
                        id="book-author"
                        name="author"
                        type="text"
                        className="form-control"
                        value={addBookForm.author}
                        onChange={handleAddBookInputChange}
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="book-tags" className="form-label">
                        Tags
                      </label>
                      <input
                        id="book-tags"
                        name="tags"
                        type="text"
                        className="form-control"
                        value={addBookForm.tags}
                        onChange={handleAddBookInputChange}
                        placeholder="fiction, thriller, self-help"
                      />
                    </div>

                    <div>
                      <label htmlFor="book-file" className="form-label">
                        Book File (.txt, .pdf)
                      </label>
                      <input
                        id="book-file"
                        type="file"
                        className="form-control"
                        accept=".txt,.pdf,application/pdf,text/plain"
                        onChange={handleAddBookFileChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={closeAddBookModal}
                      disabled={isAddingBook}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isAddingBook}>
                      {isAddingBook ? "Adding..." : "Add Book"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showSummaryBook ? (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Summary: {showSummaryBook.title}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setShowSummaryBook(null)}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-3">
                    Status:{" "}
                    <span className={`badge ${getSummaryStatusClass(showSummaryBook.summary_status)}`}>
                      {showSummaryBook.summary_status || "-"}
                    </span>
                  </p>

                  {showSummaryBook.summary ? (
                    <p style={{ whiteSpace: "pre-wrap" }}>{showSummaryBook.summary}</p>
                  ) : null}

                  {!showSummaryBook.summary && showSummaryBook.summary_status === "failed" ? (
                    <div className="alert alert-danger mb-0">
                      {showSummaryBook.summary_error || "Summary generation failed."}
                    </div>
                  ) : null}

                  {!showSummaryBook.summary && showSummaryBook.summary_status !== "failed" ? (
                    <div className="alert alert-info mb-0">
                      Summary is not ready yet. Please try again after a short time.
                    </div>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowSummaryBook(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showReviewBook ? (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {reviewModalMode === "submit" ? "Submit Review" : "View Reviews"}: {showReviewBook.title}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeReviewModal}
                    disabled={isSubmittingReview}
                  />
                </div>

                <div className="modal-body">
                  {reviewError ? <div className="alert alert-danger py-2">{reviewError}</div> : null}
                  {reviewSuccessMessage ? (
                    <div className="alert alert-success py-2">{reviewSuccessMessage}</div>
                  ) : null}

                  <div className="mb-4">
                    <h6 className="mb-2">Existing Reviews</h6>
                    {isLoadingReviews ? (
                      <p className="text-muted mb-0">Loading reviews...</p>
                    ) : reviews.length > 0 ? (
                      <div className="list-group">
                        {reviews.map((review) => (
                          <div
                            key={review.id}
                            className="list-group-item"
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <strong>Rating: {review.rating}/5</strong>
                              <small className="text-muted">
                                {formatDateTime(review.created_at)}
                              </small>
                            </div>
                            <p className="mb-0 mt-2">{review.comment || "No comment"}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted mb-0">No reviews yet for this book.</p>
                    )}
                  </div>

                  {reviewModalMode === "submit" ? (
                    <>
                      <h6 className="mb-2">Add Your Review</h6>
                      <form onSubmit={handleReviewSubmit}>
                        <div className="mb-3">
                          <label htmlFor="review-rating" className="form-label">
                            Rating
                          </label>
                          <select
                            id="review-rating"
                            name="rating"
                            className="form-select"
                            value={reviewForm.rating}
                            onChange={handleReviewInputChange}
                            disabled={isSubmittingReview}
                          >
                            <option value="5">5 - Excellent</option>
                            <option value="4">4 - Good</option>
                            <option value="3">3 - Average</option>
                            <option value="2">2 - Poor</option>
                            <option value="1">1 - Very Poor</option>
                          </select>
                        </div>

                        <div className="mb-3">
                          <label htmlFor="review-comment" className="form-label">
                            Comment (optional)
                          </label>
                          <textarea
                            id="review-comment"
                            name="comment"
                            rows="4"
                            className="form-control"
                            value={reviewForm.comment}
                            onChange={handleReviewInputChange}
                            placeholder="Write your review..."
                            disabled={isSubmittingReview}
                          />
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={isSubmittingReview}>
                          {isSubmittingReview ? "Submitting..." : "Submit Review"}
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}
    </div>
  );
}
