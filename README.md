# Email Scheduler

## 1. Project Overview

Email Scheduler is a full-stack application for composing and scheduling email campaigns. A signed-in user supplies a subject, message, start time, per-recipient delay, hourly limit, and recipients. The backend stores the campaign and individual email records in PostgreSQL, places delayed jobs in BullMQ backed by Redis, and sends messages through an Ethereal SMTP account.

The project separates the user interface from the scheduling service:

- **Frontend:** React, React Router, TanStack Query, Axios, and Vite.
- **Backend:** Express, Prisma, PostgreSQL, Redis, BullMQ, Nodemailer, Google OAuth, and Zod.
- **Queue flow:** The Express process starts the BullMQ worker. Scheduled jobs are stored in Redis and email state is stored in PostgreSQL.
- **Local infrastructure:** Docker Compose provides PostgreSQL and Redis.

## 2. Features

### Backend

- **Email scheduling:** `POST /api/emails/schedule` validates a campaign and creates one email record per normalized recipient. Each recipient receives a scheduled timestamp based on the campaign start time and delay.
- **Job persistence:** Campaigns and email records are persisted in PostgreSQL through Prisma. Each email is assigned a deterministic BullMQ job ID based on its database ID.
- **Redis integration:** Redis is used by BullMQ and by the sender/hour rate-limit counter.
- **BullMQ worker:** A worker for the `email-scheduler` queue is created when `backend/src/server.ts` imports the worker module. It processes jobs with configurable concurrency.
- **Rate limiting:** A Redis Lua script atomically increments a sender/hour counter, rolls the counter back when the limit is exceeded, and reschedules the email for the next UTC hour.
- **Concurrency control:** BullMQ worker concurrency is controlled by `WORKER_CONCURRENCY`, which defaults to `5`.
- **Authentication:** Google OAuth 2.0 is implemented with Passport. After successful OAuth, the backend stores the user in PostgreSQL and places the user ID in a `cookie-session` session.
- **Database persistence:** Prisma models store users, senders, campaigns, and individual emails, including status, attempts, timestamps, SMTP message ID, preview URL, and the last error.
- **Email sending:** Nodemailer sends through the configured Ethereal SMTP host, port, username, and password. Successful sends store the Ethereal preview URL when Nodemailer provides one.
- **Validation and error handling:** Zod validates scheduling requests and email addresses. The Express error middleware returns a `400` response for Zod validation errors and a generic `500` response for unexpected errors.
- **Retry behavior:** BullMQ jobs are configured for three attempts with exponential backoff starting at five seconds. The email record is returned to `SCHEDULED` after a delivery error until the attempt count reaches three, after which it is marked `FAILED`.
- **Ownership checks:** Authenticated email and dashboard queries are scoped through the campaign owner.
- **Health endpoint:** `GET /api/health` checks PostgreSQL and Redis and reports `ok` or `degraded`.

### Frontend

- **Login/authentication:** The login page starts the backend Google OAuth flow. The frontend checks `/api/auth/me` and redirects unauthenticated users to `/login`.
- **Dashboard:** The protected dashboard displays the signed-in user and mailbox-style navigation with scheduled and sent counts.
- **Email compose:** The compose modal collects subject, message, start time, delay, hourly limit, and a recipient file.
- **Recipient import:** The frontend extracts email addresses from `.csv` or `.txt` files, lowercases them, and removes duplicates before submission.
- **Scheduled email table:** Scheduled emails are displayed with recipient, subject, scheduled time, and status.
- **Sent email table:** Sent results are displayed with recipient, subject, sent time, status, and an `Open` link when a preview URL exists.
- **Status display:** Email statuses are represented as `SCHEDULED`, `PROCESSING`, `SENT`, or `FAILED` through the shared status badge component.
- **Polling:** Scheduled and sent email queries refetch every five seconds.
- **Logout:** The header provides a logout action that calls the backend and clears the frontend query cache.

The frontend does not currently implement mailbox search, filtering, editing, deleting, cancelling, starring, archiving, or settings actions. The sidebar labels for those areas are visual navigation elements only.

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19, React Router, TanStack Query, Axios, Vite | User interface, routing, API requests, query state, and development/build tooling |
| Backend | Node.js, TypeScript, Express | HTTP API and application process |
| Database | PostgreSQL 16 via Prisma 6 | Persistent users, senders, campaigns, and email records |
| Queue | BullMQ 5 | Delayed email jobs, attempts, backoff, and job concurrency |
| Cache/Queue Store | Redis 7 via ioredis | BullMQ storage and atomic sender/hour rate-limit counters |
| Email | Nodemailer with Ethereal SMTP | Test email delivery and preview URLs |
| Authentication | Passport Google OAuth 2.0 and `cookie-session` | Google sign-in and an HTTP-only session cookie |
| Validation | Zod | Environment, request, and email-address validation |

## 4. Project Structure

```text
project/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/              # Environment, Prisma, and Redis setup
│   │   ├── controllers/         # Auth, dashboard, and email request handlers
│   │   ├── middleware/          # Authentication and centralized errors
│   │   ├── queue/               # BullMQ queue, worker, and job types
│   │   ├── routes/              # Express route definitions
│   │   ├── services/            # Email scheduling, delivery, recovery, and rate limits
│   │   ├── types/               # Express/authentication types
│   │   └── utils/               # Validation, CSV parsing, and logging helpers
│   ├── tests/                   # Vitest unit tests
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Shared UI and compose components
│   │   ├── hooks/               # Auth and email queries
│   │   ├── pages/               # Login and dashboard pages
│   │   ├── services/            # Axios API client
│   │   ├── types/               # Frontend data types
│   │   └── utils/               # Recipient-file parsing
│   ├── .env.example
│   └── package.json
├── docker-compose.yml           # PostgreSQL and Redis services
├── package.json                 # Workspace scripts
└── README.md
```

## 5. Prerequisites

- Node.js and npm. The repository does not declare an engine version; use a current Node.js release compatible with the installed TypeScript, Vite, and dependency versions.
- Docker Desktop, for the PostgreSQL and Redis services defined in `docker-compose.yml`.
- A Google OAuth 2.0 client with the local callback URL configured.
- An Ethereal Email test account for SMTP delivery.
- Git, to clone the repository.

## 6. Environment Variables

Create `backend/.env` from `backend/.env.example`. Create `frontend/.env` from `frontend/.env.example`. Do not copy real credentials into this README or commit `.env` files.

### Backend: `backend/.env`

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `PORT` | No; defaults to `5000` | Express listening port | `5000` |
| `DATABASE_URL` | No; has a local PostgreSQL default | Prisma PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/reachinbox` |
| `REDIS_HOST` | No; defaults to `localhost` | Redis host | `localhost` |
| `REDIS_PORT` | No; defaults to `6379` | Redis port | `6379` |
| `GOOGLE_CLIENT_ID` | Required for Google login | Google OAuth client ID | `your_google_client_id` |
| `GOOGLE_CLIENT_SECRET` | Required for Google login | Google OAuth client secret | `your_google_client_secret` |
| `GOOGLE_CALLBACK_URL` | No; defaults to the local callback | OAuth callback URL | `http://localhost:5000/api/auth/google/callback` |
| `SESSION_SECRET` | No in code; replace the development default | Cookie-session signing key | `your_long_random_secret` |
| `ETHEREAL_HOST` | No; defaults to `smtp.ethereal.email` | SMTP host | `smtp.ethereal.email` |
| `ETHEREAL_PORT` | No; defaults to `587` | SMTP port | `587` |
| `ETHEREAL_USERNAME` | Required for SMTP delivery | Ethereal SMTP username | `your_ethereal_username` |
| `ETHEREAL_PASSWORD` | Required for SMTP delivery | Ethereal SMTP password | `your_ethereal_password` |
| `WORKER_CONCURRENCY` | No; defaults to `5` | BullMQ worker concurrency | `5` |
| `MIN_EMAIL_DELAY_MS` | No; defaults to `2000` | Minimum accepted delay between scheduled recipients | `2000` |
| `MAX_EMAILS_PER_HOUR` | No; defaults to `200` | Maximum accepted campaign hourly limit | `200` |
| `FRONTEND_URL` | No; defaults to `http://localhost:5173` | CORS origin and OAuth redirect destination | `http://localhost:5173` |
| `NODE_ENV` | No; defaults to `development` | Session cookie security mode | `development` |

The application reads environment variables through `backend/src/config/env.ts`. Empty Google credentials disable the Google OAuth route with a `503` response. Empty Ethereal credentials allow the process to start but do not provide usable SMTP authentication.

### Frontend: `frontend/.env`

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `VITE_API_URL` | No; defaults to `http://localhost:5000/api` | Backend API base URL | `http://localhost:5000/api` |

## 7. Ethereal Email Setup

1. Open [Ethereal Email](https://ethereal.email/).
2. Create a test account using the account creation flow.
3. Copy the generated SMTP host, port, username, and password from the account details.
4. Put the values in `backend/.env`:

   ```env
   ETHEREAL_HOST=smtp.ethereal.email
   ETHEREAL_PORT=587
   ETHEREAL_USERNAME=your_ethereal_username
   ETHEREAL_PASSWORD=your_ethereal_password
   ```

5. Start the backend, schedule an email, and let the delayed job reach the worker.
6. After a successful send, the backend stores Nodemailer's Ethereal preview URL in `Email.previewUrl`.
7. The frontend displays an `Open` link for sent rows when that URL is available. The URL can also be retrieved through `GET /api/emails/:id`.

## 8. Backend Setup

From a clean clone, run these commands from the project root:

```sh
npm install
docker compose up -d
copy backend/.env.example backend/.env
npm run db:generate
npm run db:migrate
npm run dev --workspace backend
```

On PowerShell, the environment-file copy can also be written as:

```powershell
Copy-Item backend/.env.example backend/.env
```

Before starting the API, edit `backend/.env` with Google OAuth and Ethereal values. `npm run db:migrate` runs the backend Prisma migration command (`prisma migrate dev`). No seed script is defined in the repository.

The local services have separate responsibilities:

- **PostgreSQL:** Started by Docker Compose on port `5432`; stores application records.
- **Redis:** Started by Docker Compose on port `6379`; stores BullMQ data and rate-limit counters.
- **API server:** `npm run dev --workspace backend` runs `tsx watch src/server.ts` on the configured `PORT`.
- **BullMQ worker:** There is no separate worker command. The API process imports `src/queue/email.worker.ts`, so the same backend process starts the worker.

The root workspace command starts both application processes after dependencies and infrastructure are ready:

```sh
npm run dev
```

## 9. Frontend Setup

From the project root:

```sh
npm install
copy frontend/.env.example frontend/.env
npm run dev --workspace frontend
```

On PowerShell:

```powershell
Copy-Item frontend/.env.example frontend/.env
```

The frontend Vite server uses its default port unless configured elsewhere by Vite. With the provided backend default, set `VITE_API_URL=http://localhost:5000/api` and open the URL printed by Vite, normally `http://localhost:5173`.

## 10. Architecture Overview

```text
User
  ↓
React frontend
  ↓ HTTP requests with credentials
Express API
  ├── Prisma → PostgreSQL
  └── BullMQ → Redis
                 ↓ delayed job
          BullMQ worker in the backend process
                 ↓
          Email service → Nodemailer → Ethereal SMTP
```

- The **frontend** authenticates through the backend, submits schedule requests, and polls scheduled/sent email endpoints.
- The **Express API** handles OAuth callbacks, session checks, request validation, scheduling, listing, and dashboard statistics.
- **PostgreSQL** stores users, senders, campaigns, and email state.
- **Redis** supports BullMQ and the atomic sender/hour limit counter.
- The **BullMQ worker** claims eligible scheduled email rows and invokes the email service.
- **Ethereal SMTP** receives test messages and provides preview URLs through Nodemailer.

## 11. How Scheduling Works

1. The user signs in through Google OAuth.
2. The frontend opens the compose modal and collects subject, body, recipient file, start time, delay, and hourly limit.
3. The frontend extracts recipient addresses from the selected file and sends them to `POST /api/emails/schedule`.
4. The backend validates the subject, body, recipient count, start time, delay, and hourly limit with Zod.
5. The scheduling service trims, lowercases, de-duplicates, and validates recipient addresses.
6. The backend creates one `Campaign` and one `Email` row per recipient. Each `scheduledAt` value is the start time plus the recipient index multiplied by `delaySeconds`.
7. Each email is added to the BullMQ `email-scheduler` queue with a delay calculated from its scheduled timestamp. The job ID is `email-<email-id>`.
8. When the delayed job is ready, the worker calls `processEmail`.
9. The worker atomically changes the row from `SCHEDULED` to `PROCESSING` and increments its attempt count. This prevents another worker from claiming the same scheduled row.
10. The worker reserves a sender/hour slot in Redis. If the limit is full, the row is returned to `SCHEDULED` and re-enqueued for the next UTC hour.
11. If a slot is available, Nodemailer sends the message through Ethereal SMTP.
12. On success, the row becomes `SENT` and stores `sentAt`, the SMTP message ID, and the preview URL when available.
13. On delivery failure, the row remains `SCHEDULED` while attempts remain, or becomes `FAILED` after the third attempt. BullMQ applies its configured exponential backoff between attempts.

## 12. Persistence on Restart

### Express API restart

The API process creates a Prisma client and reconnects to Redis when it starts. On listen, `recoverScheduledEmails()` reads all PostgreSQL email rows with status `SCHEDULED` and enqueues them again. Therefore, scheduled database rows can be reconstructed into BullMQ jobs after an API restart. Rows already marked `SENT` or `FAILED` are not recovered.

### BullMQ worker restart

The worker is part of the backend process. Restarting that process stops the worker temporarily, then starts it again and runs scheduled-row recovery. BullMQ job data remains in Redis if Redis data is retained.

### Redis restart

Docker Compose configures Redis with an AOF command and a named `redis_data` volume. With that Compose volume retained, Redis can restore its BullMQ data after a container restart. If Redis data is deleted or unavailable, BullMQ jobs and rate-limit counters are unavailable until Redis returns. When the backend starts again, `SCHEDULED` PostgreSQL rows are re-enqueued.

### Complete application restart

PostgreSQL data is stored in the `postgres_data` Docker volume, and Redis data is stored in `redis_data`. If those volumes are retained, database records and Redis queue data survive service restarts. PostgreSQL is the source of truth for campaign/email state; Redis holds BullMQ job data and rate-limit counters. The repository does not provide a separate migration or repair process for a permanently deleted Redis volume beyond startup recovery of `SCHEDULED` database rows.

## 13. Rate Limiting

Rate limiting is implemented in `backend/src/services/rate-limit.service.ts`.

- The limited resource is email sending for a sender within a UTC hour window.
- The Redis key format is `email-rate:<sender-id>:<UTC-hour>`.
- A Redis Lua script increments the counter atomically, sets a two-hour expiry on a new counter, and decrements the counter if the requested limit has been exceeded.
- The limit comes from the campaign's `hourlyLimit`. The API requires a positive integer no greater than `MAX_EMAILS_PER_HOUR`.
- The limit is sender-specific, not recipient-specific and not directly user-specific. New campaigns use the first sender returned by the database, creating an Ethereal sender record when none exists.
- When the limit is exceeded, the email is returned to `SCHEDULED` and re-enqueued for the next UTC hour.

## 14. Concurrency

The BullMQ worker is created with `concurrency: env.WORKER_CONCURRENCY`, which defaults to `5`. This allows up to the configured number of BullMQ jobs to be processed concurrently by the backend worker.

Before sending, each job uses a conditional PostgreSQL update from `SCHEDULED` to `PROCESSING`. A second worker that cannot perform that update exits without sending the same row. Redis sender/hour reservations additionally limit how many jobs may send in a rate window. The repository does not configure multiple worker processes or a distributed worker deployment command.

## 15. API Documentation

The backend mounts these routes under `/api`:

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/api/health` | Reports PostgreSQL and Redis status | No |
| `GET` | `/api/auth/me` | Returns the current authenticated user | Session required |
| `POST` | `/api/auth/logout` | Clears the current session cookie | No; has an effect when a session exists |
| `GET` | `/api/auth/google` | Starts Google OAuth | No |
| `GET` | `/api/auth/google/callback` | Handles the Google OAuth callback and creates/updates the user | OAuth provider callback |
| `POST` | `/api/emails/schedule` | Validates and schedules a campaign | Session required |
| `GET` | `/api/emails/scheduled` | Lists the user's `SCHEDULED` and `PROCESSING` emails | Session required |
| `GET` | `/api/emails/sent` | Lists the user's `SENT` and `FAILED` emails | Session required |
| `GET` | `/api/emails/:id` | Returns one email owned by the current user | Session required |
| `GET` | `/api/dashboard/stats` | Returns the user's scheduled, sent, and failed counts | Session required |

## 16. Database / Data Model

The Prisma schema uses PostgreSQL and defines these models:

- **User:** Google ID, name, email, optional avatar, and timestamps. A user owns many campaigns.
- **Sender:** Sender identity and Ethereal username/password. A sender owns many email records. If no sender exists, the scheduling service creates an Ethereal sender using the configured credentials.
- **Campaign:** Owner, subject, body, start time, per-recipient delay, hourly limit, and timestamps. A campaign contains many emails.
- **Email:** Recipient, sender, campaign, subject, body, `scheduledAt`, optional `sentAt`, status, attempts, optional SMTP `messageId`, optional Ethereal `previewUrl`, optional `lastError`, and timestamps.
- **EmailStatus:** `SCHEDULED`, `PROCESSING`, `SENT`, or `FAILED`.

Deleting a user cascades to campaigns, and deleting a campaign cascades to its emails. Each campaign/recipient pair is unique. Indexes exist for user ownership, email status, scheduled time, sender, and campaign.

## 17. Error Handling

- **Invalid input:** Zod errors are converted to HTTP `400` responses with field/path messages. Recipient addresses are normalized and validated before campaign creation.
- **Authentication failures:** Protected endpoints return `401` with `Authentication required`. Missing Google OAuth configuration returns `503` from the Google login start route.
- **Database failures:** Unexpected request errors pass through the centralized middleware and return a generic `500` response. Detailed errors are logged by the backend logger.
- **Queue failures:** Queue and worker errors are logged. BullMQ retries failed jobs according to its configured attempts/backoff settings.
- **Email failures:** The email row records the error message. It remains `SCHEDULED` while retries remain and becomes `FAILED` after the third attempt.
- **Worker failures:** The worker emits a `failed` event and logs the job ID and error. There is no separate dead-letter queue implementation.

## 18. Testing / Verification

The backend package defines `npm test`, which runs `vitest run`. From the project root:

```sh
npm test
npm run build
```

The current tests verify:

- Recipient trimming, lowercasing, and duplicate removal.
- Deterministic BullMQ job ID generation.
- The UTC next-hour rate-limit window calculation.
- The contract that only `SCHEDULED` rows are eligible for an atomic claim.

Manual verification supported by the implementation:

1. Start Docker services, configure Google OAuth and Ethereal, and sign in.
2. Upload a `.csv` or `.txt` recipient file in the compose modal.
3. Schedule a message with a future start time.
4. Confirm the row appears in the scheduled list.
5. Leave the API/worker running until the delayed job is processed.
6. Confirm the row appears in the sent list and open the Ethereal preview link when present.
7. Restart the backend process with a future `SCHEDULED` row and verify that startup recovery re-enqueues it.
8. Use a lower `hourlyLimit` and multiple recipients to observe later emails being rescheduled to the next UTC hour.

There are no repository-provided end-to-end tests, browser automation tests, seed scripts, or integration tests that prove SMTP delivery against a live Ethereal account.

## 19. Demo Credentials

No demo user or password is seeded in the repository. Authentication uses Google OAuth, and the user record is created or updated during the OAuth callback. Configure a Google OAuth client and sign in with an account permitted by that OAuth client.

## 20. Known Limitations

- Google OAuth credentials are required for login; there is no local username/password registration flow.
- Ethereal is a test SMTP service, not a production email provider.
- The worker runs in the backend API process; there is no independently managed worker command.
- The frontend does not implement search, filtering, edit, delete, cancel, archive, star, or settings behavior.
- There is no dead-letter queue or operator UI for failed BullMQ jobs.
- Startup recovery re-enqueues `SCHEDULED` database rows, but a permanently deleted Redis volume loses the original BullMQ job records and rate-limit counters until recovery occurs.
- Delivery is not guaranteed exactly once across an SMTP acknowledgement and a process crash. A message accepted by SMTP before a crash could be sent again on retry.
- The repository has focused unit tests but no full API, database, browser, or SMTP integration test suite.
- The frontend has no separate production server script; `vite build` creates the frontend bundle.

## 21. Future Improvements

The following are suggestions, not implemented features:

- Run the BullMQ worker as a separately deployable process.
- Add dead-letter handling, retry inspection, and operational controls for failed jobs.
- Add structured metrics and dashboards for queue depth, delivery latency, rate-limit deferrals, and failures.
- Add integration and end-to-end tests using disposable PostgreSQL, Redis, and Ethereal resources.
- Add explicit campaign management actions such as cancel, edit, delete, search, and filtering.
- Replace Ethereal with a production email provider and manage sender credentials through a secure secret store.
- Add distributed worker deployment and stronger observability for multi-instance operation.

## 22. Submission Notes

- Keep the repository private unless the submission instructions explicitly require public access.
- Grant repository access to required reviewers or collaborators before submission.
- Do not commit `backend/.env`, `frontend/.env`, or any other secrets.
- Keep `.env.example` files in the repository with placeholders and non-sensitive local defaults.
- Review `backend/.env.example` before submission: it currently contains non-empty Google OAuth and session-secret-looking values. Treat them as placeholders only, replace them with safe placeholders if they are real, and rotate any credential that may have been exposed.
- Before submitting, run the documented build and test commands and confirm that local credentials are not present in tracked files.
