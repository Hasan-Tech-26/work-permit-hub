import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { AppShell } from "@/components/ptw/app-shell";
import { createPermit, listPermitTypes, listPlantAreas, submitPermit } from "@/lib/ptw.functions";

export const Route = createFileRoute("/permits/new")({
  loader: async () => {
    const [permitTypes, plants] = await Promise.all([listPermitTypes(), listPlantAreas()]);
    return { permitTypes, plants };
  },
  component: CreatePermitPage,
});

function CreatePermitPage() {
  const { permitTypes, plants } = Route.useLoaderData();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [permitTypeId, setPermitTypeId] = useState(permitTypes[0]?.id ?? "");
  const [contractorCompany, setContractorCompany] = useState("");
  const [workTeam, setWorkTeam] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [plantId, setPlantId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [equipment, setEquipment] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [hazards, setHazards] = useState("");
  const [ppe, setPpe] = useState("");
  const [precautions, setPrecautions] = useState("");
  const [typeData, setTypeData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedType = permitTypes.find((type) => type.id === permitTypeId);
  const selectedPlant = plants.find((plant) => plant.id === plantId);

  const handleTypeChange = (id: string) => {
    setPermitTypeId(id);
    setTypeData({});
  };

  const updateTypeField = (key: string, value: unknown) => {
    setTypeData((current) => ({ ...current, [key]: value }));
  };

  const createDraft = async (submitImmediately = false) => {
    setError("");

    if (!permitTypeId || !plantId || !areaId) {
      setError("Please complete all required fields.");
      return;
    }

    if (!plannedStart || !plannedEnd) {
      setError("Please select the planned start and end time.");
      return;
    }

    if (new Date(plannedEnd) <= new Date(plannedStart)) {
      setError("Planned end must be after planned start.");
      return;
    }

    try {
      setSaving(true);

      const permit = await createPermit({
        data: {
          permitTypeId,
          contractorCompany,
          workTeam,
          workDescription,
          plantId,
          areaId,
          equipment,
          plannedStart: new Date(plannedStart).toISOString(),
          plannedEnd: new Date(plannedEnd).toISOString(),
          hazards: hazards
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          ppe: ppe
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          precautions: precautions
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          typeData,
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["permits"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);

      if (submitImmediately) {
        await submitPermit({ data: { permitId: permit.id } });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["permits"] }),
          queryClient.invalidateQueries({ queryKey: ["activity"] }),
        ]);
      }

      await navigate({
        to: "/permits/$permitNumber",
        params: { permitNumber: permit.permit_number },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create permit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell breadcrumb="OPERATIONS / CREATE PERMIT" title="CREATE PERMIT">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 xl:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-safety">
              (a) PERMIT PREP
            </div>
            <h2 className="mt-1 text-2xl font-semibold">New Permit Record</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/permits" })}
            className="rounded-md border border-border bg-background px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-muted"
          >
            BACK TO REGISTER
          </button>
        </div>

        <form className="space-y-5 rounded-xl border border-border bg-raised p-5 sm:p-6">
          <section className="space-y-4 rounded-md border border-border bg-background p-4">
            <div className="font-mono text-[10px] tracking-[0.18em] text-safety">
              1. BASIC INFORMATION
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Permit Type"
                value={permitTypeId}
                onChange={handleTypeChange}
                required
              >
                {permitTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </SelectField>
              <Field
                label="Contractor / Company"
                value={contractorCompany}
                onChange={setContractorCompany}
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Work Team" value={workTeam} onChange={setWorkTeam} required />
              <Field label="Equipment" value={equipment} onChange={setEquipment} required />
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Work Description *</span>
              <textarea
                value={workDescription}
                onChange={(event) => setWorkDescription(event.target.value)}
                rows={4}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Describe the job scope, access arrangements, and expected tasks."
              />
            </label>
          </section>

          <section className="space-y-4 rounded-md border border-border bg-background p-4">
            <div className="font-mono text-[10px] tracking-[0.18em] text-safety">2. LOCATION</div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Plant"
                value={plantId}
                onChange={(value) => {
                  setPlantId(value);
                  setAreaId("");
                }}
                required
              >
                <option value="">Select plant</option>
                {plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name} ({plant.code})
                  </option>
                ))}
              </SelectField>
              <SelectField label="Area" value={areaId} onChange={setAreaId} required>
                <option value="">Select area</option>
                {(selectedPlant?.areas ?? []).map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({area.code})
                  </option>
                ))}
              </SelectField>
            </div>
          </section>

          <section className="space-y-4 rounded-md border border-border bg-background p-4">
            <div className="font-mono text-[10px] tracking-[0.18em] text-safety">3. SCHEDULE</div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Planned Start *</span>
                <input
                  type="datetime-local"
                  value={plannedStart}
                  onChange={(event) => setPlannedStart(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Planned End *</span>
                <input
                  type="datetime-local"
                  value={plannedEnd}
                  onChange={(event) => setPlannedEnd(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-md border border-border bg-background p-4">
            <div className="font-mono text-[10px] tracking-[0.18em] text-safety">
              4. HAZARDS / PPE / PRECAUTIONS
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <TagField
                label="Hazards"
                value={hazards}
                onChange={setHazards}
                placeholder="Hot work, confined space"
              />
              <TagField
                label="PPE"
                value={ppe}
                onChange={setPpe}
                placeholder="Helmet, gloves, harness"
              />
              <TagField
                label="Precautions"
                value={precautions}
                onChange={setPrecautions}
                placeholder="Isolation, barricading"
              />
            </div>
          </section>

          {selectedType && selectedType.field_schema?.length ? (
            <section className="space-y-4 rounded-md border border-border bg-background p-4">
              <div className="font-mono text-[10px] tracking-[0.18em] text-safety">
                5. TYPE-SPECIFIC REQUIREMENTS
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {selectedType.field_schema.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-sm font-medium">{field.label}</label>
                    {field.type === "boolean" ? (
                      <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(typeData[field.key])}
                          onChange={(event) => updateTypeField(field.key, event.target.checked)}
                        />
                        Confirmed
                      </label>
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        value={(typeData[field.key] as string | number | undefined) ?? ""}
                        onChange={(event) =>
                          updateTypeField(
                            field.key,
                            field.type === "number"
                              ? Number(event.target.value)
                              : event.target.value,
                          )
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {error ? (
            <div className="rounded-md border border-st-rejected/40 bg-st-rejected/10 p-3 text-sm text-st-rejected">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => navigate({ to: "/permits" })}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void createDraft(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void createDraft(true)}
              className="rounded-md bg-safety px-5 py-2 text-sm font-medium text-safety-ink disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit for Approval"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  required = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        {children}
      </select>
    </label>
  );
}

function TagField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
