import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../../src/Login.js";
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

describe("Login", () => {
  it("shows field validation without calling the API", async () => {
    const login = vi.spyOn(api, "login");
    const userEventInstance = userEvent.setup();
    render(<Login onSuccess={vi.fn()} />);

    await userEventInstance.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows a busy state and returns the authenticated user on success", async () => {
    const onSuccess = vi.fn();
    const login = vi.spyOn(api, "login").mockResolvedValue({
      user,
      requiresPasswordChange: true,
    });
    const userEventInstance = userEvent.setup();
    render(<Login onSuccess={onSuccess} />);

    await userEventInstance.type(screen.getByLabelText("Email"), user.email);
    await userEventInstance.type(screen.getByLabelText("Password"), "LocalPassword123");
    await userEventInstance.click(screen.getByRole("button", { name: "Sign In" }));

    expect(login).toHaveBeenCalledWith(user.email, "LocalPassword123");
    expect(onSuccess).toHaveBeenCalledWith(user);
  });

  it("shows a safe message for invalid credentials", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new api.ApiRequestError("Invalid email or password", 401));
    const userEventInstance = userEvent.setup();
    render(<Login onSuccess={vi.fn()} />);

    await userEventInstance.type(screen.getByLabelText("Email"), user.email);
    await userEventInstance.type(screen.getByLabelText("Password"), "WrongPassword123");
    await userEventInstance.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to sign in. Check your details and try again.",
    );
  });
});
