# PrimeWave Resource Reservation System

A web application for booking shared resources (meeting rooms, equipment and vehicles) without double-bookings.

The organisation in the assessment brief coordinated bookings through informal messages and manual records, which led to overlapping reservations and uncertainty about what was free. This app gives everyone one place to:

- see what resources exist and whether they are free right now;
- check a resource's availability for any day;
- book a free slot, with double-bookings blocked by the database itself;
- view and cancel their own bookings.

Admins also manage the list of resources and can see and cancel every booking.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions, Cache Components) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM and migrations | Drizzle ORM and drizzle-kit |
| Styling | Tailwind CSS 4 |
| Authentication | Email and password (bcrypt hashes) with sessions stored in the database |

## Getting started

### Prerequisites

- Node.js 20 or later (developed on Node 24)
- PostgreSQL 14 or later, running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create a database and configure the connection

Create an empty database, for example:

```bash
createdb reservations_db
```

Copy `.env.example` to `.env` and set your connection string:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/reservations_db"
```

### 3. Create the tables

```bash
npm run db:migrate
```

This runs the SQL migrations in [`drizzle/`](drizzle/). The second migration enables the `btree_gist` extension, so the database user needs permission to create extensions. The database owner normally has this permission; if not, run `CREATE EXTENSION btree_gist;` once as a superuser.

### 4. Load sample data

```bash
npm run db:seed
```

This **clears** the users, resources and reservations tables, then adds three users, four resources and five bookings dated around today.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with one of the demo accounts.

### Demo accounts

| Email | Password | Role |
| --- | --- | --- |
| admin@primewave.lk | admin123 | Admin |
| nimal@primewave.lk | nimal123 | Member |
| kamala@primewave.lk | kamala123 | Member |

### Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Reset the sample data |
| `npm run db:generate` | Create a new migration after changing `db/schema.ts` |
| `npm run db:studio` | Browse the database in Drizzle Studio |

## Features

### For everyone

- **Dashboard (`/`):** how many resources are free right now, today's bookings across all resources, and your next bookings.
- **Resources (`/resources`):** every bookable resource with its type, location, capacity and a live "Available now" or "In use until …" status. You can search by name or location and filter by type.
- **Availability (`/resources/[id]`):** a day view for one resource with a timeline, the free slots between 08:00 and 18:00, and the existing bookings. You can move between days or pick a date.
- **Booking:** a form on the availability page. Each free slot has a **Book** link that fills the form in. Bookings can run past 18:00 or over several days; the 08:00–18:00 window only affects which free slots are suggested.
- **My reservations (`/reservations`):** your upcoming, past and cancelled bookings.
- **Cancelling:** you can cancel your own bookings until they end.

### For admins

- **Manage resources (`/admin/resources`):** add, edit, deactivate and reactivate resources. The list shows how many upcoming bookings each resource has.
- **All reservations (`/admin/reservations`):** every booking, filterable by status, resource, person and date. Admins can cancel any booking that has not ended.

## Design decisions

### Double-bookings are prevented in the database

Checking for overlaps in application code ("is anything booked at this time? If not, insert") leaves a gap: two people submitting at the same moment can both pass the check. Instead, a PostgreSQL exclusion constraint rejects any confirmed booking that overlaps another confirmed booking for the same resource:

```sql
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_time, end_time, '[)') WITH &&
) WHERE (status = 'confirmed');
```

- `'[)'` makes the end time exclusive, so a 09:00–10:00 booking and a 10:00–11:00 booking can sit back to back.
- Only `confirmed` bookings count, so cancelling a booking frees its slot straight away.
- When the constraint rejects a booking, the server action catches the error (`23P01`) and tells the user which booking is in the way.

See [`drizzle/0001_no_overlapping_reservations.sql`](drizzle/0001_no_overlapping_reservations.sql).

### Other rules enforced by the database

- A booking's end time must be after its start time (`end_after_start`).
- A resource's capacity, if set, must be positive (`capacity_positive`).
- Resource names and user emails must be unique.

The server actions check the same rules first so users get friendly messages. The constraints are a safety net if the app is ever bypassed.

### Nothing is deleted

- **Cancelling** a booking changes its status to `cancelled` and keeps the record, so booking history is preserved.
- **Deactivating** a resource hides it from members and stops new bookings, without breaking existing bookings that refer to it.

### Sessions are stored in the database

Logging in creates a random 256-bit session ID. It is kept in the `sessions` table and sent to the browser as an `httpOnly`, `sameSite=lax` cookie that expires after 7 days. Logging out deletes the row, so a session can be ended immediately on the server. Passwords are stored only as bcrypt hashes.

### Authorisation is checked on the server

Every page and server action looks up the current user on the server (`getCurrentUser` and `requireAdmin` in [`lib/session.ts`](lib/session.ts)). Hidden buttons are a convenience, not the protection: a member who sends an admin request directly is redirected and nothing changes. A member can only cancel their own bookings.

### Rendering approach

Pages are React Server Components that query the database directly with Drizzle. There is no separate API layer. Changes go through Server Actions, and filters such as search, type, date and status are kept in the URL, so filtered views can be bookmarked or shared. The project uses Next.js Cache Components, so personalised content is streamed inside `<Suspense>` boundaries.

### Times

Times are stored as `timestamptz`, which is unambiguous. They are shown in the server's local time zone, which is fine for a single-site organisation running the app locally in Sri Lanka. A multi-time-zone deployment would need an explicit organisation time zone.

## Database design

The full ER diagram is in [`docs/er-diagram.drawio`](docs/er-diagram.drawio). Open it with [diagrams.net](https://app.diagrams.net) or the VS Code Draw.io extension. A summary:

```mermaid
erDiagram
    users ||--o{ reservations : makes
    resources ||--o{ reservations : "is booked in"
    users ||--o{ sessions : has

    users {
        serial id PK
        text name
        text email UK
        text password_hash
        user_role role "admin | member"
        timestamptz created_at
    }
    resources {
        serial id PK
        text name UK
        text type
        text location "optional"
        integer capacity "optional, > 0"
        text description "optional"
        boolean is_active
        timestamptz created_at
    }
    reservations {
        serial id PK
        integer resource_id FK
        integer user_id FK
        text title
        timestamptz start_time
        timestamptz end_time "after start_time"
        reservation_status status "confirmed | cancelled"
        timestamptz created_at
    }
    sessions {
        text id PK
        integer user_id FK
        timestamptz expires_at
    }
```

- **users:** people who can log in. `role` decides whether they get the admin pages.
- **resources:** things that can be booked. `type` is free text (for example Meeting Room, Equipment or Vehicle), so new kinds of resource need no code changes.
- **reservations:** a booking of one resource by one user for a time range. Indexed on `user_id` and `start_time`. The exclusion constraint above (backed by a GiST index) both prevents overlaps and speeds up queries by resource and time.
- **sessions:** active logins. Deleted automatically when their user is deleted.

The schema is defined in [`db/schema.ts`](db/schema.ts), and the generated SQL is in [`drizzle/`](drizzle/).

## Project structure

```
app/
  page.tsx                    Dashboard
  login/                      Login page and form
  resources/                  Resource list; [id]/ = availability and booking form
  reservations/               My reservations
  admin/resources/            Manage resources (list, new, [id]/edit)
  admin/reservations/         All reservations
  actions/                    Server Actions: auth, reservations, resources
components/                   Site header, navigation, cancel button
db/                           Drizzle schema, connection and seed script
drizzle/                      SQL migrations
lib/                          Sessions and access checks, date formatting, database error helpers
```

## Possible improvements

- Editing a booking's time. At the moment you cancel and rebook.
- Self-service sign-up and password reset. Accounts currently come from the seed script.
- Email reminders and notifications for bookings.
- Recurring bookings, such as a weekly team meeting.
- Configurable opening hours per resource, and an organisation-wide time zone setting.
- Automated tests for the server actions and the overlap constraint.
