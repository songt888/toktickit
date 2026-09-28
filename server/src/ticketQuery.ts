import type { Prisma, TicketPriority, TicketStatus } from "@prisma/client";

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

export type TicketListQuery = {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: TicketPriority;
  currentStatus?: "NEW";
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
  const currentStatus = readString(query, "currentStatus");

  if (
    search === null ||
    categoryId === null ||
    relatedSystemId === null ||
    page === null ||
    pageSize === null ||
    sort === null ||
    order === null ||
    requestedPriority === null ||
    currentStatus === null
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
  if (currentStatus !== undefined && currentStatus !== "NEW") {
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
      ...(currentStatus !== undefined ? { currentStatus } : {}),
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
    ...(options.currentStatus ? { currentStatus: options.currentStatus } : {}),
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

export type StaffTicketListQuery = {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: TicketPriority;
  itPriority?: TicketPriority;
  currentStatus?: TicketStatus;
  ownerId?: number | null;
  sort: StaffTicketSortField;
  order: "asc" | "desc";
  page: number;
  pageSize: TicketPageSize;
};

const ticketPriorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const ticketStatuses: TicketStatus[] = [
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
  const currentStatus = readString(query, "currentStatus");
  const ownerId = readString(query, "ownerId");

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
    currentStatus === null ||
    ownerId === null
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
    (itPriority !== undefined && !ticketPriorities.includes(itPriority as TicketPriority)) ||
    (currentStatus !== undefined && !ticketStatuses.includes(currentStatus as TicketStatus))
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
      ...(currentStatus !== undefined ? { currentStatus: currentStatus as TicketStatus } : {}),
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
    ...(options.currentStatus ? { currentStatus: options.currentStatus } : {}),
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
