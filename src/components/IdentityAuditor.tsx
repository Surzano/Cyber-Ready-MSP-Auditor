"use client";

import { Crown, Download, FileSpreadsheet, FileUp, KeyRound, Lock, PiggyBank, Search, ShieldOff, UserX, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { downloadText } from "@/lib/download";
import { formatUsd } from "@/lib/grading";
import { STALE_DAYS, auditCsv, type AuditedUser, type FlagCode, type IdentityAudit } from "@/lib/identity";
import { buildBlankTemplateCsv, buildSampleCsv } from "@/lib/sampleData";
import { Button, Card, ClinicBadge, EmptyState, GradeBadge, Kpi, SectionTitle, cx } from "./ui";

type Filter = "flagged" | "all" | "mfa" | "stale" | "admin" | "waste";

const FLAG_STYLE: Record<FlagCode, { label: string; cls: string }> = {
  ADMIN_NO_MFA: { label: "Admin · No MFA", cls: "bg-rose-600 text-white ring-rose-600" },
  NO_MFA: { label: "No MFA", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  STALE: { label: `Stale >${STALE_DAYS}d`, cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  LICENSE_WASTE: { label: "License waste", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
  GLOBAL_ADMIN: { label: "Global Admin", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
};

export function IdentityAuditor({ audit, onAudit, onLoadSample }: { audit: IdentityAudit | null; onAudit: (a: IdentityAudit) => void; onLoadSample: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("flagged");
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setError("Please choose a .csv file (export from Microsoft 365 / Entra ID or Google Workspace Admin).");
      return;
    }
    try {
      onAudit(auditCsv(await file.text(), file.name));
      setFilter("flagged");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that CSV.");
    }
  }

  const rows = useMemo(() => {
    if (!audit) return [];
    const q = query.trim().toLowerCase();
    const match: Record<Filter, (u: AuditedUser) => boolean> = {
      flagged: (u) => u.severity !== "ok",
      all: () => true,
      mfa: (u) => u.flags.includes("NO_MFA") || u.flags.includes("ADMIN_NO_MFA"),
      stale: (u) => u.stale,
      admin: (u) => u.isGlobalAdmin && u.enabled,
      waste: (u) => u.flags.includes("LICENSE_WASTE"),
    };
    const rank = { critical: 0, warning: 1, ok: 2 };
    return audit.users
      .filter(match[filter])
      .filter((u) => !q || `${u.displayName} ${u.upn} ${u.title} ${u.role}`.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          rank[a.severity] - rank[b.severity] ||
          Number(b.flags.includes("ADMIN_NO_MFA")) - Number(a.flags.includes("ADMIN_NO_MFA")) ||
          b.flags.length - a.flags.length ||
          a.displayName.localeCompare(b.displayName),
      );
  }, [audit, filter, query]);

  const filters: { key: Filter; label: string; count: number }[] = audit
    ? [
        { key: "flagged", label: "Flagged", count: audit.users.filter((u) => u.severity !== "ok").length },
        { key: "mfa", label: "Missing MFA", count: audit.missingMfa.length },
        { key: "stale", label: "Stale", count: audit.stale.length },
        { key: "admin", label: "Global Admins", count: audit.globalAdmins.length },
        { key: "waste", label: "License Waste", count: audit.wasted.length },
        { key: "all", label: "All", count: audit.totalAccounts },
      ]
    : [];

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<Users className="h-5 w-5" />}
        title="Identity & License Hygiene Auditor"
        subtitle="Drop in a user export from Microsoft 365 / Entra ID or Google Workspace. We flag accounts without MFA, dormant ex-staff, admin sprawl, and the dollars spent on licenses nobody uses."
        ids={["identity-sec-17", "identity-sec-21", "identity-sec-22", "asset-manage-11"]}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadText("sample-hope-valley-users.csv", buildSampleCsv())}>
              <Download className="h-4 w-4" /> Download Sample CSV
            </Button>
            <Button variant="ghost" onClick={() => downloadText("blank-user-import-template.csv", buildBlankTemplateCsv())}>
              <FileSpreadsheet className="h-4 w-4" /> Blank Template
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
          role="button"
          tabIndex={0}
          className={cx(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
            dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40",
          )}
        >
          <FileUp className={cx("h-8 w-8", dragging ? "text-emerald-600" : "text-slate-400")} />
          <div className="text-sm font-semibold text-slate-800">Drag & drop a user export CSV, or click to browse</div>
          <div className="text-xs text-slate-500">Columns auto-detected: displayName/Name · userPrincipalName/Email · accountEnabled/Status · mfaStatus/2SV Enrolled · lastSignInDateTime · role · licenses</div>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <Lock className="h-3 w-3" /> Parsed in your browser memory only — never uploaded
          </div>
          <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)} />
        </div>
        <Card className="flex flex-col justify-center gap-3 p-5 lg:w-80">
          <div className="text-sm font-semibold text-slate-800">Presenting? Use the sample tenant.</div>
          <p className="text-xs text-slate-500">22 synthetic accounts for a 24-person nonprofit managed by an outside MSP.</p>
          <Button variant="dark" onClick={onLoadSample}>
            <Users className="h-4 w-4" /> Load Sample Nonprofit Tenant (Hope Valley Community Services)
          </Button>
        </Card>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

      {!audit ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No user directory loaded yet">
          Export users from <b>Microsoft Entra admin center → Users → Download users</b> (add per-user MFA and sign-in activity), or <b>Google Admin → Directory → Users → Download</b>, then drop the file above.
        </EmptyState>
      ) : (
        <div className="animate-fade-up space-y-6" key={audit.source + audit.totalAccounts}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(4,1fr)_auto]">
            <Kpi
              label="MFA Coverage"
              value={`${audit.mfaCoveragePct}%`}
              sub={`${audit.missingMfa.length} enabled account${audit.missingMfa.length === 1 ? "" : "s"} without MFA`}
              tone={audit.mfaCoveragePct === 100 ? "good" : audit.mfaCoveragePct >= 90 ? "ok" : "bad"}
              icon={<KeyRound className="h-4 w-4" />}
              id="identity-sec-17"
            />
            <Kpi
              label="Stale Accounts Found"
              value={audit.stale.length}
              sub={`Enabled, no sign-in for >${STALE_DAYS} days`}
              tone={audit.stale.length === 0 ? "good" : audit.stale.length <= 1 ? "ok" : "bad"}
              icon={<UserX className="h-4 w-4" />}
              id="identity-sec-21"
            />
            <Kpi
              label="Global Admin Count"
              value={audit.globalAdmins.length}
              sub={audit.adminsWithoutMfa.length ? `${audit.adminsWithoutMfa.length} admin without MFA — CRITICAL` : audit.adminSprawl === "warning" ? "Admin sprawl: recommended ≤ 3" : "Within recommended range"}
              tone={audit.adminSprawl === "critical" ? "bad" : audit.adminSprawl === "warning" ? "ok" : "good"}
              icon={<Crown className="h-4 w-4" />}
              id="identity-sec-22"
            />
            <Kpi
              label="Annual License Savings"
              value={formatUsd(audit.annualWaste)}
              sub={`${formatUsd(audit.monthlyWaste)}/mo across ${audit.wasted.length} inactive account${audit.wasted.length === 1 ? "" : "s"}`}
              tone={audit.annualWaste === 0 ? "good" : "ok"}
              icon={<PiggyBank className="h-4 w-4" />}
              id="asset-manage-11"
            />
            <Card className="flex items-center justify-center p-5 sm:col-span-2 xl:col-span-1">
              <div className="text-center">
                <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Identity Grade</div>
                <GradeBadge grade={audit.grade} size="lg" score={audit.score} />
              </div>
            </Card>
          </div>

          {audit.adminsWithoutMfa.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
              <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <b>Critical:</b> {audit.adminsWithoutMfa.map((u) => `${u.displayName} (${u.upn})`).join(", ")} {audit.adminsWithoutMfa.length > 1 ? "hold" : "holds"} Global Admin rights with MFA disabled. One stolen password gives an attacker full control of every mailbox and file in the organization.
              </div>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex flex-wrap gap-1.5">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={cx(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                      filter === f.key ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    {f.label} <span className="ml-1 tabular-nums opacity-70">{f.count}</span>
                  </button>
                ))}
              </div>
              <label className="relative">
                <span className="sr-only">Search accounts</span>
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, role…"
                  className="w-56 rounded-lg border border-slate-200 py-1.5 pr-3 pl-8 text-xs outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-2.5">Account</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">MFA</th>
                    <th className="px-3 py-2.5">Last Sign-In</th>
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">License</th>
                    <th className="px-5 py-2.5">Findings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((u) => (
                    <tr key={u.upn + u.displayName} className={cx(u.severity === "critical" ? "bg-rose-50/60" : u.severity === "warning" ? "bg-amber-50/50" : "")}>
                      <td className="px-5 py-2.5">
                        <div className="font-semibold text-slate-900">{u.displayName}</div>
                        <div className="text-xs text-slate-500">
                          {u.upn}
                          {u.title && <> · {u.title}</>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cx("text-xs font-semibold", u.enabled ? "text-slate-700" : "text-slate-400")}>{u.enabled ? "Enabled" : "Disabled"}</span>
                        {u.accountType !== "Member" && <div className="text-[11px] text-slate-400">{u.accountType}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cx("text-xs font-semibold", u.mfa === false ? "text-rose-600" : u.mfa ? "text-emerald-700" : "text-slate-400")}>
                          {u.mfa === null ? "Unknown" : u.mfa ? "On" : "Off"}
                        </span>
                      </td>
                      <td className={cx("px-3 py-2.5 text-xs tabular-nums", u.stale ? "font-semibold text-amber-700" : "text-slate-600")}>
                        {u.lastSignIn ? `${u.lastSignIn.toLocaleDateString()} (${u.daysSinceSignIn}d)` : "Never"}
                      </td>
                      <td className={cx("px-3 py-2.5 text-xs", u.isGlobalAdmin ? "font-semibold text-slate-900" : "text-slate-600")}>{u.role}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {u.license}
                        {u.isPaid && <span className="ml-1 text-slate-400 tabular-nums">({formatUsd(u.monthlyCost)}/mo)</span>}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {u.flags.map((f) => (
                            <span key={f} className={cx("rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ring-1 ring-inset", FLAG_STYLE[f].cls)}>
                              {FLAG_STYLE[f].label}
                            </span>
                          ))}
                          {u.flags.length === 0 && <span className="text-xs text-emerald-600">✓ Clean</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                        No accounts match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-xs text-slate-500">
              <span>
                Source: <b className="text-slate-700">{audit.source}</b> · {audit.totalAccounts} accounts · {audit.enabledAccounts} enabled
              </span>
              <span className="flex gap-1.5">
                <ClinicBadge id="identity-sec-17" />
                <ClinicBadge id="identity-sec-21" />
                <ClinicBadge id="identity-sec-22" />
                <ClinicBadge id="asset-manage-11" />
              </span>
            </div>
          </Card>

          {audit.warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
              {audit.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
