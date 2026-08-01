/** E-mail identifiant le compte admin (dashboard /chat/admin) — même valeur que back/.env: ADMIN_EMAIL. */
export const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").trim().toLowerCase();

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!ADMIN_EMAIL && (email || "").trim().toLowerCase() === ADMIN_EMAIL;
}
