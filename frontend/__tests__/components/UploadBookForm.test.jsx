import { fireEvent, render, screen } from "@testing-library/react";
import UploadBookForm from "@/components/book/UploadBookForm";

describe("UploadBookForm", () => {
  it("renders the form and forwards change and submit events", () => {
    const handleChange = jest.fn();
    const handleSubmit = jest.fn((event) => {
      event.preventDefault();
    });

    render(
      <UploadBookForm
        uploadForm={{
          title: "Dune",
          author: "Frank Herbert",
          tags: "science fiction",
          file: null,
        }}
        uploading={false}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Dune"), {
      target: { value: "Dune Messiah" },
    });

    const submitButton = screen.getByRole("button", { name: "Upload Book" });
    const form = submitButton.closest("form");

    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the uploading state on the submit button", () => {
    render(
      <UploadBookForm
        uploadForm={{
          title: "",
          author: "",
          tags: "",
          file: null,
        }}
        uploading
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Uploading..." })).toBeDisabled();
  });
});
