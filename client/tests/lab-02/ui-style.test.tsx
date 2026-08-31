import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { id: 1, name: "Ari Suksan", email: "ari.suksan@example.com" };

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("TokTickIT UI style and accessibility contract", () => {
  it("uses labelled Bootstrap controls, visible required markers, and action hierarchy", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([requester]);
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Network" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Network and Internet" }]);
    const user = userEvent.setup();

    render(<App />);
    await user.selectOptions(
      await screen.findByLabelText(/Choose a Development Requester/),
      String(requester.id),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("link", { name: "Create Ticket" }));

    expect(await screen.findByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/)).toHaveClass("form-select");
    expect(screen.getByLabelText(/Related System/)).toHaveClass("form-select");
    expect(screen.getByLabelText(/Summary/)).toHaveClass("form-control");
    expect(screen.getByLabelText(/Description/)).toHaveClass("form-control");
    expect(screen.getByLabelText(/Attachments/)).toHaveClass("form-control");
    expect(screen.getByRole("button", { name: "Create Ticket" })).toHaveClass("btn-success");
    expect(screen.getByRole("button", { name: "Check System" })).toHaveClass("btn-success");
    expect(screen.getByText("Category", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Related System", { exact: true })).toBeInTheDocument();
    const requiredMarkers = screen.getAllByText("*", { exact: true });
    expect(requiredMarkers).toHaveLength(5);
    expect(requiredMarkers.every((marker) => marker.classList.contains("text-danger"))).toBe(true);
    expect(screen.getByLabelText(/Category/)).toHaveAccessibleName("Category");
    expect(screen.getByLabelText(/Related System/)).toHaveAccessibleName("Related System");
  });
});
