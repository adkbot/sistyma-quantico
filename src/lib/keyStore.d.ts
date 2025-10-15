export interface UserKeys {
  apiKey: string;
  secretKey: string;
  mode?: 'spot' | 'futures';
  testnet?: boolean;
  updatedAt?: string | null;
}

export interface KeyStore {
  users: Record<string, UserKeys>;
}

export interface MaskedState {
  configured: boolean;
  mode: 'spot' | 'futures';
  testnet: boolean;
  apiKeyMask: string;
  updatedAt: string | null;
}

export function loadStore(): KeyStore;
export function saveStore(store: KeyStore): void;
export function getUserKeys(userId: string): UserKeys | null;
export function upsertUserKeys(userId: string, keys: UserKeys): void;
export function removeUserKeys(userId: string): void;
export function getMaskedState(userId: string): MaskedState;