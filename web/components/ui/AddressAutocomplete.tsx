"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  onSelect: (parts: AddressParts) => void;
  required?: boolean;
}

export default function AddressAutocomplete({
  label,
  placeholder = "Start typing an address…",
  value,
  onChange,
  onSelect,
  required,
}: Props) {
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

  return (
    <div className="relative space-y-1.5">
      {label && (
        <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
        </label>
      )}
      <input
        className="input-tonal"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        autoComplete="off"
        required={required}
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 w-full rounded-xl overflow-hidden shadow-lg border"
          style={{
            background: "var(--surface-card)",
            borderColor: "var(--surface-container)",
            top: "calc(100% + 4px)",
          }}
        >
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[rgba(16, 185, 129,0.08)]"
                style={{ color: "var(--text-secondary)" }}
                onMouseDown={() => handleSelect(s)}
              >
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {s.street || s.display_name.split(",")[0]}
                </span>
                {s.city && <span className="ml-1 text-[10px]">{s.city}{s.state ? `, ${s.state}` : ""}{s.zip ? ` ${s.zip}` : ""}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
