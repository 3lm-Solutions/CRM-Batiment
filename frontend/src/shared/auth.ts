import type { Role } from './roles';

/** The logged-in user as the frontend sees it. */
export interface SessionUser {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  companyId: number;
}

/** Normal login: a session token. */
export interface SessionResponse {
  accessToken: string;
  user: SessionUser;
}

/**
 * First login with a temporary password: a SHORT-LIVED token that is accepted ONLY by
 * POST /auth/change-password. Every other route rejects it.
 */
export interface PasswordChangeRequiredResponse {
  mustChangePassword: true;
  passwordChangeToken: string;
  message: string;
}

export type LoginResponse = SessionResponse | PasswordChangeRequiredResponse;

export function isPasswordChangeRequired(
  response: LoginResponse,
): response is PasswordChangeRequiredResponse {
  return 'mustChangePassword' in response;
}

/** Password policy, identical on both sides (form validation + API validation). */
export const PASSWORD_POLICY = {
  minLength: 10,
  description: 'Au moins 10 caractères, dont une majuscule, une minuscule et un chiffre.',
} as const;
