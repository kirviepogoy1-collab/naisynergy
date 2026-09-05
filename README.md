# NAI Synergy — Combined HR Management + Inventory System

A single web application that merges your two separate PHP systems (HRMS +
NAI Inventory) into one React + Express + MySQL app, with 4 user roles:

- **superadmin** — full access to everything below, plus user/role management
- **hr_staff** — HR module (employees, documents, leave approvals)
- **inventory_staff** — Inventory module (rooms, assets, personnel)
- **employee** — self-service (profile, documents, apply for leave)

Tech stack: **React + Tailwind CSS** (frontend), **Express.js** (backend),
**Postgres via Neon** (database).

> This version was converted from an original MySQL/mysql2 backend. The
> route files themselves barely changed — see "Notes on the MySQL → Neon
> conversion" near the bottom of this README for what actually moved.

```
nai-synergy/
├── backend/     Express API + Postgres schema (Neon)
└── frontend/    React (Vite) + Tailwind CSS
```

---

## 1. Prerequisites

- [Node.js](https://nodejs.org) v18 or later (includes npm)
- A free [Neon](https://neon.tech) account/project (this replaces
  needing MySQL/XAMPP/Laragon installed locally — the database is hosted)

Check versions:
```bash
node -v
npm -v
```

---

## 2. Set up the database

1. Create a project at [neon.tech](https://neon.tech) (or use an
   existing one).
2. Open **SQL Editor** in the Neon console → New query, paste the
   contents of `backend/database/schema.sql`, and run it. Then do the same
   with `backend/database/seed.sql`.
   (Or, if you prefer the CLI and have `psql` installed, see step 3 for
   where to get your connection string, then run:
   ```bash
   psql "$DATABASE_URL" -f backend/database/schema.sql
   psql "$DATABASE_URL" -f backend/database/seed.sql
   ```
   )


## 3. Run the backend (Express API)

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set `DATABASE_URL` to your Neon connection string:
Neon console → **project → Connection Details** (or **Dashboard →
Connection string**). It looks like:
```
postgresql://YOUR_USER:YOUR_PASSWORD@YOUR_PROJECT.neon.tech/neondb?sslmode=require
```

```bash
npm start
```

The API runs at **http://localhost:5000**. You should see:
`NAI Synergy API running on http://localhost:5000`

(Use `npm run dev` instead if you want auto-restart on file changes — it
uses `nodemon`, already listed in `devDependencies`.)

---

## 4. Run the frontend (React)

Open a **second terminal**:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The app runs at **http://localhost:5173**. Open that in your browser and
log in with any of the seeded accounts above.

---

## 5. Building for production

```bash
cd frontend
npm run build
```

This outputs static files to `frontend/dist/` — serve them with any static
host (Nginx, Apache, Vercel, etc.), pointing `VITE_API_URL` at your deployed
backend. The backend (`backend/`) can run standalone behind PM2, a systemd
service, or similar on your server.

---

## What was carried over from your original systems

This is a from-scratch React/Express rebuild of the *logic* in your PHP
codebases, not a line-by-line port — the two systems used incompatible
tech (PHP/PDO/mysqli, session-based auth) so everything was translated to
JWT-based auth + a REST API + React components. Business rules that were
preserved:

- Login flow (no public self-registration — HR creates each employee's
  account directly, since an employee only gets a login after they've
  already been hired)
- Employee hiring workflow: HR creates the account (name, username, email,
  temp password, employee number) → employee logs in and uploads documents
  → HR review (Approve / Reject / N/A) → "Cancel Hired" if needed later
- Leave system: school-year boundary (June 1 – May 31), automatic yearly
  balance reset, per-type quotas, half-day (AM/PM) support, HR
  approve/reject
- Inventory navigation matches the original: **Buildings → Rooms → Room
  inventory**, for the 4 fixed areas (Memorial Building, Sussana Building,
  Edna & Edgar Building, NAI Offices). Each room page supports:
  - Add/edit/delete an item, with an **"apply to all rooms"** option that
    mirrors the old behavior exactly (blocks duplicate asset codes per
    room; edits/deletes can optionally cascade to every room sharing that
    asset code)
  - **Generate Items** — bulk-seeds a room with a zero-count row for every
    asset code used anywhere else, so a new room starts with the same
    checklist
  - An assigned-personnel panel scoped to that room (matched by area =
    room code, same as the original)
- **Asset Summary** (grouped by asset name, school-wide) with a drilldown
  to see which specific rooms have a given asset
- **Purchase Records** ledger — separate from room inventory — with
  receipt upload (image/PDF, 5MB cap), this month/this year/biggest
  purchase/top supplier/top category stats, and CSV export
- Inventory dashboard: condition/value totals by building, plus a
  keyword + condition search across all assets with pagination

**Not carried over:** the `teacher_schedule`, `teachers`, and `sections`
tables referenced in your old inventory database looked unrelated to either
the HR or Inventory feature set (they look like leftovers from a separate
scheduling app sharing the same DB), so they were left out of this combined
system. Let me know if you actually need that data here and I can add it.

## Notes on the MySQL → Neon (Postgres) conversion

The route files (`backend/routes/*.js`) are almost identical to the MySQL
version — they still call `pool.query(sql, params)` with `?` placeholders.
That's on purpose: `backend/config/db.js` was rewritten as a small
compatibility layer over the `pg` driver that:

- Converts `?` placeholders to Postgres's `$1, $2, ...` style automatically
- Auto-appends `RETURNING id` to plain `INSERT` statements, so
  `result.insertId` (used throughout the routes) keeps working
- Maps Postgres's `rowCount` to `result.affectedRows`, for the same reason
- Returns `DATE`/`TIMESTAMP` columns as plain strings instead of JS `Date`
  objects, matching the old `dateStrings: true` mysql2 setting the frontend
  already expects

A handful of queries used MySQL-only syntax and were rewritten directly
(not shimmed, since there's no clean equivalent):

- `IFNULL(...)` → `COALESCE(...)` (`routes/leaves.js`)
- `MONTH()`, `YEAR()`, `CURDATE()` → `EXTRACT(... FROM ...)`,
  `CURRENT_DATE` (`routes/records.js`, monthly/yearly purchase stats)
- `LIKE` → `ILIKE` on search filters (`routes/inventory.js`,
  `routes/records.js`, `routes/users.js`) — MySQL's default collation is
  case-insensitive, Postgres's `LIKE` is case-sensitive, so `ILIKE`
  preserves the original search behavior

Schema differences (`backend/database/schema.sql`):

- `AUTO_INCREMENT` → `SERIAL`
- `ENUM(...)` columns → `VARCHAR` + `CHECK (... IN (...))` (same
  constraint, easier to extend later without `ALTER TYPE`)
- `DATETIME` → `TIMESTAMP`, `TINYINT(1)` → `SMALLINT` (kept the existing
  0/1 convention instead of switching to `BOOLEAN`, so no application code
  had to change)
- The generated `total` column on `inventory` uses the same
  `GENERATED ALWAYS AS (...) STORED` syntax — Postgres supports it too

**Not changed:** file uploads (documents, profile pictures, receipts)
still write to local disk under `backend/uploads/` via `multer`, same as
before — cloud object storage wasn't part of this request. If you deploy
the backend somewhere with an ephemeral filesystem (e.g. most serverless
platforms), you'll want to swap that for Cloudinary/S3 at some point,
since uploaded files won't survive a redeploy there. (Note: this repo
already migrates most upload types to Cloudinary elsewhere — see
`backend/utils/cloudinaryFile.js` — this note is about anything still
falling back to local disk.)

---

## Extending this further

The codebase is organized so each concern is its own file — new HR or
inventory features are new routes (`backend/routes/`) + new pages
(`frontend/src/pages/`). If you want a specific screen from either legacy
app rebuilt pixel-for-pixel (e.g. one of the per-building room viewers),
just point me to it and I'll add it as its own page/route.
