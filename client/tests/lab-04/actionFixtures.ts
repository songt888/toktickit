import { vi } from "vitest";
import * as api from "../../src/api.js";

export const staff: api.StaffUser = { id: 31, name: "Nattakit Support", email: "nattakit.support@example.com", role: "IT_STAFF" };
export const admin: api.StaffUser = { id: 32, name: "Pim Admin", email: "pim.admin@example.com", role: "ADMINISTRATOR" };
export const stamp = "2026-10-30T02:00:00.000Z";

export function action(overrides: Partial<api.ActionTaken> = {}): api.ActionTaken {
  return {
    id: 501, ticketId: 801, actionAt: "2026-10-30T01:30:00.000Z", description: "Restarted the print spooler", result: "",
    performedBy: { id: admin.id, name: admin.name }, assignee: { id: staff.id, name: staff.name, role: "IT_STAFF", isActive: true },
    status: "PLANNED", followUpRequired: false, followUpNote: null, attachmentNotes: null, cancellationReason: null,
    version: 1, createdAt: "2026-10-30T01:31:00.000Z", updatedAt: "2026-10-30T01:31:00.000Z",
    ...overrides,
  };
}

export function list(items: api.ActionTaken[], page = 1, totalPages = 1): api.ActionListResponse {
  return { items, pagination: { page, pageSize: 10, totalItems: items.length, totalPages }, ticketUpdatedAt: stamp };
}

export const mockList = (...responses: api.ActionListResponse[]) => {
  const spy = vi.spyOn(api, "getActionsTaken");
  for (const response of responses.slice(0, -1)) spy.mockResolvedValueOnce(response);
  return spy.mockResolvedValue(responses[responses.length - 1]);
};

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
