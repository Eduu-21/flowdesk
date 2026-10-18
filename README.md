# FlowDesk

A business management and appointment platform for beauty and wellness studios: salons, nail and lash studios, spas, braiding studios and barbers.

FlowDesk gives a studio owner one calm place to run the day: see today's appointments, book customers in a guided wizard, manage services, staff and working hours, take payments, and watch the numbers in analytics. Staff members get their own limited view of their schedule.

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, Recharts
- **Backend:** Node.js, Express, TypeScript, Zod validation, JWT authentication (bcrypt password hashing)
- **Database:** PostgreSQL (plain SQL schema and seed, no ORM, no Docker)


## Dashboard Preview

![FlowDesk dashboard](screenshots/dashboard.png)

---

## What you can do in it

| Area | Features |
| --- | --- |
| **Authentication** | Register (creates a new studio), log in, "remember me", log out, forgot and reset password, change password, sign out of all devices, session-expiry handling |
| **Dashboard** | Today's flow timeline with open (available) hours, summary figures, smart insights, quick actions |
| **Calendar** | Day, week and month views, staff filter, show or hide cancelled, click an empty slot to book, click an appointment for a quick view |
| **Appointments** | Search, filter by status, payment, staff and dates, sort, pagination; create with a 7-step booking wizard; edit, reschedule, change status, cancel, delete; record payments (cash, bank transfer, Telebirr, card); history timeline |
| **Customers** | Search, status filter, "not seen in 30 days" filter, sort, pagination; add, edit, delete; profile with history, next appointment, notes and activity |
| **Services** | Grouped by category; search and filters; add, edit, activate or deactivate, delete |
| **Staff** | Team cards; add, edit, deactivate; specialties; weekly availability editor; time off; optional staff login |
| **Analytics** | Revenue (daily, weekly, monthly), appointment statuses, popular services, staff performance, new vs returning vs inactive customers, payments and outstanding balance |
| **Notifications** | Bell menu and full page; unread filter; mark one or all as read; automatic appointment reminders |
| **Settings** | Profile with photo, business details, notification preferences, security |
| **Flow Assistant** | Ask about today, revenue, free slots or customers. Works out of the box; optionally powered by Claude |
| **Global search** | Customers, appointments and services from the top bar |
| **Roles** | **Admin** sees everything. **Staff** sees only their own appointments and the customers they have served, with no revenue or analytics |

---

## Requirements

- [Node.js](https://nodejs.org) **20 or newer** (22 recommended). Check with `node -v`.
- [PostgreSQL](https://www.postgresql.org/download/windows/) **14 or newer**. During installation remember the password you give the `postgres` user.
- [Git](https://git-scm.com/download/win) (optional, for version control)
- VS Code (optional)

---

## Setup on Windows 11 (VS Code)

Open the project folder in VS Code, then open a terminal (**Terminal > New Terminal**, PowerShell is fine) and run these commands from the project root (the folder containing this README).

### 1. Install dependencies

```powershell
npm run install:all
```

This installs the root, `server` and `client` packages.

### 2. Create your environment file

```powershell
copy .env.example .env
```

Open `.env` and set the two required values:

1. `DATABASE_URL` replace `YOUR_PASSWORD` with your PostgreSQL `postgres` password, for example
   `postgresql://postgres:MyPassword@localhost:5432/flowdesk`
2. `JWT_SECRET` generate one and paste it in:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

Everything else in `.env` is optional (see the table below).

### 3. Create the database and demo data

Make sure PostgreSQL is running (it starts automatically after installation), then:

```powershell
npm run db:setup
```

This creates the `flowdesk` database if it does not exist, builds all tables and loads demo data (a studio, five staff, twelve services, eighteen customers and about 600 appointments around today's date).

> Re-running `npm run db:setup` (or `npm run db:reset`) wipes and recreates the data. The command refuses to run when `NODE_ENV=production` unless you add `-- --force`.

### 4. Start the app

```powershell
npm run dev
```

- App: <http://localhost:5173>
- API: <http://localhost:4000/api/health>

### 5. Sign in

| Role | Email | Password |
| --- | --- | --- |
| Admin (studio owner) | `demo@flowdesk.local` | `DemoPassword123!` |
| Staff (Marta Haile) | `marta@flowdesk.local` | `DemoPassword123!` |

The login page also has a **Fill in the demo account** button.

---

## Environment variables

All variables live in the single `.env` file in the project root. `.env.example` documents each one.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | **Yes** | none | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | none | Secret used to sign login tokens (use a long random string) |
| `PORT` | No | `4000` | API port |
| `CLIENT_URL` | No | `http://localhost:5173` | Allowed CORS origin and base for links in emails |
| `JWT_EXPIRES_IN` | No | `1d` | Login lifetime |
| `JWT_REMEMBER_EXPIRES_IN` | No | `30d` | Login lifetime when "Remember me" is ticked |
| `NODE_ENV` | No | `development` | `development`, `production` or `test` |
| `EMAIL_API_KEY` | No | empty | [Resend](https://resend.com) API key. Empty means emails are printed in the server console |
| `EMAIL_FROM` | No | `FlowDesk <onboarding@resend.dev>` | Sender address for emails |
| `ANTHROPIC_API_KEY` | No | empty | Enables the Claude-powered Flow Assistant. Empty means the built-in assistant is used |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-5` | Model used when the key above is set |

### Which features need an API key?

Nothing needs a key to run locally.

- **Real emails** (password reset, notification emails): add a Resend key as `EMAIL_API_KEY`. Without it, FlowDesk logs each email to the server console, and in development the "Forgot password" page shows the reset link directly so you can still complete the flow.
- **Claude-powered Flow Assistant**: add `ANTHROPIC_API_KEY`. Without it the assistant answers from your own data using built-in intents (today's schedule, revenue, free slots, lapsed customers, popular services, and so on).

---

## Testing

```powershell
npm test            # server and client tests
npm run test --prefix server
npm run test --prefix client
npm run lint
```

- **Server** (Vitest + Supertest): authentication, role scoping, validation, booking conflict prevention, working hours, payments, password reset, notifications and the assistant.
- **Client** (Vitest + Testing Library): date and money helpers, calendar layout, form schemas, form validation behaviour and core UI components.

The server tests run against the database in `DATABASE_URL` and create their own records. Run `npm run db:reset` afterwards if you want a pristine demo dataset.

---

## Production build

```powershell
npm run build
$env:NODE_ENV = "production"
npm start --prefix server
```

In production the API also serves the built React app from `client/dist`, so everything is available on `http://localhost:4000`. Set a strong `JWT_SECRET`, a real `CLIENT_URL` and your email key.

---

## Project structure

```
flowdesk/
├── .env.example            Documented environment variables
├── package.json            Root scripts (install:all, dev, db:setup, test, build)
├── database/
│   ├── schema.sql          Tables, constraints and indexes
│   └── seed.sql            Demo studio, staff, services, customers, appointments
├── server/
│   ├── src/
│   │   ├── app.ts, server.ts, config.ts
│   │   ├── db/             Connection pool and setup script
│   │   ├── middleware/     Auth, role checks, error handling
│   │   ├── routes/         All /api routes in one table
│   │   ├── controllers/    Parse and validate requests
│   │   ├── services/       Business logic and SQL
│   │   ├── schemas/        Zod request schemas
│   │   └── utils/          Dates, time slots, errors
│   └── tests/              API and unit tests
└── client/
    └── src/
        ├── pages/          One file per screen
        ├── components/     UI kit, modals, shared pieces
        ├── layouts/        App shell, search, notifications, profile menu
        ├── hooks/          Data hooks (TanStack Query)
        ├── context/        Auth and toast providers
        ├── lib/            API client, dates, formatting
        ├── schemas/        Form validation (Zod)
        └── types/          Shared API types
```

---

## API overview

All routes are under `/api`. Everything except the public routes needs `Authorization: Bearer <token>`. Errors are returned as `{ "error": { "message", "code", "fields" } }`.

| Area | Routes |
| --- | --- |
| Public | `GET /health`, `POST /auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/logout` |
| Account | `GET /auth/me`, `GET /auth/session`, `PUT /auth/password`, `POST /auth/logout-all` |
| Settings | `GET` and `PUT /settings/studio` (PUT admin only), `PUT /settings/profile`, `PUT /settings/notifications` |
| Dashboard and search | `GET /dashboard`, `GET /search?q=` |
| Customers | `GET`, `POST` `/customers`; `GET`, `PUT`, `DELETE` `/customers/:id`; `POST /customers/:id/notes`; `DELETE /customers/:id/notes/:noteId` |
| Services | `GET /services`, `GET /services/categories`; `POST`, `PUT /:id`, `PATCH /:id/active`, `DELETE /:id` (admin) |
| Staff | `GET`, `POST` `/staff`; `GET`, `PUT` `/staff/:id`; `PUT /staff/:id/availability`; `POST /staff/:id/time-off`; `DELETE /staff/:id/time-off/:timeOffId` |
| Appointments | `GET /appointments`, `GET /appointments/availability`, `POST`, `GET`, `PUT`, `DELETE` `/appointments/:id`, `PUT /appointments/:id/payment` |
| Payments and analytics | `GET /payments`, `GET /analytics?range=7\|30\|90` (admin) |
| Notifications | `GET /notifications`, `PUT /notifications/read-all`, `PUT /notifications/:id/read` |
| Assistant | `GET /assistant/suggestions`, `POST /assistant` (admin) |

Double-booking is prevented on the server: bookings are checked against existing appointments, the staff member's working hours and their time off, inside a locked transaction.

---

## Git basics

```powershell
git init
git add .
git commit -m "Initial commit: FlowDesk"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/flowdesk.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `.env`, `dist`, `build` and `coverage`, so your secrets and build output stay out of the repository.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `password authentication failed for user "postgres"` | The password in `DATABASE_URL` is wrong. Update `.env` |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running. Start the "postgresql" service from Windows Services |
| `JWT_SECRET` or `DATABASE_URL` error at startup | Copy `.env.example` to `.env` and fill both required values |
| Port 4000 or 5173 already in use | Change `PORT` in `.env`, or stop the other program. If you change `PORT`, also update the proxy target in `client/vite.config.ts` |
| Login says the server cannot be reached | The API is not running. Start both with `npm run dev` |
| Want fresh demo data | `npm run db:reset` |
