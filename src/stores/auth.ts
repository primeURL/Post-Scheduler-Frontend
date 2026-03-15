import { atom, computed } from "nanostores";
import type { User } from "../lib/types";

/** JWT access token — stored in memory only, never persisted. */
export const $accessToken = atom<string | null>(null);

/** Authenticated user profile. */
export const $user = atom<User | null>(null);

/** True when a valid access token is present. */
export const $isAuthenticated = computed($accessToken, (t) => t !== null);

export function setAuth(token: string, user: User): void {
  $accessToken.set(token);
  $user.set(user);
}

export function clearAuth(): void {
  $accessToken.set(null);
  $user.set(null);
}
