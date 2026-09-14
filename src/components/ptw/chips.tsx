import { STATUS_META, accentToken, type PermitStatus } from "@/lib/ptw";

export function StatusChip({ status }: { status: PermitStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide"
      style={{ color: meta.token }}
    >
      <span
        className={`size-1.5 rounded-full ${meta.pulse ? "animate-pulse" : ""}`}
        style={{ background: meta.token }}
      />
      {meta.label}
    </span>
  );
}

export function TypeChip({ name, accent }: { name: string; accent: string }) {
  const token = accentToken(accent);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium"
      style={{
        color: token,
        borderColor: `color-mix(in srgb, ${token} 35%, transparent)`,
        background: `color-mix(in srgb, ${token} 8%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: token }} />
      {name.toUpperCase()}
    </span>
  );
}
