import { randomUUID } from "node:crypto";
import { auditLogs } from "@findbarber/shared/schema";
import type {
  AuditAction,
  AuditTargetType,
} from "@findbarber/shared/constants";
import type { Role } from "@findbarber/shared/types";
import type { db } from "../db/client.js";

// --- Journal d'audit (issue #13) ---
// À appeler DANS la transaction de la mutation auditée : si la mutation est
// annulée, l'entrée l'est aussi (jamais de trace d'une action non effectuée,
// jamais d'action sans trace). `actor` nul = action système (ex. expiration).
// `metadata` : identifiants et statuts uniquement, jamais de donnée personnelle.

export interface AuditActor {
  id: string;
  role: Role;
}

export interface AuditEntry {
  actor: AuditActor | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(
  runner: typeof db,
  entries: AuditEntry | AuditEntry[],
): Promise<void> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;
  await runner.insert(auditLogs).values(
    list.map((entry) => ({
      id: randomUUID(),
      actorUserId: entry.actor?.id ?? null,
      actorRole: entry.actor?.role ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ?? null,
    })),
  );
}
