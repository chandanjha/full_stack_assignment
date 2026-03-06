"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { isAuthenticationError } from "@/lib/auth";
import { authService } from "@/services/auth-service";
import { bookService } from "@/services/book-service";

const BOOKS_PAGE_SIZE = 2;

function sortBooksByNewest(items) {
  return [...items].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export function useDashboardController({
  initialUser,
  initialBooks,
  initialCatalogPage,
  initialCatalogTotalPages,
  initialCatalogTotalItems,
  initialSelectedBookId,
  initialReviews,
  initialInsight,
  initialDetailsLoaded,
  initialPreferences,
  initialRecommendations,
}) {
  const router = useRouter();

  const [user, setUser] = useState(initialUser);
  const [books, setBooks] = useState(() => sortBooksByNewest(initialBooks));
  const [catalogPage, setCatalogPage] = useState(initialCatalogPage);
  const [catalogTotalPages, setCatalogTotalPages] = useState(initialCatalogTotalPages);
  const [catalogTotalItems, setCatalogTotalItems] = useState(initialCatalogTotalItems);
  const [selectedBookId, setSelectedBookId] = useState(initialSelectedBookId);
  const [reviews, setReviews] = useState(initialReviews);
  const [insight, setInsight] = useState(initialInsight);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [recommendations, setRecommendations] = useState(initialRecommendations);

  const [profileLoading, setProfileLoading] = useState(Boolean(initialUser === null));
  const [booksLoading, setBooksLoading] = useState(Boolean(initialUser === null));
  const [detailLoading, setDetailLoading] = useState(
    Boolean(initialSelectedBookId && !initialDetailsLoaded),
  );
  const [preferencesLoading, setPreferencesLoading] = useState(Boolean(initialPreferences === null));
  const [recommendationsLoading, setRecommendationsLoading] = useState(
    Boolean(initialPreferences === null),
  );
  const [uploading, setUploading] = useState(false);
  const [uploadFormResetKey, setUploadFormResetKey] = useState(0);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [bookActionId, setBookActionId] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [uploadForm, setUploadForm] = useState({
    title: "",
    author: "",
    tags: "",
    file: null,
  });
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: "",
  });
  const hasHydratedInitialData = useRef(false);

  const selectedBook = books.find((book) => book.id === selectedBookId) ?? null;

  const handleAuthAwareError = (loadError) => {
    const message = loadError instanceof Error ? loadError.message : "Something went wrong";
    if (isAuthenticationError(message)) {
      void authService.logout().finally(() => {
        router.push("/login");
      });
      return;
    }
    setError(message);
  };

  const clearFeedback = () => {
    setError("");
    setNotice("");
  };

  const loadProfile = async (options = {}) => {
    const { showLoading = true } = options;

    if (showLoading) {
      setProfileLoading(true);
    }

    try {
      const profileResponse = await authService.getProfile();
      setUser(profileResponse.data);
    } catch (loadError) {
      handleAuthAwareError(loadError);
    } finally {
      if (showLoading) {
        setProfileLoading(false);
      }
    }
  };

  const loadBookDetails = async (bookId, options = {}) => {
    const { showLoading = true } = options;

    if (showLoading) {
      setDetailLoading(true);
    }

    try {
      const details = await bookService.getBookDetails(bookId);
      setReviews(details.reviews);
      setInsight(details.insight);
    } catch (loadError) {
      handleAuthAwareError(loadError);
    } finally {
      if (showLoading) {
        setDetailLoading(false);
      }
    }
  };

  const loadBooks = async (page = catalogPage, preferredBookId) => {
    setBooksLoading(true);
    try {
      const response = await bookService.listBooks(page, BOOKS_PAGE_SIZE);
      const orderedBooks = sortBooksByNewest(response.data);
      setBooks(orderedBooks);
      setCatalogPage(response.meta.page);
      setCatalogTotalPages(Math.max(response.meta.total_pages, 1));
      setCatalogTotalItems(response.meta.total_items);

      const nextSelectedBookId =
        preferredBookId && orderedBooks.some((book) => book.id === preferredBookId)
          ? preferredBookId
          : orderedBooks[0]?.id ?? null;

      setSelectedBookId(nextSelectedBookId);

      if (nextSelectedBookId) {
        void loadBookDetails(nextSelectedBookId);
      } else {
        setReviews([]);
        setInsight(null);
      }
    } catch (loadError) {
      handleAuthAwareError(loadError);
    } finally {
      setBooksLoading(false);
    }
  };

  const handlePageChange = async (nextPage) => {
    if (nextPage < 1 || nextPage > catalogTotalPages || nextPage === catalogPage) {
      return;
    }

    clearFeedback();
    await loadBooks(nextPage);
  };

  const loadPreferences = async (options = {}) => {
    const { showLoading = true } = options;

    if (showLoading) {
      setPreferencesLoading(true);
    }

    try {
      const preferencesResponse = await bookService.getReaderPreferences();
      setPreferences(preferencesResponse.data);
    } catch (loadError) {
      handleAuthAwareError(loadError);
    } finally {
      if (showLoading) {
        setPreferencesLoading(false);
      }
    }
  };

  const loadRecommendations = async (options = {}) => {
    const { limit = 5, showLoading = true } = options;

    if (showLoading) {
      setRecommendationsLoading(true);
    }

    try {
      const recommendationsResponse = await bookService.getRecommendations(limit);
      setRecommendations(recommendationsResponse.data);
    } catch (loadError) {
      handleAuthAwareError(loadError);
    } finally {
      if (showLoading) {
        setRecommendationsLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
    } catch {
      // Cookie cleanup should still complete even if the token is already invalid.
    } finally {
      router.push("/login");
    }
  };

  const handleUploadChange = (event) => {
    const { name, value, files } = event.target;

    if (name === "file") {
      setUploadForm((prev) => ({
        ...prev,
        file: files?.[0] ?? null,
      }));
      return;
    }

    setUploadForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleReviewChange = (event) => {
    const { name, value } = event.target;
    setReviewForm((prev) => ({
      ...prev,
      [name]: name === "rating" ? Number(value) : value,
    }));
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!uploadForm.file) {
      setError("Please choose a book file before uploading.");
      return;
    }

    clearFeedback();
    setUploading(true);

    try {
      const response = await bookService.createBook({
        title: uploadForm.title,
        author: uploadForm.author || undefined,
        tags: uploadForm.tags || undefined,
        file: uploadForm.file,
      });
      const createdBook = response.data;

      setNotice(response.message);
      setUploadForm({
        title: "",
        author: "",
        tags: "",
        file: null,
      });
      setBooks((currentBooks) =>
        sortBooksByNewest([
          createdBook,
          ...currentBooks.filter((book) => book.id !== createdBook.id),
        ]).slice(0, BOOKS_PAGE_SIZE),
      );
      setCatalogPage(1);
      setCatalogTotalItems((currentTotal) => currentTotal + 1);
      setCatalogTotalPages((currentTotalPages) => Math.max(currentTotalPages, 1));
      setSelectedBookId(createdBook.id);
      setReviews([]);
      setInsight(null);
      setUploadFormResetKey((currentKey) => currentKey + 1);
      void loadBooks(1, createdBook.id);
    } catch (submitError) {
      handleAuthAwareError(submitError);
    } finally {
      setUploading(false);
    }
  };

  const handleBookAction = async (bookId, action) => {
    clearFeedback();
    setBookActionId(bookId);

    try {
      const response =
        action === "borrow"
          ? await bookService.borrowBook(bookId)
          : await bookService.returnBook(bookId);
      setNotice(response.message);
      void loadBookDetails(bookId);
      void loadPreferences();
      void loadRecommendations();
    } catch (actionError) {
      handleAuthAwareError(actionError);
    } finally {
      setBookActionId(null);
    }
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!selectedBookId) {
      return;
    }

    clearFeedback();
    setReviewSubmitting(true);

    try {
      const response = await bookService.createReview(selectedBookId, {
        rating: reviewForm.rating,
        comment: reviewForm.comment || undefined,
      });
      setNotice(response.message);
      setReviewForm({
        rating: 5,
        comment: "",
      });
      void loadBookDetails(selectedBookId);
    } catch (submitError) {
      handleAuthAwareError(submitError);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSelectBook = async (bookId) => {
    setSelectedBookId(bookId);
    clearFeedback();
    await loadBookDetails(bookId);
  };

  useEffect(() => {
    if (hasHydratedInitialData.current) {
      return;
    }

    hasHydratedInitialData.current = true;

    if (initialUser === null) {
      void loadProfile();
    }

    if (initialBooks.length === 0) {
      void loadBooks(1);
    } else if (initialSelectedBookId && !initialDetailsLoaded) {
      void loadBookDetails(initialSelectedBookId);
    }

    if (initialPreferences === null) {
      void loadPreferences();
      void loadRecommendations();
    }
  }, [
    initialDetailsLoaded,
    initialBooks.length,
    initialPreferences,
    initialSelectedBookId,
    initialUser,
  ]);

  return {
    user,
    profileLoading,
    books,
    catalogPage,
    catalogTotalPages,
    catalogTotalItems,
    selectedBookId,
    selectedBook,
    reviews,
    insight,
    preferences,
    recommendations,
    booksLoading,
    detailLoading,
    preferencesLoading,
    recommendationsLoading,
    uploading,
    reviewSubmitting,
    bookActionId,
    loggingOut,
    error,
    notice,
    uploadForm,
    uploadFormResetKey,
    reviewForm,
    pageSize: BOOKS_PAGE_SIZE,
    handlePageChange,
    handleLogout,
    handleUploadChange,
    handleReviewChange,
    handleUploadSubmit,
    handleBookAction,
    handleReviewSubmit,
    handleSelectBook,
  };
}
