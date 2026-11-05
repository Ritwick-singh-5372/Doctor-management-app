# Careflow — Doctor & patient management

A clinic management application built with **React + Next.js**, a **Flask REST API**, and **PostgreSQL**. The responsive interface includes a clinic dashboard, patient records, doctor profiles, and appointment scheduling.

## Features

- Dashboard with live counts, daily schedule, weekly appointment chart, and care team.
- Patient directory with search, contact details, clinical notes, and visit history.
- Doctor directory with specialty filters and appointment booking.
- Create, edit, and delete records; patient and doctor records with appointment history are protected from deletion.
- Schedule, confirm, complete, and cancel appointments. Overlapping visits for either the doctor or patient are rejected, including simultaneous booking requests.
- Synthetic sample data, loading/error/empty states, mobile navigation, and keyboard-accessible dialogs.
- Fonts and assets served locally; browser requests to the API are forwarded by Next.js to Flask.

## Requirements

- Node.js 22.13+ (validated with Node 24)
- Python 3.12+
- Docker with Docker Compose, or an existing PostgreSQL database

## Install & run

From the repository root:

```sh
cp .env.example .env
./scripts/install.sh
./scripts/dev.sh
```

The script starts PostgreSQL, creates missing tables, seeds an **empty** database, and starts Flask on port **5000** and Next.js on port **3000**. Ctrl+C stops the API and frontend; the database stays available. Its data persists in the `careflow_postgres` Docker volume. Stop the database with `docker compose stop db`.

`seed` preserves all existing records and skips nonempty databases. Demo appointments use the date of initial seeding; the dashboard date picker can inspect previous days after that date changes. Sample people are fictional.

For an existing PostgreSQL server, set `DATABASE_URL` in your shell and start each service manually:

```sh
# Terminal 1, repository root
export DATABASE_URL='postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE'
cd backend
.venv/bin/flask --app app init-db
# Optional synthetic records, only for an empty development database:
.venv/bin/flask --app app seed
.venv/bin/flask --app app run --host 127.0.0.1 --port 5000

# Terminal 2, repository root
cd frontend
npm run dev
```

The default API destination is `http://127.0.0.1:5000`. To change it, set `API_URL` before starting or building Next.js, or put it in `frontend/.env.local`. `scripts/dev.sh` loads the root `.env`. Appointments use local clinic dates and times; use one agreed clinic timezone for all staff.

## Validation

```sh
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

API integration tests use real PostgreSQL. Create a **separate** test database (tests create and drop tables; its name must end with `_test`):

```sh
docker compose exec -T db createdb -U careflow careflow_test
cd backend
TEST_DATABASE_URL=postgresql+psycopg://careflow:careflow_dev@127.0.0.1:5432/careflow_test .venv/bin/pytest -q
```

With the app running, browser tests exercise the UI against the real API and clean up their own records:

```sh
cd frontend
npx playwright install chromium
npm run test:e2e
# To use an existing Chromium installation:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

See [backend/README.md](backend/README.md) for API endpoints and validation rules.

## Project layout

```text
frontend/          Next.js App Router, React, TypeScript, CSS
backend/           Flask, SQLAlchemy, psycopg, integration tests
docker-compose.yml PostgreSQL with health check and persistent volume
scripts/dev.sh     Development startup and process cleanup
```

## Development scope

This is a working development application, not a production medical-record system. It has **no authentication or role-based access control**. Use synthetic information only. Before using real patient data, add reviewed authentication, authorization, audit logging, schema migrations, encrypted transport/storage, backups, and the health-data controls required by your jurisdiction. The included database credentials and Flask server are for local development.
