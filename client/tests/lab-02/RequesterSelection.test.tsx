import "@testing-library/jest-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const requesters = [
  { id: 1, name: "Ari Suksan", email: "ari.suksan@example.com" },
  { id: 2, name: "Ben Chaiyo", email: "ben.chaiyo@example.com" },
];

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Development Requester selection", () => {
  it("shows a loading state while requesters are loading", () => {
    vi.spyOn(api, "getRequesters").mockReturnValue(new Promise(() => {}));

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading Development Requesters");
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("shows active requesters and persists the selected requester", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue(requesters);

    render(<App />);

    const select = await screen.findByLabelText(/Choose a Development Requester/);
    expect(screen.getByRole("option", { name: /Ari Suksan/ })).toBeInTheDocument();
    expect(screen.queryByText(/Inactive/)).not.toBeInTheDocument();

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    await userEvent.selectOptions(select, "2");
    expect(continueButton).toBeEnabled();
    await userEvent.click(continueButton);

    expect(window.localStorage.getItem(api.REQUESTER_STORAGE_KEY)).toBe("2");
    expect(screen.getByText("Requester: Ben Chaiyo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Requester" })).toBeInTheDocument();
  });

  it("shows the empty state when there are no active requesters", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue([]);

    render(<App />);

    expect(
      await screen.findByText("No active Development Requesters are available."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("returns to selection when Change Requester is clicked", async () => {
    vi.spyOn(api, "getRequesters").mockResolvedValue(requesters);

    render(<App />);

    const select = await screen.findByLabelText(/Choose a Development Requester/);
    await userEvent.selectOptions(select, "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    expect(screen.getByLabelText(/Choose a Development Requester/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(window.localStorage.getItem(api.REQUESTER_STORAGE_KEY)).toBeNull();
  });

  it("shows a useful error and retry action when the API fails", async () => {
    vi.spyOn(api, "getRequesters").mockRejectedValue(new Error("Requester API unavailable"));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load Development Requesters",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Requester API unavailable");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
