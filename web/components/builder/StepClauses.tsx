"use client";

import { useState } from "react";
import Link from "next/link";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { BookOpen, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ContractFormValues } from "@/lib/types";
import { useBuilder } from "./context";
import { Field, StepSection } from "./Field";
import { AMENITY_FLAGS, COUNT_FIELDS } from "./form-utils";

export function StepClauses() {
  const t = useTranslations("builder");
  const { control, register } = useFormContext<ContractFormValues>();
  const parkingAvailable = useWatch({ control, name: "parking_available" });

  return (
    <div className="space-y-4">
      <StepSection title={t("clauses.amenitiesTitle")} description={t("clauses.amenitiesDescription")}>
        <fieldset>
          <legend className="sr-only">{t("clauses.amenitiesTitle")}</legend>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {AMENITY_FLAGS.map((name) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <Label
                    htmlFor={`amenity_${name}`}
                    className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 font-normal hover:bg-surface-hover has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft"
                  >
                    <Checkbox
                      id={`amenity_${name}`}
                      checked={!!field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      onBlur={field.onBlur}
                    />
                    {t(`amenities.${name}`)}
                  </Label>
                )}
              />
            ))}
          </div>
        </fieldset>
        <Field id="custom_amenities" label={t("fields.customAmenities")} hint={t("fields.customAmenitiesHint")}>
          <Textarea
            id="custom_amenities"
            rows={2}
            placeholder={t("fields.customAmenitiesPlaceholder")}
            {...register("custom_amenities")}
          />
        </Field>
      </StepSection>

      <StepSection title={t("clauses.inventoryTitle")} description={t("clauses.inventoryDescription")}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {COUNT_FIELDS.map(({ name, min }) => (
            <Field key={name} id={name} label={t(`counts.${name}`)}>
              <Input
                id={name}
                type="number"
                inputMode="numeric"
                min={min}
                className="h-10 tabular"
                {...register(name, { valueAsNumber: true })}
              />
            </Field>
          ))}
        </div>
      </StepSection>

      <StepSection title={t("clauses.parkingTitle")}>
        <Controller
          control={control}
          name="parking_available"
          render={({ field }) => (
            <div className="flex min-h-10 items-center gap-3">
              <Switch id="parking_available" checked={!!field.value} onCheckedChange={field.onChange} />
              <Label htmlFor="parking_available" className="font-normal">
                {t("fields.parkingIncluded")}
              </Label>
            </div>
          )}
        />
        {parkingAvailable && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="parking_count" label={t("fields.parkingCount")}>
              <Input
                id="parking_count"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                className="h-10 tabular"
                {...register("parking_count", { valueAsNumber: true })}
              />
            </Field>
            <Field id="parking_spot" label={t("fields.parkingSpot")}>
              <Input
                id="parking_spot"
                className="h-10"
                placeholder={t("fields.parkingSpotPlaceholder")}
                {...register("parking_spot")}
              />
            </Field>
          </div>
        )}
      </StepSection>

      <CustomClauses />
    </div>
  );
}

function CustomClauses() {
  const t = useTranslations("builder");
  const { sections, setSections, userTemplates } = useBuilder();
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);

  const added = new Set(sections.map((s) => s.title));

  return (
    <StepSection
      title={t("clauses.customTitle")}
      description={t("clauses.customDescription")}
      actions={
        <Button asChild variant="link" size="sm" className="shrink-0 px-0">
          <Link href="/settings/sections">{t("clauses.manageLibrary")}</Link>
        </Button>
      }
    >
      {sections.length > 0 && (
        <ol className="space-y-3">
          {sections.map((sec, i) => (
            <li key={i} className="rounded-lg border border-border bg-surface-muted p-3">
              {editIdx === i ? (
                <div className="space-y-3">
                  <Field id={`sec_edit_title_${i}`} label={t("clauses.clauseTitle")}>
                    <Input
                      id={`sec_edit_title_${i}`}
                      className="h-10"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </Field>
                  <Field id={`sec_edit_body_${i}`} label={t("clauses.clauseBody")}>
                    <Textarea
                      id={`sec_edit_body_${i}`}
                      rows={4}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-10 md:h-8"
                      disabled={!editTitle.trim()}
                      onClick={() => {
                        if (!editTitle.trim()) return;
                        setSections(sections.map((s, j) => (j === i ? { title: editTitle.trim(), body: editBody } : s)));
                        setEditIdx(null);
                      }}
                    >
                      <Check />
                      {t("clauses.saveClause")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-10 md:h-8"
                      onClick={() => setEditIdx(null)}
                    >
                      {t("clauses.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {i + 1}. {sec.title}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 md:size-8"
                        aria-label={t("clauses.editClause", { title: sec.title })}
                        onClick={() => {
                          setEditIdx(i);
                          setEditTitle(sec.title);
                          setEditBody(sec.body);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 text-danger hover:text-danger md:size-8"
                        aria-label={t("clauses.removeClause", { title: sec.title })}
                        onClick={() => {
                          setSections(sections.filter((_, j) => j !== i));
                          if (editIdx === i) setEditIdx(null);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {sec.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{sec.body}</p>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {userTemplates.length > 0 && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 md:h-9"
            aria-expanded={showLibrary}
            aria-controls="clause-library"
            onClick={() => setShowLibrary((v) => !v)}
          >
            <BookOpen />
            {t("clauses.fromLibrary")}
          </Button>
          {showLibrary && (
            <ul id="clause-library" className="divide-y divide-border rounded-lg border border-border">
              {userTemplates.map((tpl) => (
                <li key={tpl.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-foreground">{tpl.title}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={added.has(tpl.title) ? "ghost" : "secondary"}
                    className="h-10 shrink-0 md:h-8"
                    onClick={() => setSections([...sections, { title: tpl.title, body: tpl.body }])}
                  >
                    <Plus />
                    {added.has(tpl.title) ? t("clauses.addAgain") : t("clauses.add")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-dashed border-border-strong p-3">
        <p className="text-sm font-medium text-foreground">{t("clauses.newClause")}</p>
        <Field id="sec_new_title" label={t("clauses.clauseTitle")}>
          <Input
            id="sec_new_title"
            className="h-10"
            placeholder={t("clauses.clauseTitlePlaceholder")}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        </Field>
        <Field id="sec_new_body" label={t("clauses.clauseBody")}>
          <Textarea
            id="sec_new_body"
            rows={3}
            placeholder={t("clauses.clauseBodyPlaceholder")}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
          />
        </Field>
        <Button
          type="button"
          variant="secondary"
          className="h-10 md:h-9"
          disabled={!newTitle.trim()}
          onClick={() => {
            if (!newTitle.trim()) return;
            setSections([...sections, { title: newTitle.trim(), body: newBody }]);
            setNewTitle("");
            setNewBody("");
          }}
        >
          <Plus />
          {t("clauses.addClause")}
        </Button>
      </div>
    </StepSection>
  );
}
