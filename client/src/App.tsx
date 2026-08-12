import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states you must handle for Issue 4: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleCheck() {
    setState("loading");
    setErrorMessage("");

    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState(result.online ? "success" : "error");
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to reach the API.");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "loading" && (
        <p className="mt-4" role="status">
          Checking backend status…
        </p>
      )}

      {state === "success" && (
        <section className="mt-4" aria-label="System status">
          <p className="text-success fw-bold">Online</p>
          <h2 className="h5">Request categories</h2>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        </section>
      )}

      {state === "error" && (
        <section className="mt-4" role="alert" aria-label="System status">
          <p className="text-danger fw-bold">Offline</p>
          <p>{errorMessage || "Unable to reach the API."}</p>
        </section>
      )}
    </div>
  );
}
