"use client";

import { STORAGE } from "@/lib/api/config";
import type { BranchDto, UserDto } from "@/lib/api/dto";

/**
 * What survives a reload: the bearer token, who it belongs to, and which
 * branch they work out of. Nothing else — the shop's data always comes back
 * from the server.
 */

export interface StoredSession {
  token: string;
  user: UserDto;
  branch: BranchDto | null;
}

const read = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private mode, quota, or blocked storage: the session is just not kept. */
  }
};

export function loadSession(): StoredSession | null {
  const token = read<string>(STORAGE.token);
  const user = read<UserDto>(STORAGE.user);
  if (!token || !user) return null;
  return { token, user, branch: read<BranchDto>(STORAGE.branch) };
}

export function saveSession(session: StoredSession): void {
  write(STORAGE.token, session.token);
  write(STORAGE.user, session.user);
  write(STORAGE.branch, session.branch);
}

/**
 * Merge fields into the stored user without touching the token or branch —
 * used after the signed-in user edits their own profile, so a reload keeps the
 * new name/email instead of the copy captured at sign-in.
 */
export function patchStoredUser(patch: Partial<UserDto>): void {
  const current = read<UserDto>(STORAGE.user);
  if (!current) return;
  write(STORAGE.user, { ...current, ...patch });
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE.token);
  window.localStorage.removeItem(STORAGE.user);
  window.localStorage.removeItem(STORAGE.branch);
}


