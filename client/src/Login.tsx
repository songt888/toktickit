import { FormEvent, useState } from "react";
import { ApiRequestError, AuthUser, login } from "./api.js";

export interface LoginProps {
  onSuccess: (user: AuthUser) => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const normalizedEmail = email.trim();
    if (!normalizedEmail) nextErrors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) nextErrors.password = "Password is required.";

    setErrors(nextErrors);
    setErrorMessage("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await login(normalizedEmail, password);
      onSuccess(response.user);
    } catch (error) {
      const message = error instanceof ApiRequestError && error.status === 401
        ? "Unable to sign in. Check your details and try again."
        : error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="login-title">
      <div className="card-body">
        <h2 id="login-title" className="h4 mb-1">Sign in</h2>
        <p className="text-secondary mb-4">Use your TokTickIT account to continue.</p>
        {errorMessage && <div className="alert alert-danger" role="alert">{errorMessage}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className={`form-control${errors.email ? " is-invalid" : ""}`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              autoComplete="username"
            />
            {errors.email && <div id="login-email-error" className="invalid-feedback">{errors.email}</div>}
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className={`form-control${errors.password ? " is-invalid" : ""}`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              autoComplete="current-password"
            />
            {errors.password && <div id="login-password-error" className="invalid-feedback">{errors.password}</div>}
          </div>
          <button className="btn btn-success" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign In"}
          </button>
          {submitting && <span className="visually-hidden" role="status">Signing in…</span>}
        </form>
      </div>
    </section>
  );
}
