import { expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

// Lab 4 makes the Dashboard a Requester's first page; earlier-lab tests start from My Tickets.
// Waits for the list to load, unless a test holds that request open on purpose.
export async function openMyTickets({ waitForList = true } = {}) {
  await screen.findByRole("heading", { name: "Dashboard" });
  fireEvent.click(screen.getByRole("link", { name: "My Tickets" }));
  if (waitForList) await waitFor(() => expect(screen.queryByText("Loading My Tickets…")).not.toBeInTheDocument());
}
