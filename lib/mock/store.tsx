"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { buildDatabase } from "@/lib/mock/seed";
import { createMockApi, type ShopApi } from "@/lib/mock/api";
import { EMPTY_DB, shopReducer } from "@/lib/mock/reducer";
import { failure } from "@/lib/mock/db";
import { can } from "@/lib/roles";
import type { Database, Permission, Role, User } from "@/lib/types";

/**
 * Session state lives here too: who we are pretending to be. There is no auth
 * — the role switcher just changes which permissions the shell hands out.
 */

interface ShopContextValue {
  db: Database;
  api: ShopApi;
  /** Bumped on every mutation so `useQuery` refetches without manual wiring. */
  version: number;
  ready: boolean;
  user: User;
  role: Role;
  setUserId: (userId: string) => void;
  can: (permission: Permission) => boolean;
  /** Demo control for error states. */
  failureRate: number;
  setFailureRate: (rate: number) => void;
  reseed: () => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);

const ROLE_STORAGE_KEY = "jo.userId";

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [db, rawDispatch] = useReducer(shopReducer, EMPTY_DB);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string>("u-cashier-1");
  const [failureRate, setFailureRateState] = useState(0);

  /* The API reads the newest database without being rebuilt on every render. */
  const dbRef = useRef(db);
  dbRef.current = db;

  const dispatch = useCallback((action: Parameters<typeof shopReducer>[1]) => {
    rawDispatch(action);
    setVersion((value) => value + 1);
  }, []);

  const api = useMemo(
    () => createMockApi(() => dbRef.current, dispatch),
    [dispatch],
  );

  /* Seed on the client only: dates are relative to "now", and generating them
     during SSR would guarantee a hydration mismatch. */
  useEffect(() => {
    const seeded = buildDatabase(new Date());
    rawDispatch({ type: "hydrate", db: seeded });
    setVersion((value) => value + 1);
    setReady(true);

    const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
    if (stored && seeded.users.some((user) => user.id === stored)) {
      setUserId(stored);
    }
  }, []);

  const handleSetUserId = useCallback((next: string) => {
    setUserId(next);
    window.localStorage.setItem(ROLE_STORAGE_KEY, next);
  }, []);

  const setFailureRate = useCallback((rate: number) => {
    failure.rate = rate;
    setFailureRateState(rate);
  }, []);

  const reseed = useCallback(() => {
    setReady(false);
    rawDispatch({ type: "hydrate", db: buildDatabase(new Date()) });
    setVersion((value) => value + 1);
    setReady(true);
  }, []);

  const user =
    db.users.find((entry) => entry.id === userId) ??
    db.users[0] ?? {
      id: "u-cashier-1",
      name: "Counter",
      initials: "CT",
      role: "cashier" as Role,
      active: true,
      isTechnician: false,
    };

  const value = useMemo<ShopContextValue>(
    () => ({
      db,
      api,
      version,
      ready,
      user,
      role: user.role,
      setUserId: handleSetUserId,
      can: (permission: Permission) => can(user.role, permission),
      failureRate,
      setFailureRate,
      reseed,
    }),
    [db, api, version, ready, user, handleSetUserId, failureRate, setFailureRate, reseed],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error("useShop must be used inside <ShopProvider>.");
  }
  return context;
}

/* ── Query hook: gives every list screen its three states ────────────── */

export interface QueryState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useQuery<T>(
  run: (api: ShopApi) => Promise<T>,
  deps: React.DependencyList = [],
): QueryState<T> {
  const { api, version, ready } = useShop();
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    runRef
      .current(api)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((caught: Error) => {
        if (!cancelled) {
          setError(caught);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, ready, version, nonce, ...deps]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, refetch };
}

/** Mutations: same shape everywhere, so buttons can show pending state. */
export function useMutation<TArgs extends unknown[], TResult>(
  run: (api: ShopApi, ...args: TArgs) => Promise<TResult>,
): {
  mutate: (...args: TArgs) => Promise<TResult | undefined>;
  pending: boolean;
  error: Error | null;
} {
  const { api } = useShop();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const mutate = useCallback(
    async (...args: TArgs) => {
      setPending(true);
      setError(null);
      try {
        return await runRef.current(api, ...args);
      } catch (caught) {
        setError(caught as Error);
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [api],
  );

  return { mutate, pending, error };
}
