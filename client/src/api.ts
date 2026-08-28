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

export const REQUESTER_STORAGE_KEY = "toktickit.developmentRequesterId";

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function getRequesters(): Promise<Requester[]> {
  const response = await fetch(`${API_URL}/api/requesters?active=true`);
  if (!response.ok) {
    throw new Error(`Requester request failed (${response.status})`);
  }

  return (await response.json()) as Requester[];
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
