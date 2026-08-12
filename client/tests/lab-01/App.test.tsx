import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows Online and the categories returned by the API on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "API Category One" },
        { id: 2, name: "API Category Two" },
      ],
    });

    render(<App />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByText("Online")).toBeInTheDocument();
    expect(screen.getByText("API Category One")).toBeInTheDocument();
    expect(screen.getByText("API Category Two")).toBeInTheDocument();
  });

  it("shows a loading state while the API request is pending", async () => {
    vi.spyOn(api, "checkSystem").mockReturnValue(new Promise(() => {}));

    render(<App />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Check System" }));

    expect(screen.getByRole("status")).toHaveTextContent("Checking backend status");
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("API unavailable"));

    render(<App />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByText("Offline")).toBeInTheDocument();
    expect(screen.getByText("API unavailable")).toBeInTheDocument();
  });
});
