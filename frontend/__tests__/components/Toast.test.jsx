import { fireEvent, render, screen } from "@testing-library/react";

import Toast from "@/components/Toast";

describe("Toast", () => {
  it("does not render without a message", () => {
    render(<Toast message="" onDismiss={jest.fn()} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders the success message and supports dismiss", () => {
    const handleDismiss = jest.fn();

    render(<Toast message="Review submitted successfully" onDismiss={handleDismiss} />);

    expect(screen.getByRole("status")).toHaveTextContent("Review submitted successfully");
    expect(screen.getByText("Success")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders the error variant", () => {
    render(
      <Toast
        message="You can only review books you have borrowed"
        variant="error"
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("You can only review books you have borrowed");
    expect(screen.getByText("Error")).toBeInTheDocument();
  });
});
