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
import { can } from "@/lib/roles";
import { API_BASE_URL } from "@/lib/api/config";
import { HttpClient } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import { bootstrapShop, createShopApi } from "@/lib/api/shop-api";
import { signIn as signInRemote, signOutRemote } from "@/lib/api/live-api";
import { toUser } from "@/lib/api/mappers";
import {
  clearSession,
  loadSession,
  saveSession,
} from "@/lib/api/session";
import { EMPTY_DB, shopReducer, type ShopAction } from "@/lib/shop/reducer";
import type { ShopApi } from "@/lib/shop/contract";
import type { BranchDto } from "@/lib/api/dto";
import type { Database, Permission, Role, User } from "@/lib/types";

/**
 * One provider, one source of truth: the Laravel API.
 *
 * Sign-in issues a bearer token; every record on screen is fetched from the
 * server. `db` is a read-through cache of what has been fetched so far, so
 * screens can resolve a ticket's customer without another round trip — it is
 * never a source of invented rows.
 */

export type AuthState = "loading" | "signed-out" | "signed-in" | "unreachable";

interface ShopContextValue {
  db: Database;
  api: ShopApi;
  /** Bumped on every write so `useQuery` refetches without manual wiring. */
  version: number;
  ready: boolean;
  apiBaseUrl: string;

  auth: AuthState;
  authError: ApiError | null;
  /** Contexts this account could not read, so the user is not left guessing. */
  warnings: string[];
  signIn: (credentials: { email: string; password: string }) => Promise<boolean>;
  signOut: () => void;
  retry: () => void;

  user: User;
  role: Role;
  can: (permission: Permission) => boolean;
}

const ShopContext = createContext<ShopContextValue | null>(null);

/** Stands in only between mount and the first response. */
const PENDING_USER: User = {
  id: "",
  name: "—",
  initials: "—",
  role: "cashier",
  active: true,
  isTechnician: false,
};

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [db, rawDispatch] = useReducer(shopReducer, EMPTY_DB);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState<ApiError | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [branch, setBranch] = useState<BranchDto | null>(null);
  const [attempt, setAttempt] = useState(0);

  /* The API reads the newest cache without being rebuilt on every render. */
  const dbRef = useRef(db);
  dbRef.current = db;
  const branchRef = useRef<BranchDto | null>(null);
  branchRef.current = branch;
  const userRef = useRef<User | null>(null);
  userRef.current = sessionUser;

  /** Writes: bump the version so every open list refetches. */
  const dispatch = useCallback((action: ShopAction) => {
    rawDispatch(action);
    setVersion((value) => value + 1);
  }, []);

  /** Cache sync: update state without retriggering every query. */
  const dispatchQuiet = useCallback((action: ShopAction) => {
    rawDispatch(action);
  }, []);

  const client = useMemo(() => new HttpClient(), []);

  const api = useMemo(
    () =>
      createShopApi({
        client,
        getDb: () => dbRef.current,
        dispatch,
        dispatchQuiet,
        context: {
          branchUlid: () => branchRef.current?.ulid ?? null,
          currentUser: () => userRef.current,
        },
      }),
    [client, dispatch, dispatchQuiet],
  );

  const load = useCallback(
    async (nextBranch: BranchDto | null, self: User | null) => {
      const result = await bootstrapShop(client, nextBranch, self);
      rawDispatch({ type: "hydrate", db: result.db });
      setVersion((value) => value + 1);
      setWarnings(result.warnings);
      setReady(true);
    },
    [client],
  );

  const fail = useCallback((caught: unknown) => {
    const error =
      caught instanceof ApiError
        ? caught
        : new ApiError(
            "The shop could not be loaded.",
            "Check that the API is running, then try again.",
            { code: "INTERNAL_ERROR" },
          );
    setAuthError(error);
    if (error.code === "UNAUTHENTICATED") {
      clearSession();
      setAuth("signed-out");
    } else {
      setAuth("unreachable");
    }
  }, []);

  /* Fetching happens on the client only — there is no token during SSR. */
  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setAuth("signed-out");
      setReady(false);
      return;
    }

    client.setToken(session.token);
    const self = toUser(session.user);
    setSessionUser(self);
    setBranch(session.branch);
    setAuth("signed-in");
    setAuthError(null);

    load(session.branch, self).catch(fail);
  }, [client, load, fail, attempt]);

  /* A token can die between page loads; when it does, stop pretending. */
  useEffect(() => {
    client.onUnauthenticated = () => {
      clearSession();
      client.setToken(null);
      setSessionUser(null);
      setAuth("signed-out");
      setReady(false);
    };
    return () => {
      client.onUnauthenticated = null;
    };
  }, [client]);

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      setAuthError(null);
      try {
        const session = await signInRemote(client, { email, password });
        saveSession(session);
        const self = toUser(session.user);
        setSessionUser(self);
        setBranch(session.branch);
        setAuth("signed-in");
        await load(session.branch, self);
        return true;
      } catch (caught) {
        const error =
          caught instanceof ApiError
            ? caught
            : new ApiError(
                "Sign-in failed.",
                "Check the email and password, then try again.",
                { code: "INTERNAL_ERROR" },
              );
        setAuthError(error);
        setAuth(error.code === "NETWORK_UNREACHABLE" ? "unreachable" : "signed-out");
        return false;
      }
    },
    [client, load],
  );

  const signOut = useCallback(() => {
    void signOutRemote(client);
    clearSession();
    client.setToken(null);
    rawDispatch({ type: "hydrate", db: EMPTY_DB });
    setSessionUser(null);
    setBranch(null);
    setReady(false);
    setAuth("signed-out");
  }, [client]);

  /** Retry the first load after the server was unreachable. */
  const retry = useCallback(() => {
    setAuthError(null);
    setAuth("loading");
    setAttempt((value) => value + 1);
  }, []);

  const user = sessionUser ?? PENDING_USER;

  const value = useMemo<ShopContextValue>(
    () => ({
      db,
      api,
      version,
      ready,
      apiBaseUrl: API_BASE_URL,
      auth,
      authError,
      warnings,
      signIn,
      signOut,
      retry,
      user,
      role: user.role,
      can: (permission: Permission) => can(user.role, permission),
    }),
    [db, api, version, ready, auth, authError, warnings, signIn, signOut, retry, user],
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

/** What `mutate()` resolves to: the result, plus the error if it failed. */
export type MutationOutcome<TResult> = {
  /** The successful result, or `undefined` if the call threw. */
  data: TResult | undefined;
  /**
   * The error this call threw, if any. Read this instead of the hook's `error`
   * field right after awaiting: that field is a render-time snapshot and, in
   * the same tick as a failed call, still holds the *previous* error.
   */
  error: Error | null;
};

/** Mutations: same shape everywhere, so buttons can show pending state. */
export function useMutation<TArgs extends unknown[], TResult>(
  run: (api: ShopApi, ...args: TArgs) => Promise<TResult>,
): {
  mutate: (...args: TArgs) => Promise<MutationOutcome<TResult>>;
  pending: boolean;
  error: Error | null;
} {
  const { api } = useShop();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const mutate = useCallback(
    async (...args: TArgs): Promise<MutationOutcome<TResult>> => {
      setPending(true);
      setError(null);
      try {
        const data = await runRef.current(api, ...args);
        return { data, error: null };
      } catch (caught) {
        const failure = caught as Error;
        setError(failure);
        return { data: undefined, error: failure };
      } finally {
        setPending(false);
      }
    },
    [api],
  );

  return { mutate, pending, error };
}
