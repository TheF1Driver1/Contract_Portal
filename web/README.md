# ContractOS — Landlord Contract Manager

Modern web app for generating, signing, and sending rental contracts. Built on Next.js 14, Supabase, and docxtemplater. Replaces the existing Streamlit Python app with a full web interface.

---

## How It Works

```
Landlord logs in
    → adds Properties + Tenants
    → opens Contract Builder (5-step form)
    → fills lease dates, payment terms, amenities
    → draws digital signatures (canvas)
    → downloads DOCX (generated from Word template)
    → sends via Email (Resend) and/or SMS (Twilio)
    → Dashboard shows active leases, expiring alerts, revenue
```

**Document generation:** The existing `CONTRATO_SABANA_GARDENS_prueba.docx` Word template uses `{{ variable }}` placeholders. The app fills them using `docxtemplater` (JavaScript port of `docxtpl`). Same variables, same template — just runs in the browser/server instead of Streamlit.

---

## Prerequisites

- Node.js 18+
- A Supabase account (free) → [supabase.com](https://supabase.com)
- Optional: Resend account for email → [resend.com](https://resend.com)
- Optional: Twilio account for SMS → [twilio.com](https://twilio.com)
- Optional: Vercel account for hosting → [vercel.com](https://vercel.com)

---

## Step 1 — Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Pick a name (e.g. `contract-portal`), set a strong DB password, choose a region
3. Wait ~2 minutes for project to spin up
4. Go to **SQL Editor** (left sidebar)
5. Paste the entire contents of `supabase/schema.sql` and click **Run**

   This creates:
   - `profiles` table (auto-populated on signup)
   - `properties` table
   - `tenants` table
   - `contracts` table
   - Row Level Security policies (each user only sees their own data)
   - Auto-update triggers

6. Go to **Project Settings → API**
7. Copy these two values — you'll need them in Step 3:
   - **Project URL** (looks like `https://xyzxyz.supabase.co`)
   - **anon public** key (long JWT string)

---

## Step 2 — Install Dependencies

```bash
cd Contract_Portal/web
npm install
```

---

## Step 3 — Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```env
# Required — from Supabase Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Optional — for email delivery (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=contracts@yourdomain.com

# Optional — for SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+17875550100

# App URL (change to your Vercel URL in production)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**To get Resend API key:**
1. Sign up at resend.com → API Keys → Create API Key
2. Add and verify your sending domain (or use their test domain for dev)

**To get Twilio credentials:**
1. Sign up at twilio.com → Console Dashboard
2. Copy Account SID and Auth Token
3. Get a phone number: Phone Numbers → Manage → Buy a Number

---

## Step 4 — Add Your Contract Template

The Word template (`templates/contract_template.docx`) is already copied from the original Python app.

**If you want to use a different template:**
1. Open your `.docx` in Word
2. Replace any static text with `{{variable_name}}` placeholders
3. Save it as `templates/contract_template.docx`

**Supported variables (same as original Python app):**

| Variable | Description |
|---|---|
| `{{dia}}` `{{mes}}` `{{anio}}` | Today's date |
| `{{nombre_arrendatario}}` | Tenant full name |
| `{{seguro_social}}` | SSN last 4 (formatted xxx-xx-XXXX) |
| `{{numero_licencia}}` | Driver's license number |
| `{{residencia_actual}}` | Tenant's current address |
| `{{cantidad_cuartos}}` | Number of bedrooms |
| `{{tiene_puertas_de_espejo}}` | Mirror closet doors (✔ or blank) |
| `{{cantidad_abanicos_techo}}` | Ceiling fans count |
| `{{tiene_bano_remodelado}}` | Renovated bathroom (✔ or blank) |
| `{{cantidad_estufas}}` | Stoves count |
| `{{tiene_microondas}}` | Microwave (✔ or blank) |
| `{{tiene_nevera}}` | Refrigerator (✔ or blank) |
| `{{tiene_aire_acondicionado}}` | A/C (✔ or blank) |
| `{{cantidad_stools}}` | Bar stools count |
| `{{tiene_cortinas_miniblinds}}` | Mini blinds (✔ or blank) |
| `{{tiene_sofa}}` | Sofa (✔ or blank) |
| `{{tiene_futton}}` | Futon (✔ or blank) |
| `{{tiene_cuadros}}` | Wall art (✔ or blank) |
| `{{incluye_estacionamiento}}` | Parking (✔ or blank) |
| `{{cantidad_personas}}` | Occupant count |
| `{{cantidad_de_anios_contrato}}` | Lease years |
| `{{cantidad_de_meses_contrato}}` | Lease months |
| `{{dia_comienzo_contrato}}` `{{mes_comienzo_contrato}}` `{{anio_comienzo_contrato}}` | Lease start date |
| `{{dia_que_culmina_contrato}}` `{{mes_que_culmina_contrato}}` `{{anio_que_culmina_contrato}}` | Lease end date |
| `{{canon_arrendamiento_numero}}` | Rent amount (number) |
| `{{canon_arrendamiento_verbal}}` | Rent amount (words) |
| `{{cantidad_pago_firma}}` | Amount paid at signing |
| `{{dia_pago_tarde}}` | Late fee day |
| `{{cantidad_llaves}}` | Key count |
| `{{firma_arrendador}}` | Landlord signature (placeholder line) |
| `{{firma_arrendatario}}` | Tenant signature (placeholder line) |

---

## Step 5 — Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**First time:**
1. Click **Sign up** → create your landlord account
2. Go to **Properties** → Add Property (e.g. "Sabana Gardens Apt 2")
3. Go to **Tenants** → Add Tenant (fill name, email, phone, license)
4. Go to **Contracts → New Contract** → complete the 5-step form
5. On step 4 (Signatures): draw both signatures on the canvas
6. Click **Download DOCX** → gets the filled Word document
7. On step 5 (Send): check Email and/or SMS → click Send

---

## Step 5b — Public Testing with ngrok

Use ngrok to share your local dev server publicly (e.g. test on phone, share with client).

### Prerequisites

```bash
brew install ngrok         # macOS
ngrok config add-authtoken <your-token>   # one-time setup (get token at ngrok.com)
```

### Every time you want to test publicly

**Terminal 1 — start the app:**
```bash
cd Contract_Portal/web
npm run dev
```

**Terminal 2 — start the tunnel:**
```bash
ngrok http 3000
```

ngrok prints a `Forwarding` URL like `https://abc123.ngrok-free.app`. Copy it.

**Update your env so internal links work:**

Open `web/.env.local` and set:
```env
NEXT_PUBLIC_APP_URL=https://abc123.ngrok-free.app
```

Then restart `npm run dev` (Ctrl+C → `npm run dev` again).

Share the ngrok URL. It stays live as long as both terminals are running.

> **Note:** Free ngrok URLs change every session. Update `NEXT_PUBLIC_APP_URL` each time.

---

## Step 6 — Deploy to Vercel (Free)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. Set **Root Directory** to `Contract_Portal/web`
4. Under **Environment Variables**, add all values from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `RESEND_API_KEY` (if using email)
   - `FROM_EMAIL` (if using email)
   - `TWILIO_ACCOUNT_SID` (if using SMS)
   - `TWILIO_AUTH_TOKEN` (if using SMS)
   - `TWILIO_PHONE_NUMBER` (if using SMS)
   - `NEXT_PUBLIC_APP_URL` → set to your Vercel URL (e.g. `https://contract-portal.vercel.app`)
5. Click **Deploy**

**After deploy:** Update `NEXT_PUBLIC_APP_URL` in Vercel env vars to your actual Vercel URL. Redeploy.

---

## App Pages Reference

| Route | What it does |
|---|---|
| `/login` | Sign in |
| `/signup` | Create account |
| `/dashboard` | Overview: active leases, revenue, expiring alerts |
| `/contracts` | List all contracts, filter by status, search |
| `/contracts/new` | 5-step contract builder |
| `/contracts/[id]` | Contract detail, download, delete |
| `/properties` | Manage properties |
| `/tenants` | Manage tenants |

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/api/contracts` | List all contracts |
| POST | `/api/contracts` | Create contract |
| GET | `/api/contracts/[id]` | Get one contract |
| PATCH | `/api/contracts/[id]` | Update contract |
| DELETE | `/api/contracts/[id]` | Delete contract |
| POST | `/api/generate` | Generate DOCX from template |
| POST | `/api/send` | Email + SMS delivery |

---

## Database Tables

```
profiles      → landlord info (auto-created on signup)
properties    → rental properties owned by landlord
tenants       → renter contact info
contracts     → lease data, payment terms, amenities, signatures, status
```

Contract status flow: `draft` → `sent` → `signed` → `expired`

---

## File Structure

```
web/
├── app/
│   ├── (auth)/login/           Login page
│   ├── (auth)/signup/          Signup page
│   ├── (dashboard)/
│   │   ├── layout.tsx          Sidebar + auth guard
│   │   ├── dashboard/          Main dashboard
│   │   ├── contracts/          Contract list
│   │   ├── contracts/new/      Contract builder
│   │   ├── contracts/[id]/     Contract detail
│   │   ├── properties/         Property management
│   │   └── tenants/            Tenant management
│   └── api/
│       ├── contracts/          CRUD routes
│       ├── generate/           DOCX generation
│       └── send/               Email + SMS
├── components/
│   ├── ContractBuilder.tsx     5-step form
│   ├── SignaturePad.tsx        Canvas signature capture
│   ├── Sidebar.tsx             Navigation
│   └── ui/                    shadcn components
├── lib/
│   ├── supabase.ts             Browser Supabase client
│   ├── supabase-server.ts      Server Supabase client
│   ├── types.ts                TypeScript types
│   └── utils.ts                Helper functions
├── middleware.ts               Auth redirect guard
├── supabase/schema.sql         Full DB schema
└── templates/
    └── contract_template.docx  Word template (copied from Python app)
```

---

## Troubleshooting

**"Template rendering failed"**
The `.docx` template has a variable name that doesn't match. Open the template in Word and check all `{{variable}}` names match the table above exactly.

**"Unauthorized" on API routes**
Not logged in or Supabase session expired. Sign out and back in.

**Email not sending**
- Check `RESEND_API_KEY` is set correctly
- Verify your sending domain in Resend dashboard
- Check Resend logs at resend.com/emails

**SMS not sending**
- Check all three `TWILIO_*` env vars are set
- Make sure your Twilio number is SMS-capable
- Free Twilio trial accounts can only send to verified numbers

**Supabase RLS blocking data**
Every table has Row Level Security. All queries filter by `owner_id = auth.uid()`. If you see empty data after creating records, check the user ID matches in the Supabase table editor.

**Download generates `.txt` instead of `.docx`**
Template file not found. Make sure `templates/contract_template.docx` exists in the `web/` directory.
