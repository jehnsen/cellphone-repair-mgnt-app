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
import { createReportsApi } from "@/lib/api/live-reports";
import { signIn as signInRemote, signOutRemote } from "@/lib/api/live-api";
import { toUser } from "@/lib/api/mappers";
import {
  clearSession,
  loadSession,
  patchStoredUser,
  saveSession,
} from "@/lib/api/session";
import { EMPTY_DB, shopReducer, type ShopAction } from "@/lib/shop/reducer";
import type { ShopApi, ShopReports } from "@/lib/shop/contract";
import type { BranchDto } from "@/lib/api/dto";
import type {
  BranchSummary,
  Database,
  Permission,
  Role,
  User,
} from "@/lib/types";

/**
 * One provider, one source of truth: the Laravel API.
 *
 * Sign-in issues a bearer token; every record on screen is fetched from the
 * server. `db` is a read-through cache of what has been fetched so far, so
 * screens can resolve a ticket's customer without another round trip — it is
 * never a source of invented rows.
 */

export type AuthState = "loading" | "signed-out" | "signed-in" | "unreachable";

/**
 * What the app is looking at: one branch by ULID, or every branch at once.
 * Mirrors the API's `?branch=` — `"all"` is the server's own literal.
 */
export type BranchScope = string | "all";

interface ShopContextValue {
  db: Database;
  api: ShopApi;
  /* The server's own aggregates. Separate from `api` because these are
     computed in SQL over the whole shop and must never be re-derived from
     `db`, which only holds what this browser happens to have fetched. */
  reports: ShopReports;
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
  /**
   * Edit the signed-in user's own name / email / password. Updates the
   * in-memory identity and re-persists the session on success, so the header
   * and Settings reflect it without a reload. Throws on failure — callers show
   * the error.
   */
  updateProfile: (input: {
    name?: string;
    email?: string;
    password?: string;
  }) => Promise<User>;

  /**
   * The branch the app is currently pointed at, and the ones it may point at.
   *
   * `branch` is the signed-in user's home branch — where their writes land.
   * `branchScope` is what is being *looked at*: a branch id, or `"all"` for
   * every branch at once. Widening past their own branch needs
   * `branches.view_all` server-side, so a cashier has one branch in
   * `branches` and cannot change scope.
   */
  branch: BranchDto | null;
  branches: BranchSummary[];
  branchScope: BranchScope;
  /** Ignored without `branch.switch`; the server is the real gate. */
  setBranchScope: (scope: BranchScope) => void;
  /** True when this account can see more than the one branch it works at. */
  canSwitchBranch: boolean;

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
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  /* Which branch is being looked at: a ULID, or "all". Null until the
     session resolves a home branch. */
  const [branchScope, setScopeState] = useState<BranchScope | null>(null);
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

  const reports = useMemo(() => createReportsApi(client), [client]);

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

  /**
   * Fetch the shop under one branch scope.
   *
   * `scope` is applied *before* anything is fetched, so the first paint is
   * already branch-correct rather than showing the whole shop for a moment.
   *
   * It defaults to `null` — "don't send `?branch=`", so the server returns the
   * caller's own branch. Passing an explicit branch ULID (or `"all"`) is a
   * *widen* request on the wire and 403s for anyone without `branches.view_all`,
   * so only an owner-driven switch supplies one.
   */
  const load = useCallback(
    async (
      nextBranch: BranchDto | null,
      self: User | null,
      scope: BranchScope | null = null,
    ) => {
      client.setBranchScope(scope);
      setScopeState(scope);

      const result = await bootstrapShop(client, nextBranch, self);
      rawDispatch({ type: "hydrate", db: result.db });
      setVersion((value) => value + 1);
      setWarnings(result.warnings);
      setReady(true);
    },
    [client],
  );

  /* What this account may look at. Only meaningful for an owner or manager;
     a cashier is scoped server-side and gets their own branch back (or a
     403, which `getBranches` reports as an empty list). */
  const loadBranches = useCallback(
    async (self: User | null) => {
      if (!self || !can(self.role, "branch.switch")) {
        setBranches([]);
        return;
      }
      try {
        setBranches(await api.getBranches());
      } catch {
        /* A switcher that cannot load is simply not offered. */
        setBranches([]);
      }
    },
    [api],
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

    load(session.branch, self)
      .then(() => loadBranches(self))
      .catch(fail);
  }, [client, load, loadBranches, fail, attempt]);

  /* Adding, renaming, or closing a branch has to reach the switcher without a
     reload. `version` bumps on every write, so re-read the list when it moves —
     cheap, and only ever for an account that can switch in the first place. */
  useEffect(() => {
    if (auth !== "signed-in" || !version) return;
    void loadBranches(userRef.current);
  }, [version, auth, loadBranches]);

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
        await loadBranches(self);
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
    setBranches([]);
    setScopeState(null);
    client.setBranchScope(null);
    setReady(false);
    setAuth("signed-out");
  }, [client]);

  /** Retry the first load after the server was unreachable. */
  const retry = useCallback(() => {
    setAuthError(null);
    setAuth("loading");
    setAttempt((value) => value + 1);
  }, []);

  const updateProfile = useCallback(
    async (input: { name?: string; email?: string; password?: string }) => {
      const updated = await api.updateProfile(input);
      setSessionUser(updated);
      /* Keep the persisted copy in step so a reload does not revert the name
         or email to what was captured at sign-in. The password is never
         stored client-side. */
      patchStoredUser({
        name: updated.name,
        email: updated.email ?? undefined,
      });
      return updated;
    },
    [api],
  );

  const user = sessionUser ?? PENDING_USER;
  const canSwitchBranch = can(user.role, "branch.switch") && branches.length > 1;

  /**
   * Point the app at another branch — or at all of them, with null.
   *
   * `db` is a cache of rows fetched under the *previous* scope, so it is
   * dropped rather than merged: a board still holding the other branch's
   * tickets is worse than a moment of loading. The HTTP cache is keyed on the
   * branch param and cleared by `setBranchScope` for the same reason.
   */
  const setBranchScope = useCallback(
    (next: BranchScope) => {
      if (!can(user.role, "branch.switch")) return;
      if (next === branchScope) return;

      rawDispatch({ type: "hydrate", db: EMPTY_DB });
      setReady(false);

      load(branch, sessionUser, next).catch(fail);
    },
    [client, branchScope, user.role, branch, sessionUser, load, fail],
  );


  const value = useMemo<ShopContextValue>(
    () => ({
      db,
      api,
      reports,
      version,
      ready,
      apiBaseUrl: API_BASE_URL,
      auth,
      authError,
      warnings,
      signIn,
      signOut,
      retry,
      updateProfile,
      user,
      role: user.role,
      can: (permission: Permission) => can(user.role, permission),
      branch,
      branches,
      /* Before the session resolves, the scope is the user's own branch —
         the server's default, and never a wider view than they hold. */
      branchScope: branchScope ?? branch?.ulid ?? "",
      setBranchScope,
      canSwitchBranch,
    }),
    [db, api, reports, version, ready, auth, authError, warnings, signIn, signOut, retry, updateProfile, user, branch, branches, branchScope, setBranchScope, canSwitchBranch],
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
  const { api } = useShop();
  return useSource(api, run, deps);
}

/**
 * The same three states, over the server's reporting instead of `ShopApi`.
 *
 * Kept as its own hook so a screen cannot reach the aggregates through the
 * ordinary data path by accident — asking for a report is a deliberate act.
 */
export function useReport<T>(
  run: (reports: ShopReports) => Promise<T>,
  deps: React.DependencyList = [],
): QueryState<T> {
  const { reports } = useShop();
  return useSource(reports, run, deps);
}

/** Shared body: fetch on mount, refetch on write, drop a late response. */
function useSource<TSource, T>(
  source: TSource,
  run: (source: TSource) => Promise<T>,
  deps: React.DependencyList,
): QueryState<T> {
  const { version, ready } = useShop();
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
      .current(source)
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
  }, [source, ready, version, nonce, ...deps]);

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
