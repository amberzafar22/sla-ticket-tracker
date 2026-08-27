# Support Ticket & SLA Tracker

A full-stack support ticket tracker with SLA deadline calculation, built as a take-home assignment. Users create and comment on tickets; agents assign, manage, and resolve them; SLA state (green On Track / orange At Risk / red Breached) is computed live from business-hours deadlines.

## Tech Stack

**Backend:** Node.js, TypeScript (strict mode), GraphQL Yoga (schema-first), Prisma ORM, PostgreSQL, Docker Compose, Vitest (integration tests)
**Frontend:** React + TypeScript (Vite), graphql-request, React Router

## Architecture

```
sla-ticket-tracker/
+-- docker-compose.yml          # PostgreSQL container
+-- backend/
|   +-- prisma/
|   |   +-- schema.prisma       # User, Ticket, Comment models
|   |   +-- migrations/
|   +-- src/
|       +-- schema/schema.graphql   # Schema-first GraphQL definition
|       +-- resolvers.ts            # All resolver logic, business rules, SLA calc
|       +-- resolvers.test.ts       # Integration tests (real Postgres)
|       +-- server.ts               # GraphQL Yoga server entrypoint
|       +-- lib/
|           +-- prisma.ts       # Prisma Client singleton
|           +-- auth.ts         # bcrypt hashing + JWT sign/verify
+-- frontend/
    +-- src/
        +-- api/         # Typed GraphQL client functions
        +-- context/     # Auth context (React state)
        +-- pages/       # Login, Signup, Ticket List, Ticket Detail, Create Ticket
        +-- components/  # SlaBadge, etc.
```

**Design choices:**
- Two-model core (Ticket, Comment) plus User, kept intentionally minimal per the assignment's "don't over-engineer" guidance. No separate SLA-policy table, audit-log table, or notification system, since none were required.
- JWT + bcrypt auth, not OAuth, as the simplest secure option for the scope.
- graphql-request instead of Apollo Client on the frontend, since a full-featured cache/state library wasn't needed for this scope.
- Role is fixed at signup to USER; promoting a user to AGENT is done directly in the database (e.g. via Prisma Studio). There is no self-service "become an agent" flow or admin panel, since building one wasn't in scope.

## Setup

### Prerequisites
- Node.js 20+
- Docker Desktop

### 1. Start PostgreSQL

```powershell
docker compose up -d
```

### 2. Backend

```powershell
cd backend
npm install
npx prisma migrate dev
npm run dev
```

Server runs at http://localhost:4000/graphql

Create a `backend/.env` file (if not already present):

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sla_tracker?schema=public"
JWT_SECRET="replace-with-any-random-string"
```

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev
```

App runs at http://localhost:5173

### 4. Running tests

```powershell
cd backend
npm test
```

Runs integration tests against a real PostgreSQL database.

### Creating an agent account

All signups default to role USER. To test agent-only features (assignment, status changes), promote a user manually:

```powershell
cd backend
npx prisma studio
```

Open http://localhost:5555, open the User table, change a row's `role` field to `AGENT`, save. The user must log out and log back in afterward, since their JWT carries the role from the time of login.

## Business Rules

- **Roles:** USER can create tickets and comment. AGENT can additionally assign tickets and change ticket status.
- **Assignment:** Tickets can only be assigned to users with the AGENT role. Assigning an OPEN ticket automatically moves it to IN_PROGRESS.
- **First response tracking:** `firstResponseAt` is set automatically the first time an agent (not the customer) comments on a ticket.
- **Status transitions:** Moving a ticket to RESOLVED or CLOSED stamps `resolvedAt`. Moving it back to an open state clears `resolvedAt`.
- **SLA deadline calculation:** Computed at ticket creation using business hours only (Monday-Friday, 9:00 AM-5:00 PM). If a ticket is created outside business hours or on a weekend, the SLA window starts at the next business-hours opening.
  - SLA windows by priority: URGENT = 2 hours, HIGH = 4 hours, MEDIUM = 8 hours, LOW = 24 hours (all business hours, not wall-clock hours).
- **SLA state:**
  - **On Track:** more than 20% of the SLA window remains, or the ticket is already RESOLVED/CLOSED (resolved tickets are never shown as at-risk or breached, regardless of when they were resolved).
  - **At Risk:** 20% or less of the SLA window remains, and the deadline hasn't passed yet.
  - **Breached:** the current time is past the SLA deadline and the ticket is still open.
- **Validation:** Server-side checks reject empty titles/descriptions, short passwords (under 8 chars), invalid emails, duplicate signups, and empty comments, each with a specific GraphQL error message.

## GraphQL API

Schema-first definition at `backend/src/schema/schema.graphql`. Key operations:

- `signup` / `login` - returns `{ token, user }`
- `me` - current authenticated user (requires `Authorization: Bearer <token>` header)
- `tickets(status, priority, page, pageSize)` - paginated, filterable ticket list
- `ticket(id)` - single ticket with comments
- `createTicket`, `addComment` - any authenticated user
- `assignTicket`, `updateTicketStatus` - agents only

Explore the schema interactively at http://localhost:4000/graphql (GraphQL Yoga's built-in playground) once the backend is running.

## Testing

14 integration tests run against a real PostgreSQL database (no mocking), covering:
- Business-hours SLA deadline calculation (same-day, next-day rollover, weekend skip)
- Signup/login (success and rejection paths)
- Ticket creation with correct SLA deadline per priority
- Authentication and agent-only permission enforcement
- First-response tracking (customer comments don't count; agent comments do)

Run with `npm test` from `backend/`.

## Known Limitations

- No password reset / email verification flow (out of scope for this assignment).
- No pagination on the comments list within a ticket (comment volume per ticket is expected to be low for this scope).
- Agent role assignment has no admin UI; done via direct database access, as noted above.
