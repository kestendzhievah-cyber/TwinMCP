// Where is each secret referenced? Pure part of the "used by" lists: given the
// decrypted configs of a user's installed MCPs, map secret name → installs.
import { collectSecretRefs } from "./refs";

export interface SecretUsage {
  userServerId: string;
  serverId: string;
  serverName: string;
  serverSlug: string;
  mcpSlug: string;
  mcpName: string;
  enabled: boolean;
  /** The config keys whose value references the secret (never their values). */
  configKeys: string[];
}

export type InstallForUsage = Omit<SecretUsage, "configKeys"> & {
  config: Record<string, unknown>;
};

/** name → installs referencing it (each install once, with the keys that do). */
export function secretUsageFromConfigs(
  installs: readonly InstallForUsage[]
): Map<string, SecretUsage[]> {
  const out = new Map<string, SecretUsage[]>();
  for (const { config, ...meta } of installs) {
    const keysByName = new Map<string, string[]>();
    for (const [key, value] of Object.entries(config ?? {})) {
      for (const name of collectSecretRefs(value)) {
        const keys = keysByName.get(name) ?? [];
        keys.push(key);
        keysByName.set(name, keys);
      }
    }
    for (const [name, configKeys] of keysByName) {
      const list = out.get(name) ?? [];
      list.push({ ...meta, configKeys });
      out.set(name, list);
    }
  }
  return out;
}

/** Short label for one usage: "<server> · <mcp>". */
export function usageLabel(u: Pick<SecretUsage, "serverName" | "mcpName">): string {
  return `${u.serverName} · ${u.mcpName}`;
}
