import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserManagement from "../../src/UserManagement.js";
import * as api from "../../src/api.js";

const admin: api.AdminUser = {
  id: 1,
  name: "Ari Admin",
  email: "ari.admin@example.test",
  role: "ADMINISTRATOR",
  isActive: true,
};
const requester: api.AdminUser = {
  id: 2,
  name: "Niran Requester",
  email: "niran@example.test",
  role: "REQUESTER",
  isActive: false,
};

afterEach(() => vi.restoreAllMocks());

describe("Administrator User Management UI", () => {
  it("lists safe user data and applies name/email search and role filters", async () => {
    const getUsers = vi.spyOn(api, "getAdminUsers").mockResolvedValue([admin, requester]);
    const user = userEvent.setup();
    render(<UserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByText("ari.admin@example.test")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Search name or email" }), "niran");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by role" }), "REQUESTER");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(getUsers).toHaveBeenLastCalledWith({ search: "niran", role: "REQUESTER" }));
  });

  it("creates and edits users, then sets an initial password without displaying it", async () => {
    vi.spyOn(api, "getAdminUsers").mockResolvedValue([admin, requester]);
    const create = vi.spyOn(api, "createAdminUser").mockResolvedValue({ user: admin, mustChangePassword: true });
    const update = vi.spyOn(api, "updateAdminUser").mockResolvedValue({ ...requester, name: "Niran Updated" });
    const reset = vi.spyOn(api, "setAdminUserInitialPassword").mockResolvedValue({ user: requester, mustChangePassword: true });
    const user = userEvent.setup();
    render(<UserManagement />);
    await screen.findByText("niran@example.test");

    await user.click(screen.getByRole("button", { name: "Add user" }));
    await user.type(screen.getByLabelText("Name", { selector: "#admin-user-name" }), "New User");
    await user.type(screen.getByLabelText("Email", { selector: "#admin-user-email" }), "new@example.test");
    await user.type(screen.getByLabelText("Initial password"), "StartPassword123");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({
      name: "New User", email: "new@example.test", role: "REQUESTER", isActive: true, initialPassword: "StartPassword123",
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("must change the initial password");
    expect(screen.queryByText("StartPassword123")).not.toBeInTheDocument();

    const requesterCard = screen.getByText("niran@example.test").closest("article");
    expect(requesterCard).not.toBeNull();
    await user.click(within(requesterCard!).getByRole("button", { name: "Edit" }));
    const nameInput = screen.getByLabelText("Name", { selector: "#admin-user-name" });
    await user.clear(nameInput);
    await user.type(nameInput, "Niran Updated");
    await user.click(screen.getByRole("button", { name: "Save user" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(requester.id, expect.objectContaining({ name: "Niran Updated" })));

    const updatedCard = screen.getByText("niran@example.test").closest("article");
    await user.click(within(updatedCard!).getByRole("button", { name: "Set New Initial Password" }));
    await user.type(screen.getByLabelText("New initial password"), "ResetPassword123");
    await user.click(within(updatedCard!).getByRole("button", { name: "Set password" }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith(requester.id, "ResetPassword123"));
    expect(await screen.findByRole("status")).toHaveTextContent("must be changed at next sign-in");
    expect(screen.queryByText("ResetPassword123")).not.toBeInTheDocument();
  });

  it("requires confirmation before changing account access", async () => {
    vi.spyOn(api, "getAdminUsers").mockResolvedValue([admin]);
    const update = vi.spyOn(api, "updateAdminUser").mockResolvedValue({ ...admin, isActive: false });
    const user = userEvent.setup();
    render(<UserManagement />);
    const card = (await screen.findByText(admin.email)).closest("article");
    await user.click(within(card!).getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("checkbox", { name: "Active account" }));

    const save = screen.getByRole("button", { name: "Save user" });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "I understand and want to continue." }));
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(update).toHaveBeenCalledWith(admin.id, expect.objectContaining({ isActive: false })));
  });

  it("shows distinct empty, no-results, forbidden, and retryable failure states", async () => {
    const getUsers = vi.spyOn(api, "getAdminUsers")
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new api.ApiRequestError("Forbidden", 403))
      .mockRejectedValueOnce(new api.ApiRequestError("Unavailable", 500))
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<UserManagement />);
    expect(await screen.findByText("No users are available.")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Search name or email" }), "missing");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(await screen.findByText("You do not have permission to manage users.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load users");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No users match your search and filters.")).toBeInTheDocument();
    expect(getUsers).toHaveBeenCalledTimes(4);
  });
});
