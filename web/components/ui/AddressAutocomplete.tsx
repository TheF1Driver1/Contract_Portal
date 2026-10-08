"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AddressParts {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface Suggestion {
  display_name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface Props {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  onSelect: (parts: AddressParts) => void;
  required?: boolean;
}

export default function AddressAutocomplete({
  id,
  label,
  placeholder = "Start typing an address…",
  value,
  onChange,
  onSelect,
  required,
}: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-suggestions`;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/address-suggest?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      // silently ignore
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 500);
  }

  function handleSelect(s: Suggestion) {
    onChange(s.street || s.display_name);
    onSelect({ street: s.street, city: s.city, state: s.state, zip: s.zip, country: s.country });
    setSuggestions([]);
    setOpen(false);
  }

  function handleBlur() {
    blurRef.current = setTimeout(() => setOpen(false), 200);
  }

  function handleFocus() {
    if (blurRef.current) clearTimeout(blurRef.current);
    if (suggestions.length > 0) setOpen(true);
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (blurRef.current) clearTimeout(blurRef.current);
  }, []);

  const expanded = open && suggestions.length > 0;

  return (
    <div className="relative space-y-1.5">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <Input
        id={inputId}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        autoComplete="off"
        required={required}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-md"
        >
          {suggestions.map((s, i) => (
            <li key={i} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                onMouseDown={() => handleSelect(s)}
              >
                <span className="font-medium text-foreground">
                  {s.street || s.display_name.split(",")[0]}
                </span>
                {s.city && (
                  <span className="ml-1 text-xs">
                    {s.city}
                    {s.state ? `, ${s.state}` : ""}
                    {s.zip ? ` ${s.zip}` : ""}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
