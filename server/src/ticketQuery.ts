import type { Prisma, TicketPriority } from "@prisma/client";

export const ticketSortFields = [
  "ticketNumber",
  "ticketDate",
  "updatedAt",
  "requestedPriority",
] as const;
export type TicketSortField = (typeof ticketSortFields)[number];
export const ticketPageSizes = [10, 25, 50] as const;
export type TicketPageSize = (typeof ticketPageSizes)[number];

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
  return Number.isSafeInteger(value) && value > 0 ? value : null;
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
  return {
    requesterId,
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    ...(options.relatedSystemId ? { relatedSystemId: options.relatedSystemId } : {}),
    ...(options.requestedPriority ? { requestedPriority: options.requestedPriority } : {}),
    ...(options.currentStatus ? { currentStatus: options.currentStatus } : {}),
    ...(options.search
      ? {
          OR: [
            { ticketNumber: { contains: options.search, mode: "insensitive" } },
            { summary: { contains: options.search, mode: "insensitive" } },
            { description: { contains: options.search, mode: "insensitive" } },
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
