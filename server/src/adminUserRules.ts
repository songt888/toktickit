export function wouldRemoveLastActiveAdministrator(
  current: { role: string; isActive: boolean },
  next: { role?: string; isActive?: boolean },
  activeAdministratorCount: number,
): boolean {
  const remainsAdministrator = next.role === undefined || next.role === "ADMINISTRATOR";
  const remainsActive = next.isActive !== false;
  return current.role === "ADMINISTRATOR" && current.isActive &&
    (!remainsAdministrator || !remainsActive) && activeAdministratorCount <= 1;
}
