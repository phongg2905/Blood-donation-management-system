import { ROLE_PERMISSIONS } from '@blood/shared-types';
import type { CurrentUser, LegacyRoleCode } from '@blood/shared-types';
import { ApiRequestError } from '@/services/api';
import { AUTH_ERROR_CODES } from '../auth-errors';
import type {
  AuthService,
  AuthUser,
  ForgotPasswordInput,
  ForgotPasswordResult,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from '../types';

/**
 * Mock auth adapter.
 *
 * Used by tests and by the explicit `VITE_USE_MOCK_API=true` development mode.
 * The application otherwise uses the backend auth API.
 */

interface DemoAccount {
  email: string;
  password: string;
  fullName: string;
  role: LegacyRoleCode;
  isActive: boolean;
}

/** Shared password for every demo account. Dev fixture only. */
export const DEMO_PASSWORD = 'Blood@123';

/** One account per role, plus an inactive account to exercise that error path. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    email: 'donor@example.local',
    password: DEMO_PASSWORD,
    fullName: 'Nguyễn Văn A',
    role: 'DONOR',
    isActive: true,
  },
  {
    email: 'reception@example.local',
    password: DEMO_PASSWORD,
    fullName: 'Trần Thị B',
    role: 'RECEPTION_STAFF',
    isActive: true,
  },
  {
    email: 'medical@example.local',
    password: DEMO_PASSWORD,
    fullName: 'Lê Văn C',
    role: 'MEDICAL_STAFF',
    isActive: true,
  },
  {
    email: 'collection@example.local',
    password: DEMO_PASSWORD,
    fullName: 'Phạm Thị D',
    role: 'BLOOD_COLLECTION_STAFF',
    isActive: true,
  },
  {
    email: 'admin@example.local',
    password: DEMO_PASSWORD,
    fullName: 'Quản trị viên',
    role: 'ADMIN',
    isActive: true,
  },
  {
    email: 'inactive@example.local',
    password: DEMO_PASSWORD,
    fullName: 'Tài khoản đã khoá',
    role: 'DONOR',
    isActive: false,
  },
];

/** Reset-link fixtures so both token failure modes are reachable. */
export const MOCK_RESET_TOKENS: Readonly<
  Record<string, 'valid' | 'expired' | 'used'>
> = {
  'mock-reset-token': 'valid',
  'mock-reset-expired': 'expired',
  'mock-reset-used': 'used',
};

const STORAGE_KEYS = {
  session: 'bd.mock.session',
  users: 'bd.mock.users',
  profiles: 'bd.mock.profiles',
} as const;

const DEFAULT_LATENCY_MS = 400;

interface StoredUser {
  id: string;
  email: string;
  fullName: string;
  /** Mock only — a real backend stores a hash and never returns it. */
  password: string;
  role: LegacyRoleCode;
  isActive: boolean;
}

/** Used only when localStorage is unavailable (SSR, storage disabled). */
const memory = new Map<string, string>();

/**
 * Reads a JSON value.
 *
 * When localStorage exists it is the single source of truth — falling back to
 * the in-memory copy would keep serving values after `localStorage.clear()`.
 * The memory copy is consulted only when localStorage cannot be read at all.
 */
function readJson<T>(key: string, fallback: T): T {
  let raw: string | null | undefined;
  try {
    const storage = globalThis.localStorage;
    raw = storage ? storage.getItem(key) : memory.get(key);
  } catch {
    raw = memory.get(key);
  }
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    globalThis.localStorage?.setItem(key, raw);
  } catch {
    /* storage disabled — memory fallback already holds the value */
  }
}

function clearValue(key: string): void {
  memory.delete(key);
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

/** Permissions always come from the shared matrix — never re-declared here. */
const permissionsFor = (role: LegacyRoleCode): CurrentUser['permissions'] => [
  ...ROLE_PERMISSIONS[role],
];

const delay = (ms: number): Promise<void> =>
  ms <= 0
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, ms));

export class MockAuthService implements AuthService {
  constructor(private readonly latencyMs: number = DEFAULT_LATENCY_MS) {}

  private registeredUsers(): StoredUser[] {
    return readJson<StoredUser[]>(STORAGE_KEYS.users, []);
  }

  private profileOverrides(): Record<
    string,
    { fullName?: string; phone?: string; address?: string }
  > {
    return readJson<
      Record<string, { fullName?: string; phone?: string; address?: string }>
    >(STORAGE_KEYS.profiles, {});
  }

  private demoToStored(account: DemoAccount): StoredUser {
    return {
      id: `demo-${account.role.toLowerCase()}`,
      email: account.email,
      fullName: account.fullName,
      password: account.password,
      role: account.role,
      isActive: account.isActive,
    };
  }

  private findUser(email: string): StoredUser | undefined {
    const target = normalizeEmail(email);
    const demo = DEMO_ACCOUNTS.map((account) =>
      this.demoToStored(account),
    ).find((account) => normalizeEmail(account.email) === target);
    if (demo) return demo;
    return this.registeredUsers().find(
      (user) => normalizeEmail(user.email) === target,
    );
  }

  private toUser(stored: StoredUser): AuthUser {
    const override = this.profileOverrides()[stored.id];
    return {
      id: stored.id,
      email: stored.email,
      fullName: override?.fullName ?? stored.fullName,
      // Mirrors the delivered API: contact fields exist only for DONOR
      // accounts (stored in DonorProfile) and are null until filled in.
      ...(stored.role === 'DONOR'
        ? { phone: override?.phone ?? null, address: override?.address ?? null }
        : {}),
      roles: [stored.role],
      permissions: permissionsFor(stored.role),
    };
  }

  private async simulateLatency(): Promise<void> {
    await delay(this.latencyMs);
  }

  async login({ email, password }: LoginInput): Promise<AuthUser> {
    await this.simulateLatency();
    const stored = this.findUser(email);
    if (!stored || stored.password !== password) {
      throw new ApiRequestError(
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        'Email hoặc mật khẩu không đúng.',
        401,
      );
    }
    if (!stored.isActive) {
      throw new ApiRequestError(
        AUTH_ERROR_CODES.ACCOUNT_INACTIVE,
        'Tài khoản đã bị vô hiệu hoá.',
        403,
      );
    }
    writeJson(STORAGE_KEYS.session, { userId: stored.id });
    return this.toUser(stored);
  }

  /**
   * Public registration. The role is hard-coded to DONOR: there is deliberately
   * no way for a client to self-assign a staff or admin role.
   */
  async register({
    fullName,
    email,
    password,
  }: RegisterInput): Promise<AuthUser> {
    await this.simulateLatency();
    if (this.findUser(email)) {
      throw new ApiRequestError(
        AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
        'Email này đã được đăng ký.',
        409,
        { email: 'Email này đã được đăng ký.' },
      );
    }
    const user: StoredUser = {
      id: `mock-user-${Date.now().toString(36)}`,
      email: normalizeEmail(email),
      fullName: fullName.trim(),
      password,
      role: 'DONOR',
      isActive: true,
    };
    writeJson(STORAGE_KEYS.users, [...this.registeredUsers(), user]);
    writeJson(STORAGE_KEYS.session, { userId: user.id });
    return this.toUser(user);
  }

  async logout(): Promise<void> {
    await this.simulateLatency();
    clearValue(STORAGE_KEYS.session);
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    await this.simulateLatency();
    const session = readJson<{ userId?: string } | null>(
      STORAGE_KEYS.session,
      null,
    );
    if (!session?.userId) return null;
    const match =
      this.registeredUsers().find((user) => user.id === session.userId) ??
      DEMO_ACCOUNTS.map((account) => this.demoToStored(account)).find(
        (user) => user.id === session.userId,
      );
    if (!match || !match.isActive) {
      clearValue(STORAGE_KEYS.session);
      return null;
    }
    return this.toUser(match);
  }

  /** Always resolves: revealing whether an email exists would leak accounts. */
  async forgotPassword({
    email,
  }: ForgotPasswordInput): Promise<ForgotPasswordResult> {
    await this.simulateLatency();
    void email;
    return {
      message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi',
    };
  }

  async resetPassword({ token, password }: ResetPasswordInput): Promise<void> {
    await this.simulateLatency();
    const state = MOCK_RESET_TOKENS[token];
    if (state === 'expired' || state === 'used') {
      throw new ApiRequestError(
        AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED,
        'Liên kết đặt lại mật khẩu đã hết hạn.',
        410,
      );
    }
    if (state !== 'valid') {
      throw new ApiRequestError(
        AUTH_ERROR_CODES.RESET_TOKEN_INVALID,
        'Liên kết đặt lại mật khẩu không hợp lệ.',
        400,
      );
    }
    void password;
  }

  async updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
    await this.simulateLatency();
    const current = await this.getCurrentUser();
    if (!current) {
      throw new ApiRequestError('UNAUTHENTICATED', 'Bạn cần đăng nhập.', 401);
    }
    if (
      input.fullName !== undefined ||
      input.phone !== undefined ||
      input.address !== undefined
    ) {
      const overrides = this.profileOverrides();
      overrides[current.id] = {
        ...overrides[current.id],
        ...(input.fullName !== undefined
          ? { fullName: input.fullName.trim() }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
        ...(input.address !== undefined
          ? { address: input.address.trim() }
          : {}),
      };
      writeJson(STORAGE_KEYS.profiles, overrides);
    }
    const refreshed = await this.getCurrentUser();
    return refreshed ?? current;
  }
}

/** Fresh instance with no simulated latency — used by tests. */
export const createMockAuthService = (latencyMs = 0): MockAuthService =>
  new MockAuthService(latencyMs);
