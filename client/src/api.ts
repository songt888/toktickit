const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: TicketPriority;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requesterId: number;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  description: string;
  requestedPriority: TicketPriority;
  currentStatus: "NEW";
}

export interface AttachmentMetadata {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  removedAt: string | null;
  removalReason: string | null;
}

export interface TicketDetail extends Ticket {
  requester: Requester;
  category: Category;
  relatedSystem: RelatedSystem;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentMetadata[];
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  summary: string;
  requestedPriority: TicketPriority;
  currentStatus: "NEW";
  updatedAt: string;
  category: Category;
  relatedSystem: RelatedSystem;
}

export interface TicketListResponse {
  items: TicketListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface TicketListOptions {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: TicketPriority;
  currentStatus?: "NEW";
  sort?: "ticketNumber" | "ticketDate" | "updatedAt" | "requestedPriority";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: 10 | 25 | 50;
}

export const REQUESTER_STORAGE_KEY = "toktickit.developmentRequesterId";

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function getRequesters(): Promise<Requester[]> {
  const response = await fetch(`${API_URL}/api/requesters?active=true`);
  if (!response.ok) {
    throw new Error(`Requester request failed (${response.status})`);
  }

  return (await response.json()) as Requester[];
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/categories`);
  if (!response.ok) {
    throw new Error(`Category request failed (${response.status})`);
  }

  return (await response.json()) as Category[];
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems`);
  if (!response.ok) {
    throw new Error(`Related System request failed (${response.status})`);
  }

  return (await response.json()) as RelatedSystem[];
}

export async function createTicket(
  requesterId: number,
  input: CreateTicketInput,
): Promise<Ticket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requester-Id": String(requesterId),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Ticket request failed (${response.status})`);
  }

  return (await response.json()) as Ticket;
}

export async function getMyTickets(
  requesterId: number,
  options: TicketListOptions = {},
): Promise<TicketListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }

  const queryString = query.toString();
  const response = await fetch(`${API_URL}/api/tickets${queryString ? `?${queryString}` : ""}`, {
    headers: { "X-Requester-Id": String(requesterId) },
  });
  if (!response.ok) {
    throw new Error(`Ticket list request failed (${response.status})`);
  }

  return (await response.json()) as TicketListResponse;
}

export async function getTicketDetail(requesterId: number, ticketId: number): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
    headers: { "X-Requester-Id": String(requesterId) },
  });
  if (!response.ok) {
    throw new ApiRequestError(`Ticket detail request failed (${response.status})`, response.status);
  }

  return (await response.json()) as TicketDetail;
}

export function readRequesterId(): number | null {
  const value = window.localStorage.getItem(REQUESTER_STORAGE_KEY);
  if (!value || !/^\d+$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function saveRequesterId(id: number): void {
  window.localStorage.setItem(REQUESTER_STORAGE_KEY, String(id));
}

export function clearRequesterId(): void {
  window.localStorage.removeItem(REQUESTER_STORAGE_KEY);
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  const healthResponse = await fetch(`${API_URL}/api/health`);
  if (!healthResponse.ok) {
    throw new Error(`Health check failed (${healthResponse.status})`);
  }

  const categoriesResponse = await fetch(`${API_URL}/api/categories`);
  if (!categoriesResponse.ok) {
    throw new Error(`Category request failed (${categoriesResponse.status})`);
  }

  const categories = (await categoriesResponse.json()) as Category[];
  return { online: true, categories };
}
