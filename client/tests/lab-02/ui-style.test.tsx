import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = { id: 1, name: "Ari Suksan", email: "ari.suksan@example.com" };
const authUser: api.AuthUser = {
  ...requester,
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TokTickIT UI style and accessibility contract", () => {
  it("uses labelled Bootstrap controls, visible required markers, and action hierarchy", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      user: authUser,
      requiresPasswordChange: false,
    });
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Network" }]);
    vi.spyOn(api, "getRelatedSystems").mockResolvedValue([{ id: 1, name: "Network and Internet" }]);
    vi.spyOn(api, "getMyTickets").mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    await user.click(screen.getByRole("link", { name: "Create Ticket" }));

    expect(await screen.findByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/, { selector: "#ticket-category" })).toHaveClass("form-select");
    expect(screen.getByLabelText(/Related System/, { selector: "#ticket-related-system" })).toHaveClass("form-select");
    expect(screen.getByLabelText(/Summary/)).toHaveClass("form-control");
    expect(screen.getByLabelText(/Description/)).toHaveClass("form-control");
    expect(screen.getByLabelText(/Attachments/)).toHaveClass("form-control");
    expect(screen.getByRole("button", { name: "Create Ticket" })).toHaveClass("btn-success");
    expect(screen.queryByRole("button", { name: "Check System" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Request categories" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Category", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Related System", { exact: true }).length).toBeGreaterThan(0);
    const requiredMarkers = screen.getAllByText("*", { exact: true });
    expect(requiredMarkers).toHaveLength(5);
    expect(requiredMarkers.every((marker) => marker.classList.contains("text-danger"))).toBe(true);
    expect(screen.getByLabelText(/Category/, { selector: "#ticket-category" })).toHaveAccessibleName("Category");
    expect(screen.getByLabelText(/Related System/, { selector: "#ticket-related-system" })).toHaveAccessibleName("Related System");
  });
});
