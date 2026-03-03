import { fireEvent, render, screen } from "@testing-library/react";
import ReviewForm from "@/components/review/ReviewForm";

describe("ReviewForm", () => {
  it("forwards field changes and form submission", () => {
    const handleChange = jest.fn();
    const handleSubmit = jest.fn((event) => {
      event.preventDefault();
    });

    render(
      <ReviewForm
        reviewForm={{
          rating: 5,
          comment: "Worth reading.",
        }}
        reviewSubmitting={false}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("5 / 5"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByDisplayValue("Worth reading."), {
      target: { value: "Even better on a second read." },
    });

    const submitButton = screen.getByRole("button", { name: "Post Review" });
    const form = submitButton.closest("form");

    expect(form).not.toBeNull();
    if (form) {
      fireEvent.submit(form);
    }

    expect(handleChange).toHaveBeenCalledTimes(2);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the disabled submitting state", () => {
    render(
      <ReviewForm
        reviewForm={{
          rating: 3,
          comment: "",
        }}
        reviewSubmitting
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();
  });
});
