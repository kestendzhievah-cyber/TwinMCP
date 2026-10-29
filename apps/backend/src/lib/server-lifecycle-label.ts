// What a server's status badge says, from its derived lifecycle state
// (lib/server-lifecycle.ts), never from the raw `servers.status` enum: a
// `stopped` box server is either paused (box kept, the next request wakes it)
// or has no runtime at all (Start creates one), and the two need different
// words. Shared by the server page badge, the servers list and the admin
// console (in French there).
//
// Pure: no I/O, safe to import from client components. Unit-tested in
// src/__tests__/server-lifecycle-label.test.ts.

import { lifecycleState, type LifecycleInput, type LifecycleState } from "@/lib/server-lifecycle";
import { localAgentCommand } from "@/lib/cli";

/** The agent command with a placeholder slug (the Connect panel has the real one). */
const AGENT_CMD = localAgentCommand("<server-slug>");

export type LifecycleBadgeVariant =
  | "success"
  | "warning"
  | "info"
  | "secondary"
  | "destructive"
  | "outline";

export interface LifecycleLabel {
  state: LifecycleState;
  /** The badge text. */
  label: string;
  /** One plain-language sentence, shown on hover. */
  help: string;
  /** The Badge variant (DESIGN.md §4.9 status tints). */
  variant: LifecycleBadgeVariant;
  /** In flight: the status dot breathes and the badge polls. */
  transient: boolean;
}

type Copy = Record<LifecycleState, { label: string; help: string }>;

const EN: Copy = {
  provisioning: {
    label: "Provisioning",
    help: "Spinning up your runtime — usually about 30 seconds.",
  },
  running: { label: "Running", help: "Online and serving your MCPs." },
  paused: {
    label: "Paused — resumes on next request",
    help: "The box and its data are kept. The next MCP request wakes it after a short delay, or press Resume.",
  },
  no_runtime: {
    label: "No runtime — Start",
    help: "Your MCPs and their configuration are saved. Start creates a fresh box and installs them.",
  },
  agent_offline: {
    label: "Agent offline",
    help: `The local agent is offline. Run ${AGENT_CMD} on the machine that hosts these tools (the Connect panel has the exact command).`,
  },
  error: {
    label: "Error",
    help: "The runtime failed to start. Check the Logs tab, or restart the server.",
  },
  destroyed: { label: "Destroyed", help: "This server has been torn down." },
};

const FR: Copy = {
  provisioning: {
    label: "Provisionnement",
    help: "Le runtime démarre — environ 30 secondes.",
  },
  running: { label: "En marche", help: "En ligne, sert ses MCP." },
  paused: {
    label: "En pause — reprend à la prochaine requête",
    help: "La box et ses données sont conservées. La prochaine requête MCP la réveille après un court délai.",
  },
  no_runtime: {
    label: "Aucun runtime — Démarrer",
    help: "Les MCP et leur configuration sont conservés. Démarrer crée une nouvelle box et les réinstalle.",
  },
  agent_offline: {
    label: "Agent hors ligne",
    help: `L’agent local n’est pas connecté. Lancez ${AGENT_CMD} sur la machine qui héberge ces outils (le panneau Connect donne la commande exacte).`,
  },
  error: { label: "Erreur", help: "Le runtime n'a pas démarré. Voir les logs du serveur." },
  destroyed: { label: "Détruit", help: "Ce serveur a été supprimé." },
};

const VARIANT: Record<LifecycleState, LifecycleBadgeVariant> = {
  provisioning: "warning",
  running: "success",
  paused: "info",
  no_runtime: "secondary",
  agent_offline: "secondary",
  error: "destructive",
  destroyed: "outline",
};

/** The badge text, hover help, tint and in-flight flag for a server. */
export function lifecycleLabel(input: LifecycleInput, locale: "en" | "fr" = "en"): LifecycleLabel {
  const state = lifecycleState(input);
  const copy = (locale === "fr" ? FR : EN)[state];
  return {
    state,
    label: copy.label,
    help: copy.help,
    variant: VARIANT[state],
    transient: state === "provisioning",
  };
}
