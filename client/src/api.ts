const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
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
