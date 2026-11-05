# Flask API

Python 3.12+ and PostgreSQL are required. All records seeded by this project are synthetic. The API currently has no authentication and is intended for local development only.

```sh
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
# Set DATABASE_URL to your PostgreSQL connection URL (see .env.example).
export DATABASE_URL=postgresql+psycopg://careflow:careflow_dev@127.0.0.1:5432/careflow
.venv/bin/flask --app app init-db
.venv/bin/flask --app app seed
.venv/bin/flask --app app run --host 127.0.0.1 --port 5000
```

`init-db` creates missing tables. `seed` is repeatable and skips any nonempty database, preserving user data. No SQLite fallback is used. API dates use `YYYY-MM-DD`, times use local clinic time in `HH:mm` format. Configure the frontend proxy with `API_URL=http://127.0.0.1:5000` if necessary.

Each of `/api/patients`, `/api/doctors`, and `/api/appointments` supports GET (JSON array) and POST (201). `/api/<resource>/<id>` supports GET, PATCH/PUT and DELETE (204). Appointment list optionally accepts `?date=YYYY-MM-DD`. `/api/dashboard` returns counts and today's appointments; `/api/health` verifies database connectivity. All JSON keys use camelCase. Validation returns `{ "error": "…" }` with 400, missing records 404, and scheduling or history conflicts 409. Invalid or unavailable database operations return a generic error without exposing connection details.

Appointments validate doctor/patient existence, appointment status, duration, and overlapping schedules for both the doctor and the patient; cancelled appointments release their slot. Patients and doctors with appointment history cannot be deleted. Time slots must finish before midnight. PostgreSQL advisory transaction locks serialize schedule writes to avoid concurrent double-booking.

## Tests

Use a dedicated PostgreSQL test database; the test suite creates and drops all tables in that database. It refuses to run unless the database name ends in `_test`.

```sh
TEST_DATABASE_URL=postgresql+psycopg://careflow:careflow_dev@127.0.0.1:5432/careflow_test .venv/bin/pytest -q
```

Before using real health information, implement and review authentication, role permissions, audit trails, encryption, backups, migrations, and deployment security for your jurisdiction.
