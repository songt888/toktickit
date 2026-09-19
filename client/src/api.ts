// Vite proxies /api to Express in local development so the session cookie
// remains same-origin. An explicit value is supported for other deployments.
const API_URL = import.meta.env.VITE_API_URL || "";

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
export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";
export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  user: AuthUser;
  requiresPasswordChange: boolean;
}

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
  currentStatus: TicketStatus;
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
  problemAppearsResolved: boolean;
  problemAppearsResolvedAt: string | null;
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
  currentStatus: TicketStatus;
  updatedAt: string;
  category: Category;
  relatedSystem: RelatedSystem;
}

export interface PublicComment {
  id: number;
  content: string;
  createdAt: string;
  author: Requester;
}

export interface ProblemResolutionUpdate {
  id: number;
  problemAppearsResolved: boolean;
  problemAppearsResolvedAt: string | null;
  currentStatus: TicketStatus;
  updatedAt: string;
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

async function authError(response: Response, fallback: string): Promise<ApiRequestError> {
  try {
    const body = (await response.json()) as { error?: string };
    return new ApiRequestError(body.error || fallback, response.status);
  } catch {
    return new ApiRequestError(fallback, response.status);
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await authError(response, "Unable to sign in.");
  return (await response.json()) as AuthResponse;
}

export async function getCurrentUser(): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
  if (!response.ok) throw await authError(response, "Unable to validate your session.");
  return (await response.json()) as AuthResponse;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw await authError(response, "Unable to sign out.");
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
  if (!response.ok) throw await authError(response, "Unable to change password.");
  return (await response.json()) as AuthResponse;
}

export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${API_URL}/api/categories`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Category request failed (${response.status})`);
  }

  return (await response.json()) as Category[];
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch(`${API_URL}/api/related-systems`, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Related System request failed (${response.status})`);
  }

  return (await response.json()) as RelatedSystem[];
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const response = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Ticket request failed (${response.status})`);
  }

  return (await response.json()) as Ticket;
}

export async function getMyTickets(
  options: TicketListOptions = {},
): Promise<TicketListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }

  const queryString = query.toString();
  const response = await fetch(`${API_URL}/api/tickets${queryString ? `?${queryString}` : ""}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Ticket list request failed (${response.status})`);
  }

  return (await response.json()) as TicketListResponse;
}

export async function getTicketDetail(ticketId: number): Promise<TicketDetail> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiRequestError(`Ticket detail request failed (${response.status})`, response.status);
  }

  return (await response.json()) as TicketDetail;
}

export async function getTicketComments(ticketId: number): Promise<PublicComment[]> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiRequestError(`Public comments request failed (${response.status})`, response.status);
  }

  return (await response.json()) as PublicComment[];
}

export async function addPublicComment(ticketId: number, content: string): Promise<PublicComment> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new ApiRequestError(`Public comment request failed (${response.status})`, response.status);
  }

  return (await response.json()) as PublicComment;
}

export async function setProblemAppearsResolved(
  ticketId: number,
  appearsResolved: boolean,
): Promise<ProblemResolutionUpdate> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/problem-resolution`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appearsResolved }),
  });
  if (!response.ok) {
    throw new ApiRequestError(`Problem resolution request failed (${response.status})`, response.status);
  }

  return (await response.json()) as ProblemResolutionUpdate;
}

export async function uploadAttachment(
  ticketId: number,
  file: File,
): Promise<AttachmentMetadata> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    throw new ApiRequestError(`Attachment upload failed (${response.status})`, response.status);
  }

  return (await response.json()) as AttachmentMetadata;
}

export async function getTicketAttachments(
  ticketId: number,
): Promise<AttachmentMetadata[]> {
  const response = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiRequestError(`Attachment list request failed (${response.status})`, response.status);
  }

  return (await response.json()) as AttachmentMetadata[];
}

export async function downloadAttachment(attachmentId: number): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiRequestError(`Attachment download failed (${response.status})`, response.status);
  }

  return response.blob();
}

export async function removeAttachment(
  attachmentId: number,
  reason: string,
): Promise<AttachmentMetadata> {
  const response = await fetch(`${API_URL}/api/attachments/${attachmentId}/remove`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    throw new ApiRequestError(`Attachment removal failed (${response.status})`, response.status);
  }

  return (await response.json()) as AttachmentMetadata;
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
