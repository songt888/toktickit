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

function mockWorkspace() {
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

describe("Authenticated requester context", () => {
  it("shows the requester from the authenticated session without a selector", async () => {
    mockWorkspace();

    render(<App />);

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByText("Tickets created by Ari Suksan.")).toBeInTheDocument();
    expect(screen.getByText("Ari Suksan")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Choose a Development Requester/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
  });

  it("does not read or write a requester identity in local storage", async () => {
    mockWorkspace();

    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });

    expect(window.localStorage.length).toBe(0);
    expect(screen.queryByText(/Development Requester/)).not.toBeInTheDocument();
  });

  it("shows sign in when the authenticated session is unavailable", async () => {
    vi.spyOn(api, "getCurrentUser").mockRejectedValue(new api.ApiRequestError("Authentication required", 401));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
