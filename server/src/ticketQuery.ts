import type { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { parseOffsetDate } from "./actionValidation.js";

export const ticketSortFields = [
  "ticketNumber",
  "ticketDate",
  "updatedAt",
  "requestedPriority",
] as const;
export type TicketSortField = (typeof ticketSortFields)[number];
export const ticketPageSizes = [10, 25, 50] as const;
export type TicketPageSize = (typeof ticketPageSizes)[number];

const MAX_SIGNED_INT32 = 2_147_483_647;

// Lab 4 drill-down filters (api-spec section 6); shared by the Requester list and the Staff Queue.
export type DrillDownQuery = {
  currentStatus?: TicketStatus;
  statusGroup?: "active" | "resolved";
  updatedFrom?: Date;
  updatedTo?: Date;
  resolvedFrom?: Date;
  resolvedTo?: Date;
};

// BR-21 active set; "resolved" is RESOLVED/CLOSED (specification section 7).
export const activeTicketStatuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
export const resolvedTicketStatuses: TicketStatus[] = ["RESOLVED", "CLOSED"];

export type TicketListQuery = DrillDownQuery & {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: TicketPriority;
  sort: TicketSortField;
  order: "asc" | "desc";
  page: number;
  pageSize: TicketPageSize;
};

export type QueryParseResult =
  | { value: TicketListQuery; error?: undefined }
  | { value?: undefined; error: string };

export type StaffQueryParseResult =
  | { value: StaffTicketListQuery; error?: undefined }
  | { value?: undefined; error: string };

function readString(query: Record<string, unknown>, key: string): string | null | undefined {
  const raw = query[key];
  if (raw === undefined) return undefined;
  return typeof raw === "string" ? raw : null;
}

function readPositiveInteger(query: Record<string, unknown>, key: string): number | null | undefined {
  const raw = readString(query, key);
  if (raw === undefined) return undefined;
  if (raw === null || !/^\d+$/.test(raw)) return null;

  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_SIGNED_INT32 ? value : null;
}

// Null means the query is invalid (400); unknown/conflicting values never fall back silently.
export function parseDrillDown(query: Record<string, unknown>): DrillDownQuery | null {
  const currentStatus = readString(query, "currentStatus");
  const statusGroup = readString(query, "statusGroup");
  if (currentStatus === null || statusGroup === null) return null;
  if (currentStatus !== undefined && !ticketStatuses.includes(currentStatus as TicketStatus)) return null;
  if (statusGroup !== undefined && statusGroup !== "active" && statusGroup !== "resolved") return null;
  if (currentStatus !== undefined && statusGroup !== undefined) return null;

  const dates: Partial<Record<"updatedFrom" | "updatedTo" | "resolvedFrom" | "resolvedTo", Date>> = {};
  for (const key of ["updatedFrom", "updatedTo", "resolvedFrom", "resolvedTo"] as const) {
    if (query[key] === undefined) continue;
    const date = parseOffsetDate(query[key]);
    if (!date) return null;
    dates[key] = date;
  }
  if (dates.updatedFrom && dates.updatedTo && dates.updatedFrom > dates.updatedTo) return null;
  if (dates.resolvedFrom && dates.resolvedTo && dates.resolvedFrom > dates.resolvedTo) return null;

  return {
    ...(currentStatus !== undefined ? { currentStatus: currentStatus as TicketStatus } : {}),
    ...(statusGroup !== undefined ? { statusGroup: statusGroup as "active" | "resolved" } : {}),
    ...dates,
  };
}

// Both bounds inclusive; a null lastResolvedAt never matches a resolved bound.
export function drillDownWhere(options: DrillDownQuery): Prisma.TicketWhereInput {
  const range = (from?: Date, to?: Date) => ({ ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) });
  return {
    ...(options.currentStatus ? { currentStatus: options.currentStatus } : {}),
    ...(options.statusGroup
      ? { currentStatus: { in: options.statusGroup === "active" ? activeTicketStatuses : resolvedTicketStatuses } }
      : {}),
    ...(options.updatedFrom || options.updatedTo ? { updatedAt: range(options.updatedFrom, options.updatedTo) } : {}),
    ...(options.resolvedFrom || options.resolvedTo ? { lastResolvedAt: range(options.resolvedFrom, options.resolvedTo) } : {}),
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function parseTicketListQuery(query: Record<string, unknown>): QueryParseResult {
  const search = readString(query, "search");
  const categoryId = readPositiveInteger(query, "categoryId");
  const relatedSystemId = readPositiveInteger(query, "relatedSystemId");
  const page = readPositiveInteger(query, "page");
  const pageSize = readPositiveInteger(query, "pageSize");
  const sort = readString(query, "sort");
  const order = readString(query, "order");
  const requestedPriority = readString(query, "requestedPriority");
  const drillDown = parseDrillDown(query);

  if (
    search === null ||
    categoryId === null ||
    relatedSystemId === null ||
    page === null ||
    pageSize === null ||
    sort === null ||
    order === null ||
    requestedPriority === null ||
    drillDown === null
  ) {
    return { error: "Invalid query parameters" };
  }

  if (sort !== undefined && !ticketSortFields.includes(sort as TicketSortField)) {
    return { error: "Invalid query parameters" };
  }
  if (order !== undefined && order !== "asc" && order !== "desc") {
    return { error: "Invalid query parameters" };
  }
  if (pageSize !== undefined && !ticketPageSizes.includes(pageSize as TicketPageSize)) {
    return { error: "Invalid query parameters" };
  }
  if (
    requestedPriority !== undefined &&
    !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(requestedPriority)
  ) {
    return { error: "Invalid query parameters" };
  }
  return {
    value: {
      ...(search ? { search: search.trim() } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(relatedSystemId !== undefined ? { relatedSystemId } : {}),
      ...(requestedPriority !== undefined
        ? { requestedPriority: requestedPriority as TicketPriority }
        : {}),
      ...drillDown,
      sort: (sort ?? "updatedAt") as TicketSortField,
      order: (order ?? "desc") as "asc" | "desc",
      page: page ?? 1,
      pageSize: (pageSize ?? 10) as TicketPageSize,
    },
  };
}

export function buildTicketWhere(
  requesterId: number,
  options: TicketListQuery,
): Prisma.TicketWhereInput {
  const search = options.search ? escapeLikePattern(options.search) : undefined;

  return {
    requesterId,
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.relatedSystemId ? { relatedSystemId: options.relatedSystemId } : {}),
    ...(options.requestedPriority ? { requestedPriority: options.requestedPriority } : {}),
    ...drillDownWhere(options),
    ...(search
      ? {
          OR: [
            { ticketNumber: { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export function buildTicketOrderBy(
  options: TicketListQuery,
): Prisma.TicketOrderByWithRelationInput[] {
  return [{ [options.sort]: options.order }, { id: "desc" }];
}

export const staffTicketSortFields = [
  "ticketNumber",
  "ticketDate",
  "updatedAt",
  "requestedPriority",
  "itPriority",
  "currentStatus",
] as const;
export type StaffTicketSortField = (typeof staffTicketSortFields)[number];

export type StaffTicketListQuery = DrillDownQuery & {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: TicketPriority;
  itPriority?: TicketPriority;
  ownerId?: number | null;
  sort: StaffTicketSortField;
  order: "asc" | "desc";
  page: number;
  pageSize: TicketPageSize;
};

export const ticketPriorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const ticketStatuses: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

export function parseStaffTicketListQuery(query: Record<string, unknown>): StaffQueryParseResult {
  const search = readString(query, "search");
  const categoryId = readPositiveInteger(query, "categoryId");
  const relatedSystemId = readPositiveInteger(query, "relatedSystemId");
  const page = readPositiveInteger(query, "page");
  const pageSize = readPositiveInteger(query, "pageSize");
  const sort = readString(query, "sort");
  const order = readString(query, "order");
  const requestedPriority = readString(query, "requestedPriority");
  const itPriority = readString(query, "itPriority");
  const ownerId = readString(query, "ownerId");
  const drillDown = parseDrillDown(query);

  if (
    search === null ||
    categoryId === null ||
    relatedSystemId === null ||
    page === null ||
    pageSize === null ||
    sort === null ||
    order === null ||
    requestedPriority === null ||
    itPriority === null ||
    ownerId === null ||
    drillDown === null
  ) {
    return { error: "Invalid query parameters" };
  }

  if (sort !== undefined && !staffTicketSortFields.includes(sort as StaffTicketSortField)) {
    return { error: "Invalid query parameters" };
  }
  if (order !== undefined && order !== "asc" && order !== "desc") {
    return { error: "Invalid query parameters" };
  }
  if (pageSize !== undefined && !ticketPageSizes.includes(pageSize as TicketPageSize)) {
    return { error: "Invalid query parameters" };
  }
  if (
    (requestedPriority !== undefined && !ticketPriorities.includes(requestedPriority as TicketPriority)) ||
    (itPriority !== undefined && !ticketPriorities.includes(itPriority as TicketPriority))
  ) {
    return { error: "Invalid query parameters" };
  }

  let parsedOwnerId: number | null | undefined;
  if (ownerId === "unassigned") {
    parsedOwnerId = null;
  } else if (ownerId !== undefined) {
    if (!/^\d+$/.test(ownerId)) return { error: "Invalid query parameters" };
    const value = Number(ownerId);
    if (
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > MAX_SIGNED_INT32
    ) {
      return { error: "Invalid query parameters" };
    }
    parsedOwnerId = value;
  }

  return {
    value: {
      ...(search ? { search: search.trim() } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(relatedSystemId !== undefined ? { relatedSystemId } : {}),
      ...(requestedPriority !== undefined
        ? { requestedPriority: requestedPriority as TicketPriority }
        : {}),
      ...(itPriority !== undefined ? { itPriority: itPriority as TicketPriority } : {}),
      ...drillDown,
      ...(parsedOwnerId !== undefined ? { ownerId: parsedOwnerId } : {}),
      sort: (sort ?? "updatedAt") as StaffTicketSortField,
      order: (order ?? "desc") as "asc" | "desc",
      page: page ?? 1,
      pageSize: (pageSize ?? 10) as TicketPageSize,
    },
  };
}

export function buildStaffTicketWhere(
  options: StaffTicketListQuery,
): Prisma.TicketWhereInput {
  const search = options.search ? escapeLikePattern(options.search) : undefined;

  return {
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.relatedSystemId ? { relatedSystemId: options.relatedSystemId } : {}),
    ...(options.requestedPriority ? { requestedPriority: options.requestedPriority } : {}),
    ...(options.itPriority ? { itPriority: options.itPriority } : {}),
    ...drillDownWhere(options),
    ...(options.ownerId !== undefined ? { ownerId: options.ownerId } : {}),
    ...(search
      ? {
          OR: [
            { ticketNumber: { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { requester: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export function buildStaffTicketOrderBy(
  options: StaffTicketListQuery,
): Prisma.TicketOrderByWithRelationInput[] {
  return [{ [options.sort]: options.order }, { id: "desc" }];
}
