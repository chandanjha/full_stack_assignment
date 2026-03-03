import { render, screen } from "@testing-library/react";
import Recommendations from "@/components/recommendations/Recommendations";

const recommendations = [
  {
    book: {
      id: "book-1",
      title: "Clean Architecture",
      author: "Robert C. Martin",
      tags: ["architecture", "engineering"],
    },
    score: 92,
    reasons: ["Matches your interest in architecture", "Frequently borrowed by similar readers"],
  },
];

describe("Recommendations", () => {
  it("renders the empty state", () => {
    render(
      <Recommendations
        recommendations={[]}
        intelligenceLoading={false}
      />,
    );

    expect(
      screen.getByText("No unread titles currently match your profile. Upload more books or broaden the catalog."),
    ).toBeInTheDocument();
  });

  it("renders recommendation content", () => {
    render(
      <Recommendations
        recommendations={recommendations}
        intelligenceLoading={false}
      />,
    );

    expect(screen.getByText("Clean Architecture")).toBeInTheDocument();
    expect(screen.getByText("Score 92")).toBeInTheDocument();
    expect(screen.getByText("Matches your interest in architecture")).toBeInTheDocument();
  });
});
