# ContractOS Design System

Source: Apple Vision Pro × dark Apple.com marketing aesthetic.
Philosophy: **Void-first Futurism** — black canvas, glowing intentions. Every element earns its pixel.

---

## Visual Theme & Atmosphere

Pure black foundation. No grey sections — darkness is the structure. Depth comes from glow, blur, and scale. Text is either near-white or electric blue — nothing in between for primary content. Feels like a product launch page from 2028.

References: apple.com/apple-vision-pro, Linear.app, Vercel.com dark.

---

## Color Tokens (CSS Custom Properties)

**This system is dark-first. Light mode is not supported.**

All colors live in `globals.css`. **Never hardcode hex in components** — use `var(--token)`.

| Token | Value | Use |
|-------|-------|-----|
| `--bg-void` | `#000000` | Page base, hero backdrop |
| `--bg-surface` | `#0a0a0a` | Raised sections, subtle lift |
| `--bg-card` | `#111111` | Cards, panels |
| `--bg-card-hover` | `#161616` | Card hover state |
| `--bg-input` | `#111111` | Input fields |
| `--bg-glass` | `rgba(255,255,255,0.04)` | Glass card fill |
| `--bg-glass-hover` | `rgba(255,255,255,0.07)` | Glass hover |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Card borders, nav divider |
| `--border-glow` | `rgba(0,122,255,0.40)` | Focus rings, accent borders |
| `--text-primary` | `#f5f5f7` | Headlines, primary body |
| `--text-secondary` | `#86868b` | Supporting copy, labels |
| `--text-muted` | `#48484a` | Captions, eyebrows, metadata |
| `--text-link` | `#2997ff` | Links, inline CTAs |
| `--accent-blue` | `#2997ff` | Primary CTA, highlights |
| `--accent-blue-glow` | `rgba(41,151,255,0.25)` | Glow halos, button shadow |
| `--accent-blue-dim` | `rgba(41,151,255,0.12)` | Tinted pill bg, icon bg |
| `--glow-hero` | `rgba(41,151,255,0.15)` | Hero radial glow behind headline |
| `--error` | `#ff453a` | Destructive, expired |
| `--success` | `#30d158` | Active, signed |
| `--warning` | `#ffd60a` | Expiring soon |

---

## Typography

Font: **Inter** — tight, heavy, aggressive at display scale. At large sizes behaves like SF Pro Display.

| Role | Size | Weight | Letter-spacing | Use |
|------|------|--------|----------------|-----|
| Hero Display | `text-7xl–9xl` | `800` | `-0.05em` | One-line killer headline |
| Section Headline | `text-5xl–6xl` | `700` | `-0.04em` | Feature section titles |
| Sub-headline | `text-2xl–3xl` | `600` | `-0.02em` | Card headings |
| Body Lead | `text-lg–xl` | `400` | `-0.01em` | Hero subtext |
| Body | `text-base` | `400` | `0` | Paragraphs |
| Label | `text-sm` | `500` | `0` | UI labels, nav |
| Eyebrow | `text-xs` | `600` | `+0.12em` | Uppercase section tags |

### Gradient Text (hero headlines only)
```tsx
<h1 className="text-8xl font-extrabold leading-none"
    style={{ letterSpacing: "-0.05em", background: "linear-gradient(135deg, #f5f5f7 0%, #86868b 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
  Sign leases.<br />Not time.
</h1>
```

### Eyebrow pattern
```tsx
<p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
  Rental Contracts
</p>
```

---

## Depth & Elevation

No box shadows from light sources. Depth = glow + border + blur.

| Level | Style |
|-------|-------|
| Page | `background: #000` — absolute void |
| Glass card | `background: var(--bg-glass)` + `border: 1px solid var(--border-subtle)` + `backdrop-filter: blur(20px)` |
| Raised card | `background: var(--bg-card)` + `border: 1px solid var(--border-subtle)` |
| Glow CTA | `box-shadow: 0 0 40px var(--accent-blue-glow), 0 0 80px rgba(41,151,255,0.08)` |
| Hero radial | `radial-gradient(ellipse 80% 50% at 50% -10%, var(--glow-hero), transparent)` behind headline |
| Focus ring | `outline: 2px solid var(--border-glow)` |

---

## The Border Rule

**No solid decorative borders.** Borders are structural only:
- Cards: `1px solid var(--border-subtle)` — defines edge, not decoration
- Focus states: `2px solid var(--border-glow)` — accessibility
- Nav bottom: `1px solid var(--border-subtle)` — anchors to top
- Never use borders as section dividers — use void (black gap / padding) instead

---

## Utility Classes

Defined in `globals.css`.

### Surfaces
```css
.glass-card         /* bg-glass + border-subtle + backdrop-blur-xl + rounded-3xl */
.dark-card          /* bg-card + border-subtle + rounded-3xl */
.dark-card-hover    /* dark-card + hover:bg-card-hover transition */
.section-void       /* bg-void, full-width, py-32 */
.section-raised     /* bg-surface, full-width, py-32 */
.nav-frosted        /* bg-void/80 + backdrop-blur-2xl + border-b border-subtle */
```

### Actions
```css
.btn-primary        /* bg-accent-blue, text-void, rounded-full, px-7 py-3, font-medium, glow shadow */
.btn-glass          /* glass bg, text-primary, border-subtle, rounded-full — secondary action */
.btn-ghost          /* no bg, text-link, hover:text-primary — tertiary/inline */
```

### Inputs
```css
.input-void         /* bg-input + border-subtle + rounded-xl + focus:border-glow + text-primary */
```

### Status Pills
```css
.pill-active    /* bg accent-blue-dim, text accent-blue — signed/active */
.pill-draft     /* bg rgba(255,255,255,0.06), text-secondary — draft */
.pill-sent      /* bg rgba(41,151,255,0.08), text-link — sent */
.pill-expired   /* bg rgba(255,69,58,0.12), text error — expired */
```

### Text utilities
```css
.text-primary    /* var(--text-primary) */
.text-secondary  /* var(--text-secondary) */
.text-muted      /* var(--text-muted) */
.text-link       /* var(--text-link) */
.text-gradient   /* silver-to-grey gradient fill — hero only */
```

### Glow / FX
```css
.glow-blue       /* box-shadow: 0 0 40px var(--accent-blue-glow) */
.hero-radial     /* pseudo ::before radial blue glow, absolute, pointer-events-none */
.noise-overlay   /* subtle SVG noise texture at 3% opacity — adds analogue grain */
```

---

## Animations

All: `cubic-bezier(0.16, 1, 0.3, 1)` — ease-out-expo, 600–900ms. Slow entry, instant settle.

| Class | Effect | Duration | Use |
|-------|--------|----------|-----|
| `animate-fade-up` | opacity 0→1 + translateY 32px→0 | 700ms | Primary content reveal |
| `animate-fade-in` | opacity 0→1 | 500ms | Secondary elements |
| `animate-blur-in` | blur(12px)→0 + fade | 800ms | Hero headline |
| `animate-glow-pulse` | glow opacity 0.2→0.5→0.2 loop | 3s | CTA button glow halo |
| `animate-float` | translateY 0→-8px→0 loop | 6s ease-in-out | Hero device mockup |
| `animate-scale-in` | scale 0.96→1 + fade | 400ms | Modal, popover |
| `animate-shimmer` | shimmer pass | 1.5s | Skeleton loading |

Stagger: `stagger-1` → `stagger-8` (delay 0.07–0.56s). Use on hero children — eyebrow, headline, subtext, CTAs.

Scroll-triggered: use `data-animate="fade-up"` attribute + IntersectionObserver in a single `animations.ts` utility. Elements start `opacity-0 translate-y-8` and transition in when `threshold: 0.15`.

---

## Component Patterns

### Hero Section
```tsx
<section className="section-void relative overflow-hidden text-center">
  {/* Radial glow behind headline */}
  <div className="hero-radial" aria-hidden />

  <div className="relative max-w-4xl mx-auto px-6">
    <p className="text-xs font-semibold uppercase tracking-[0.12em] mb-6 animate-fade-in"
       style={{ color: "var(--text-muted)" }}>
      Rental Contracts
    </p>
    <h1 className="text-8xl font-extrabold leading-none mb-8 animate-blur-in text-gradient"
        style={{ letterSpacing: "-0.05em" }}>
      Sign leases.<br />Not time.
    </h1>
    <p className="text-xl mb-12 max-w-2xl mx-auto stagger-2"
       style={{ color: "var(--text-secondary)", letterSpacing: "-0.01em" }}>
      Draft, send, and collect signatures in minutes. Built for landlords who move fast.
    </p>
    <div className="flex gap-4 justify-center stagger-3">
      <button className="btn-primary animate-glow-pulse">Get Started Free</button>
      <button className="btn-glass">See how it works →</button>
    </div>
  </div>
</section>
```

### Glass Feature Card
```tsx
<div className="glass-card p-8 dark-card-hover transition-colors duration-300" data-animate="fade-up">
  <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-6"
       style={{ background: "var(--accent-blue-dim)" }}>
    <Icon className="h-5 w-5" style={{ color: "var(--accent-blue)" }} />
  </div>
  <h3 className="text-xl font-semibold mb-3"
      style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
    Feature Title
  </h3>
  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
    Feature description. Short. Punchy. No filler.
  </p>
</div>
```

### Frosted Nav
```tsx
<nav className="nav-frosted fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 h-14">
  <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>ContractOS</span>
  <div className="flex items-center gap-8">
    <a className="text-sm btn-ghost" href="#">Features</a>
    <a className="text-sm btn-ghost" href="#">Pricing</a>
    <button className="btn-primary text-sm px-5 py-2">Sign in</button>
  </div>
</nav>
```

### Stat / KPI (hero band)
```tsx
<div className="text-center">
  <p className="text-5xl font-bold mb-1 text-gradient" style={{ letterSpacing: "-0.04em" }}>
    1,200+
  </p>
  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Leases signed</p>
</div>
```

### Section with Eyebrow
```tsx
<div className="text-center mb-20" data-animate="fade-up">
  <p className="text-xs font-semibold uppercase tracking-[0.12em] mb-4" style={{ color: "var(--text-muted)" }}>
    Everything included
  </p>
  <h2 className="text-6xl font-bold text-gradient" style={{ letterSpacing: "-0.04em" }}>
    One contract.<br />Zero chaos.
  </h2>
</div>
```

---

## Layout Principles

- **Black always.** Background is `#000000`. No white sections, no light-mode alternation
- **Section rhythm:** `section-void` → `section-raised` → `section-void` — only slight lift, never light
- **Vertical padding:** `py-32` minimum. `py-40` for hero. Void is structure
- **Max widths:** hero copy `max-w-4xl`, feature grids `max-w-6xl`, full-bleed visuals `max-w-none`
- **Grid:** 1-col mobile → 2-col tablet → 3-col desktop for feature cards
- **Scroll animations:** all non-hero content uses `data-animate="fade-up"` — enters on scroll
- **No sidebars** on marketing pages
- **Noise grain overlay** at 3% opacity on hero — prevents flat black looking cheap

---

## Stitch Screens (reference)

| Screen | ID |
|--------|----|
| Dashboard Desktop | `screens/dff87c0a90e94ac0a7f21c38a4374b3d` |
| Dashboard Mobile | `screens/5cab5f4f2c914f3cbf4cac5cac791251` |
| Contracts | `screens/4c4de9254d01436b84cdc1374473d778` |
| Properties | `screens/3e666259422e4335b438df46b5112666` |
| Contract Builder Step 1 | `screens/921f5ab95a044c72ba39bd3d054b529f` |
| Contract Builder Finalize | `screens/0947fb2c244d4893b26170a24ea20e77` |

Project: `14096212677773735696` — "Minimalist Landlord Dashboard"
