# Bug Tracker

## BUG-01 — Contract form inputs lose focus after single character
**Status:** OPEN  
**File:** `web/components/ContractBuilder.tsx`  
**Symptom:** Typing in any text/number field (duration, occupant names, rent, etc.) kicks cursor out after one character.

**Root cause:** `FieldLabel` (line 212) and `Section` (line 224) are defined as functions **inside** `ContractBuilder`. `watch()` (line 94) subscribes to every field change → re-render on each keystroke → React treats inner function components as new types → unmounts/remounts DOM → input loses focus.

**Fix:** Move `FieldLabel` and `Section` outside the `ContractBuilder` function, above the export.

```tsx
// Before (inside ContractBuilder — BAD):
function FieldLabel({ children }) { ... }
function Section({ title, children }) { ... }

// After (outside ContractBuilder — GOOD):
function FieldLabel({ children }: { children: React.ReactNode }) { ... }
function Section({ title, children }: { title: string; children: React.ReactNode }) { ... }

export default function ContractBuilder(...) { ... }
```

**Effort:** < 5 min  
**Priority:** Critical — blocks all contract creation

---

<!-- Add new bugs below as discovered during testing -->
