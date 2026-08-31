export const POSTGRES_PATCH_VERSION: "3.4.7";
export const POSTGRES_RECONNECT_BEFORE: string;
export const POSTGRES_RECONNECT_AFTER: string;

export interface PostgresReconnectPatchResult {
  version: "3.4.7";
  patched: number;
  alreadyPatched: number;
}

export function applyPostgresReconnectPatch(
  root?: string,
): Promise<PostgresReconnectPatchResult>;
