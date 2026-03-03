import { render, screen } from "@testing-library/react";
import BookDetails from "@/components/book/BookDetails";

const selectedBook = {
  id: "book-1",
  title: "Clean Architecture",
  author: "Robert C. Martin",
  tags: ["architecture"],
  original_file_name: "clean-architecture.pdf",
  mime_type: "application/pdf",
  file_size: 2048,
  summary: "A guide to maintainable application boundaries.",
  summary_status: "completed",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const review = {
  id: "review-1",
  user_id: "user-1",
  book_id: "book-1",
  rating: 5,
  comment: "Strong architectural guidance.",
  created_at: "2025-01-02T10:00:00.000Z",
};

describe("BookDetails", () => {
  it("shows a placeholder when no book is selected", () => {
    render(
      <BookDetails
        selectedBook={null}
        detailLoading={false}
        readerConsensus={null}
        reviews={[]}
        reviewForm={{ rating: 5, comment: "" }}
        reviewSubmitting={false}
        onReviewChange={jest.fn()}
        onReviewSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText("Pick a book from the catalog to see reviews and insight.")).toBeInTheDocument();
  });

  it("renders summary, consensus, and reviews for a selected book", () => {
    render(
      <BookDetails
        selectedBook={selectedBook}
        detailLoading={false}
        readerConsensus="Readers consistently praise its structure."
        reviews={[review]}
        reviewForm={{ rating: 5, comment: "" }}
        reviewSubmitting={false}
        onReviewChange={jest.fn()}
        onReviewSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText("A guide to maintainable application boundaries.")).toBeInTheDocument();
    expect(screen.getByText("Readers consistently praise its structure.")).toBeInTheDocument();
    expect(screen.getByText("Strong architectural guidance.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post Review" })).toBeInTheDocument();
  });
});
