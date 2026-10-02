export const PERMIT_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
  "REJECTED",
  "EXPIRED",
  "CLOSED",
  "CLOSED_VERIFIED",
  "CANCELLED",
] as const;

export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export type AppRole = "requester" | "area_owner" | "safety_officer" | "admin";

export const ROLE_LABELS: Record<AppRole, string> = {
  requester: "Requester",
  area_owner: "Area Owner",
  safety_officer: "Safety Officer",
  admin: "Admin",
};

export const PERMIT_STATUS_ORDER: Record<PermitStatus, number> = {
  DRAFT: 0,
  PENDING_APPROVAL: 1,
  APPROVED: 2,
  ACTIVE: 3,
  SUSPENDED: 4,
  REJECTED: 5,
  EXPIRED: 6,
  CLOSED: 7,
  CLOSED_VERIFIED: 8,
  CANCELLED: 9,
};

export function riskFromHazards(hazards: string[] = []) {
  const normalized = hazards
    .flatMap((entry) => String(entry).split(/[;,]/))
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const highRiskKeywords = [
    "electrical",
    "hot work",
    "fire",
    "explosive",
    "confined",
    "asphyxiation",
    "oxygen",
    "chemical",
    "pressure",
    "lift",
    "crane",
    "fall",
    "height",
  ];

  const criticalKeywords = [
    "gas",
    "hydrogen",
    "live electrical",
    "confined space",
    "explosion",
    "radiation",
  ];

  const matches = normalized.filter((entry) =>
    highRiskKeywords.some((keyword) => entry.includes(keyword)),
  );
  const criticalMatches = normalized.filter((entry) =>
    criticalKeywords.some((keyword) => entry.includes(keyword)),
  );

  if (criticalMatches.length > 0) return "Critical";
  if (matches.length > 1 || normalized.length > 3) return "High";
  if (normalized.length > 0) return "Medium";
  return "Low";
}

export function expiryLabel(isoDate: string) {
  const end = new Date(isoDate).getTime();
  const now = Date.now();
  const diff = end - now;

  if (Number.isNaN(diff) || diff <= 0) return "Expired";
  const totalMinutes = Math.max(0, Math.round(diff / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Expires in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Expires in ${minutes}m`;
  return "Expires soon";
}

type StatusMeta = { label: string; token: string; pulse: boolean };

export const STATUS_META: Record<PermitStatus, StatusMeta> = {
  DRAFT: { label: "DRAFT", token: "var(--st-draft)", pulse: false },
  PENDING_APPROVAL: { label: "PENDING", token: "var(--st-pending)", pulse: false },
  APPROVED: { label: "APPROVED", token: "var(--st-approved)", pulse: false },
  ACTIVE: { label: "ACTIVE", token: "var(--st-active)", pulse: true },
  SUSPENDED: { label: "SUSPENDED", token: "var(--st-suspended)", pulse: true },
  REJECTED: { label: "REJECTED", token: "var(--st-rejected)", pulse: false },
  EXPIRED: { label: "EXPIRED", token: "var(--st-expired)", pulse: false },
  CLOSED: { label: "CLOSED", token: "var(--st-closed)", pulse: false },
  CLOSED_VERIFIED: { label: "CLOSED VRF", token: "var(--st-verified)", pulse: false },
  CANCELLED: { label: "CANCELLED", token: "var(--st-cancelled)", pulse: false },
};

export function accentToken(accent: string) {
  return `var(--st-${accent === "safety" ? "active" : accent})`;
}

export type TypeField = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean";
};

export type PermitTypeRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  accent: string;
  field_schema: TypeField[];
};

export type PermitRow = {
  id: string;
  permit_number: string;
  status: PermitStatus;
  contractor_company: string | null;
  work_team: string | null;
  work_description: string;
  equipment: string | null;
  planned_start: string;
  planned_end: string;
  hazards: string[];
  ppe: string[];
  precautions: string[];
  type_data: Record<string, unknown>;
  permit_type: { code: string; name: string; accent: string; field_schema: TypeField[] } | null;
  plant: { name: string; code: string } | null;
  area: { name: string; code: string } | null;
  requester: { full_name: string; job_title: string | null } | null;
};

export type ApprovalRow = {
  id: string;
  step_order: number;
  required_role: AppRole;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  comment: string | null;
  decided_at: string | null;
  approver: { full_name: string } | null;
};

export type HistoryRow = {
  id: string;
  from_status: PermitStatus | null;
  to_status: PermitStatus;
  note: string | null;
  created_at: string;
  permit: { permit_number: string; area: { name: string } | null } | null;
  changed_by: { full_name: string } | null;
};

export type WorkLogRow = {
  id: string;
  notes: string;
  logged_at: string;
  logged_by: { full_name: string } | null;
};

export type AuditRow = {
  id: string;
  action: string;
  from_status: PermitStatus | null;
  to_status: PermitStatus | null;
  comment: string | null;
  field_changes: Record<string, unknown>;
  created_at: string;
  actor: { full_name: string } | null;
};

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
