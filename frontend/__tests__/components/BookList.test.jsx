import { fireEvent, render, screen } from "@testing-library/react";
import BookList from "@/components/book/BookList";

const sampleBook = {
  id: "book-1",
  title: "The Pragmatic Programmer",
  author: "Andy Hunt",
  tags: ["engineering", "craft"],
  original_file_name: "pragmatic.pdf",
  mime_type: "application/pdf",
  file_size: 1024,
  summary: "A classic software craftsmanship book.",
  summary_status: "completed",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const newerBook = {
  ...sampleBook,
  id: "book-2",
  title: "Newer Book",
  created_at: "2025-01-02T00:00:00.000Z",
  updated_at: "2025-01-02T00:00:00.000Z",
};

const olderBook = {
  ...sampleBook,
  id: "book-3",
  title: "Older Book",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

describe("BookList", () => {
  it("renders the empty state when the catalog has no books", () => {
    render(
      <BookList
        books={[]}
        selectedBookId={null}
        bookActionId={null}
        catalogPage={1}
        catalogTotalPages={1}
        catalogTotalItems={0}
        booksLoading={false}
        pageSize={2}
        onSelectBook={jest.fn()}
        onBookAction={jest.fn()}
        onPageChange={jest.fn()}
      />,
    );

    expect(screen.getByText("No books yet. Upload the first title to start the library.")).toBeInTheDocument();
  });

  it("invokes selection and borrow callbacks for a rendered book", () => {
    const handleSelectBook = jest.fn();
    const handleBookAction = jest.fn();

    render(
      <BookList
        books={[sampleBook]}
        selectedBookId={sampleBook.id}
        bookActionId={null}
        catalogPage={1}
        catalogTotalPages={2}
        catalogTotalItems={3}
        booksLoading={false}
        pageSize={2}
        onSelectBook={handleSelectBook}
        onBookAction={handleBookAction}
        onPageChange={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: sampleBook.title }));
    fireEvent.click(screen.getByRole("button", { name: "Borrow" }));

    expect(handleSelectBook).toHaveBeenCalledWith(sampleBook.id);
    expect(handleBookAction).toHaveBeenCalledWith(sampleBook.id, "borrow");
    expect(screen.getByText("engineering")).toBeInTheDocument();
  });

  it("renders the newest books first in the library list", () => {
    render(
      <BookList
        books={[olderBook, newerBook]}
        selectedBookId={null}
        bookActionId={null}
        catalogPage={1}
        catalogTotalPages={1}
        catalogTotalItems={2}
        booksLoading={false}
        pageSize={2}
        onSelectBook={jest.fn()}
        onBookAction={jest.fn()}
        onPageChange={jest.fn()}
      />,
    );

    const titleButtons = screen.getAllByRole("button", { name: /Book$/ });

    expect(titleButtons.map((button) => button.textContent)).toEqual(["Newer Book", "Older Book"]);
  });
});
