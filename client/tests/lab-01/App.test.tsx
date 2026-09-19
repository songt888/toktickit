import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = {
  id: 7,
  name: "Ari Suksan",
  email: "ari.suksan@example.com",
  role: "REQUESTER" as const,
  isActive: true,
  mustChangePassword: false,
};

afterEach(() => vi.restoreAllMocks());

function mockAuthenticatedRequester() {
  vi.spyOn(api, "getCurrentUser").mockResolvedValue({
    user: requester,
    requiresPasswordChange: false,
  });
  vi.spyOn(api, "getCategories").mockResolvedValue([]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
  vi.spyOn(api, "getMyTickets").mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
  });
}

describe("App", () => {
  it("renders the authenticated requester workspace from the session", async () => {
    mockAuthenticatedRequester();

    render(<App />);

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByText("Ari Suksan")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Choose a Development Requester/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
  });

  it("shows the sign-in screen when there is no authenticated session", async () => {
    vi.spyOn(api, "getCurrentUser").mockRejectedValue(new api.ApiRequestError("Authentication required", 401));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "My Tickets" })).not.toBeInTheDocument();
  });
});
