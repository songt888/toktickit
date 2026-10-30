import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";
import * as api from "../src/api.js";

// Both Ticket Detail screens now load Actions Taken; earlier-lab tests don't care, so default to an empty list.
beforeEach(() => {
  vi.spyOn(api, "getActionsTaken").mockResolvedValue({
    items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 }, ticketUpdatedAt: "2026-10-30T00:00:00.000Z",
  });
});
