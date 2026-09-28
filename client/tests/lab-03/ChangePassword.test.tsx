import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChangePassword from "../../src/ChangePassword.js";
import * as api from "../../src/api.js";

const user = {
  id: 1,
  name: "Ari Suksan",
  email: "ari.suksan@example.com",
  role: "REQUESTER" as const,
  isActive: true,
  mustChangePassword: true,
};

afterEach(() => vi.restoreAllMocks());

describe("Change Password", () => {
  it("enforces the password rules and confirmation", async () => {
    const change = vi.spyOn(api, "changePassword");
    const userEventInstance = userEvent.setup();
    render(<ChangePassword user={user} onSuccess={vi.fn()} />);

    await userEventInstance.type(screen.getByLabelText("Current password"), "LocalPassword123");
    await userEventInstance.type(screen.getByLabelText("New password"), "short");
    await userEventInstance.type(screen.getByLabelText("Confirm new password"), "different");
    await userEventInstance.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText(/12–128 characters/)).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it("submits a valid change and continues with the updated user", async () => {
    const updatedUser = { ...user, mustChangePassword: false };
    const onSuccess = vi.fn();
    const change = vi.spyOn(api, "changePassword").mockResolvedValue({
      user: updatedUser,
      requiresPasswordChange: false,
    });
    const userEventInstance = userEvent.setup();
    render(<ChangePassword user={user} onSuccess={onSuccess} />);

    await userEventInstance.type(screen.getByLabelText("Current password"), "LocalPassword123");
    await userEventInstance.type(screen.getByLabelText("New password"), "NewSecurePassword456");
    await userEventInstance.type(screen.getByLabelText("Confirm new password"), "NewSecurePassword456");
    await userEventInstance.click(screen.getByRole("button", { name: "Continue" }));

    expect(change).toHaveBeenCalledWith(
      "LocalPassword123",
      "NewSecurePassword456",
      "NewSecurePassword456",
    );
    expect(onSuccess).toHaveBeenCalledWith(updatedUser);
  });

  it("shows a safe API failure and keeps the form visible", async () => {
    vi.spyOn(api, "changePassword").mockRejectedValue(new Error("Current password is incorrect"));
    const userEventInstance = userEvent.setup();
    render(<ChangePassword user={user} onSuccess={vi.fn()} />);

    await userEventInstance.type(screen.getByLabelText("Current password"), "WrongPassword123");
    await userEventInstance.type(screen.getByLabelText("New password"), "NewSecurePassword456");
    await userEventInstance.type(screen.getByLabelText("Confirm new password"), "NewSecurePassword456");
    await userEventInstance.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });
});
