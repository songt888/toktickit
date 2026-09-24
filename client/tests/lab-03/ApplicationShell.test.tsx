import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requester = {
  id: 1,
  name: "Ari Suksan",
  email: "ari.suksan@example.com",
  role: "REQUESTER" as const,
  isActive: true,
  mustChangePassword: false,
};
const staff = {
  id: 2,
  name: "Nattakit Support",
  email: "nattakit.support@example.com",
  role: "IT_STAFF" as const,
  isActive: true,
  mustChangePassword: false,
};

afterEach(() => vi.restoreAllMocks());

function mockRequesterWorkspace() {
  vi.spyOn(api, "getMyTickets").mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
  });
  vi.spyOn(api, "getCategories").mockResolvedValue([]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
}

function mockStaffWorkspace() {
  vi.spyOn(api, "getStaffTickets").mockResolvedValue({
    items: [],
    pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
  });
  vi.spyOn(api, "getCategories").mockResolvedValue([]);
  vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]);
}

describe("Authenticated application shell", () => {
  it("shows the safe user, role, permitted navigation, and no requester selector", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      user: requester,
      requiresPasswordChange: false,
    });
    mockRequesterWorkspace();
    render(<App />);

    expect(await screen.findByText("Ari Suksan")).toBeInTheDocument();
    expect(screen.getByText("REQUESTER")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Choose a Development Requester/)).not.toBeInTheDocument();
    expect(screen.queryByText(/passwordHash/i)).not.toBeInTheDocument();
  });

  it("keeps normal screens blocked when the session requires a password change", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      user: { ...requester, mustChangePassword: true },
      requiresPasswordChange: true,
    });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Change your password" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Tickets" })).not.toBeInTheDocument();
  });

  it("shows the staff queue navigation and workspace for an IT Staff session", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      user: staff,
      requiresPasswordChange: false,
    });
    mockStaffWorkspace();

    render(<App />);

    expect(await screen.findByText("Nattakit Support")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "My Tickets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Ticket" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
  });

  it("clears the authenticated shell after logout", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      user: requester,
      requiresPasswordChange: false,
    });
    vi.spyOn(api, "logout").mockResolvedValue();
    mockRequesterWorkspace();
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("Ari Suksan");
    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Ari Suksan")).not.toBeInTheDocument();
  });
});
