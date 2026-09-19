"use client";
import { useId } from "react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Field } from "@/features/admin/form-model";

export function ContentFields({ fields, value, onChange, immutableSlug = false }: { fields: Field[]; value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; immutableSlug?: boolean }) {
  const prefix = useId();
  return <div className="space-y-5">{fields.map((f) => {
    const id = `${prefix}-${f.key}`; const current = value[f.key]; const change = (next: unknown) => onChange({ ...value, [f.key]: next });
    if (f.kind === "array") {
      const rows = current as Record<string, unknown>[];
      const move = (i: number, delta: number) => { const next = [...rows]; [next[i], next[i + delta]] = [next[i + delta], next[i]]; change(next); };
      return <fieldset key={f.key} className="min-w-0 space-y-4 rounded-xl border border-line p-4"><legend className="px-2 font-semibold">{f.label}</legend>
        {rows.map((row, i) => <details key={i} className="rounded-lg border border-line p-4" open={rows.length <= 5}>
          <summary className="cursor-pointer font-semibold">{f.label.split(" (")[0]} {i + 1}</summary>
          <div className="mt-4"><ContentFields fields={f.fields!} value={row} onChange={(next) => change(rows.map((r, index) => index === i ? next : r))} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${f.label} ${i + 1} up`}>Move up</Button>
            <Button variant="secondary" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${f.label} ${i + 1} down`}>Move down</Button>
            {!f.fixed && <Button variant="danger" onClick={() => change(rows.filter((_, index) => index !== i))} aria-label={`Remove ${f.label} ${i + 1}`}>Remove</Button>}
          </div>
        </details>)}
        {!f.fixed && <Button variant="secondary" disabled={rows.length >= (f.max ?? 100)} onClick={() => change([...rows, structuredClone(f.initial!)])}>Add {f.label.split(" (")[0].toLowerCase()}</Button>}
      </fieldset>;
    }
    if (f.kind === "choices") return <fieldset key={f.key} className="min-w-0 rounded-xl border border-line p-4"><legend className="px-2 font-semibold">{f.label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{f.options!.map(([key, label]) => <label key={key} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={(current as string[]).includes(key)} onChange={(e) => change(e.target.checked ? [...current as string[], key] : (current as string[]).filter((x) => x !== key))} />{label}</label>)}</div>
    </fieldset>;
    return <div key={f.key}><label htmlFor={id} className="mb-2 block text-sm font-semibold">{f.label}</label>
      {f.kind === "select" ? <Select id={id} value={String(current)} onChange={(e) => change(e.target.value)}>{f.options!.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select> :
        ["long", "lines", "json"].includes(f.kind) ? <textarea id={id} value={String(current ?? "")} onChange={(e) => change(e.target.value)} rows={f.kind === "json" ? 5 : 3} className="w-full rounded-xl border border-muted/60 bg-canvas p-3 font-mono text-sm" /> :
          <Input id={id} type={f.kind === "number" ? "number" : "text"} readOnly={f.key === "slug" && immutableSlug} value={String(current ?? "")} onChange={(e) => change(f.kind === "number" ? Number(e.target.value) : e.target.value)} />}
    </div>;
  })}</div>;
}
