import { render, screen } from "@testing-library/react";

import FullPageLoader from "@/components/FullPageLoader";

describe("FullPageLoader", () => {
  it("does not render when hidden", () => {
    render(<FullPageLoader visible={false} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders the overlay copy when visible", () => {
    render(
      <FullPageLoader
        overlay
        title="Signing you in"
        description="Please wait while we verify your account."
      />,
    );

    expect(screen.getByRole("status", { name: "Signing you in" })).toBeInTheDocument();
    expect(screen.getByText("Please wait while we verify your account.")).toBeInTheDocument();
  });
});
