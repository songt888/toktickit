import { FormEvent, useState } from "react";
import { AuthUser, changePassword } from "./api.js";

export interface ChangePasswordProps {
  user: AuthUser;
  onSuccess: (user: AuthUser) => void;
}

function passwordError(value: string): string | null {
  if (value.length < 12 || value.length > 128) return "Password must be between 12 and 128 characters.";
  if (!/\S/.test(value)) return "Password cannot be whitespace only.";
  if (!/[A-Z]/.test(value)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(value)) return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(value)) return "Password must contain a number.";
  return null;
}

export default function ChangePassword({ user, onSuccess }: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!currentPassword) nextErrors.currentPassword = "Current password is required.";
    const newPasswordError = passwordError(newPassword);
    if (newPasswordError) nextErrors.newPassword = newPasswordError;
    if (!confirmPassword) nextErrors.confirmPassword = "Please confirm your new password.";
    else if (newPassword !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";

    setErrors(nextErrors);
    setErrorMessage("");
    setSuccessMessage("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await changePassword(currentPassword, newPassword, confirmPassword);
      setSuccessMessage("Password changed successfully.");
      onSuccess(response.user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to change password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="change-password-title">
      <div className="card-body">
        <h2 id="change-password-title" className="h4 mb-1">Change your password</h2>
        <p className="text-secondary mb-4">An initial password must be changed before you can use the application.</p>
        {errorMessage && <div className="alert alert-danger" role="alert">{errorMessage}</div>}
        {successMessage && <div className="alert alert-success" role="status">{successMessage}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="current-password">Current password</label>
            <input id="current-password" className={`form-control${errors.currentPassword ? " is-invalid" : ""}`} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
            {errors.currentPassword && <div className="invalid-feedback">{errors.currentPassword}</div>}
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="new-password">New password</label>
            <input id="new-password" className={`form-control${errors.newPassword ? " is-invalid" : ""}`} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" aria-describedby="password-rules" />
            {errors.newPassword && <div className="invalid-feedback">{errors.newPassword}</div>}
            <div id="password-rules" className="form-text">12–128 characters, including uppercase, lowercase, and a number.</div>
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" className={`form-control${errors.confirmPassword ? " is-invalid" : ""}`} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
            {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword}</div>}
          </div>
          <button className="btn btn-success" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Continue"}
          </button>
          {submitting && <span className="visually-hidden" role="status">Saving password…</span>}
          <p className="small text-secondary mt-3 mb-0">Signed in as {user.email}</p>
        </form>
      </div>
    </section>
  );
}
