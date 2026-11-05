"""Development clinic management API backed by PostgreSQL.

No authentication is implemented. Use synthetic records only until appropriate
authentication, authorization and operational controls have been added.
"""
from __future__ import annotations

import os
from datetime import date, datetime, time, timedelta, timezone

import click
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

load_dotenv()
db = SQLAlchemy()
STATUSES = ("Scheduled", "Confirmed", "Completed", "Cancelled")
GENDERS = ("Female", "Male", "Other", "Prefer not to say")
BLOOD_GROUPS = ("", "Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")


class Patient(db.Model):
    __tablename__ = "patients"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(254), nullable=False, default="")
    phone = db.Column(db.String(40), nullable=False, default="")
    date_of_birth = db.Column(db.Date)
    gender = db.Column(db.String(24), nullable=False, default="Prefer not to say")
    blood_group = db.Column(db.String(7), nullable=False, default="Unknown")
    address = db.Column(db.String(500), nullable=False, default="")
    notes = db.Column(db.Text, nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email,
                "phone": self.phone, "dateOfBirth": self.date_of_birth.isoformat() if self.date_of_birth else "",
                "gender": self.gender, "bloodGroup": self.blood_group,
                "address": self.address, "notes": self.notes,
                "createdAt": self.created_at.isoformat()}


class Doctor(db.Model):
    __tablename__ = "doctors"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(254), nullable=False, default="")
    phone = db.Column(db.String(40), nullable=False, default="")
    specialty = db.Column(db.String(120), nullable=False)
    color = db.Column(db.String(30), nullable=False, default="sage")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email,
                "phone": self.phone, "specialty": self.specialty, "color": self.color}


class Appointment(db.Model):
    __tablename__ = "appointments"
    __table_args__ = (CheckConstraint("duration >= 5 AND duration <= 240", name="appointment_duration"),
                      CheckConstraint("status IN ('Scheduled', 'Confirmed', 'Completed', 'Cancelled')", name="appointment_status"))
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, index=True)
    time = db.Column(db.Time, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="Scheduled")
    reason = db.Column(db.String(1000), nullable=False, default="General consultation")
    duration = db.Column(db.Integer, nullable=False, default=30)
    patient = db.relationship(Patient, lazy="joined")
    doctor = db.relationship(Doctor, lazy="joined")

    def to_dict(self):
        return {"id": self.id, "patientId": self.patient_id, "doctorId": self.doctor_id,
                "patientName": self.patient.name, "doctorName": self.doctor.name,
                "patientInitials": "".join(part[0] for part in self.patient.name.split()[:2]).upper(),
                "specialty": self.doctor.specialty, "date": self.date.isoformat(),
                "time": self.time.strftime("%H:%M"), "status": self.status,
                "reason": self.reason, "duration": self.duration}


class ValidationError(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError("Send a JSON object in the request body.")
    return data


def string_field(data, key, *, required=False, maximum=500, default=""):
    value = data.get(key, default)
    if not isinstance(value, str):
        raise ValidationError(f"{key} must be text.")
    value = value.strip()
    if required and not value:
        raise ValidationError(f"{key} is required.")
    if len(value) > maximum:
        raise ValidationError(f"{key} must be at most {maximum} characters.")
    return value


def parse_date(value, key="date"):
    try:
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError()
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        raise ValidationError(f"{key} must use YYYY-MM-DD format.")


def integer_field(data, key, default=None):
    value = data.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError(f"{key} must be an integer.")
    return value


def patient_values(data, existing=None):
    values = existing.to_dict() if existing else {}
    values.update(data)
    name = string_field(values, "name", required=True, maximum=120)
    email = string_field(values, "email", maximum=254)
    if email and ("@" not in email or not email.rsplit("@", 1)[-1].count(".")):
        raise ValidationError("Enter a valid email address.")
    dob = parse_date(values["dateOfBirth"], "dateOfBirth") if values.get("dateOfBirth") else None
    if dob and dob > date.today():
        raise ValidationError("Date of birth cannot be in the future.")
    gender = string_field(values, "gender", default="Prefer not to say", maximum=24)
    if gender not in GENDERS:
        raise ValidationError("Select a valid gender.")
    blood_group = string_field(values, "bloodGroup", maximum=7, default="Unknown")
    if blood_group not in BLOOD_GROUPS:
        raise ValidationError("Select a valid blood group.")
    return dict(name=name, email=email, phone=string_field(values, "phone", maximum=40),
                date_of_birth=dob, gender=gender, blood_group=blood_group,
                address=string_field(values, "address"), notes=string_field(values, "notes", maximum=10000))


def doctor_values(data, existing=None):
    values = existing.to_dict() if existing else {}
    values.update(data)
    email = string_field(values, "email", maximum=254)
    if email and ("@" not in email or "." not in email.rsplit("@", 1)[-1]):
        raise ValidationError("Enter a valid email address.")
    return dict(name=string_field(values, "name", required=True, maximum=120), email=email,
                phone=string_field(values, "phone", maximum=40),
                specialty=string_field(values, "specialty", required=True, maximum=120),
                color=string_field(values, "color", maximum=30, default="sage"))


def appointment_values(data, existing=None):
    values = existing.to_dict() if existing else {}
    values.update(data)
    patient_id, doctor_id = integer_field(values, "patientId"), integer_field(values, "doctorId")
    if not db.session.get(Patient, patient_id):
        raise ValidationError("Patient does not exist.", 404)
    if not db.session.get(Doctor, doctor_id):
        raise ValidationError("Doctor does not exist.", 404)
    selected_date = parse_date(values.get("date"))
    try:
        raw_time = values.get("time", "")
        if not isinstance(raw_time, str) or len(raw_time) != 5:
            raise ValueError()
        selected_time = datetime.strptime(raw_time, "%H:%M").time()
    except (ValueError, TypeError):
        raise ValidationError("time must use HH:mm format.")
    status = string_field(values, "status", default="Scheduled", maximum=20)
    if status not in STATUSES:
        raise ValidationError("Select a valid appointment status.")
    duration = integer_field(values, "duration", 30)
    if not 5 <= duration <= 240:
        raise ValidationError("Duration must be between 5 and 240 minutes.")
    proposed_start = datetime.combine(selected_date, selected_time)
    proposed_end = proposed_start + timedelta(minutes=duration)
    if proposed_end.date() != selected_date:
        raise ValidationError("Appointments must finish before midnight.")
    if status != "Cancelled":
        # Serialize schedule writers per doctor and patient so concurrent requests
        # cannot both pass conflict validation. Lock ordering avoids deadlocks.
        for lock_key in sorted((1_000_000_000 + doctor_id, 2_000_000_000 + patient_id)):
            db.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
        scheduled = db.session.scalars(select(Appointment).where(
            Appointment.date == selected_date, Appointment.status != "Cancelled",
            (Appointment.doctor_id == doctor_id) | (Appointment.patient_id == patient_id)))
        for other in scheduled:
            if existing and other.id == existing.id:
                continue
            other_start = datetime.combine(other.date, other.time)
            other_end = other_start + timedelta(minutes=other.duration)
            if proposed_start < other_end and proposed_end > other_start:
                who = "Doctor" if other.doctor_id == doctor_id else "Patient"
                raise ValidationError(f"{who} already has an appointment during that time.", 409)
    return dict(patient_id=patient_id, doctor_id=doctor_id, date=selected_date,
                time=selected_time, status=status, duration=duration,
                reason=string_field(values, "reason", required=True, maximum=1000, default="General consultation"))


def create_app(config=None):
    app = Flask(__name__)
    database_url = os.environ.get("DATABASE_URL", "")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    app.config.update(SQLALCHEMY_DATABASE_URI=database_url,
                      SQLALCHEMY_TRACK_MODIFICATIONS=False,
                      SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True},
                      MAX_CONTENT_LENGTH=128 * 1024)
    if config:
        app.config.update(config)
    if not app.config.get("SQLALCHEMY_DATABASE_URI", "").startswith("postgresql"):
        raise RuntimeError("Set DATABASE_URL to a PostgreSQL connection URL. See .env.example.")
    db.init_app(app)

    @app.errorhandler(ValidationError)
    def validation_error(error):
        db.session.rollback()
        return jsonify(error=error.message), error.status

    @app.errorhandler(IntegrityError)
    def integrity_error(error):
        db.session.rollback()
        app.logger.warning("Database integrity constraint rejected request")
        return jsonify(error="This record is still referenced or conflicts with an existing record."), 409

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        db.session.rollback()
        app.logger.exception("Database request failed")
        return jsonify(error="The database is unavailable. Please try again."), 503

    @app.errorhandler(404)
    def not_found(error):
        return jsonify(error="Record or endpoint not found."), 404

    @app.get("/api/health")
    def health():
        db.session.execute(text("SELECT 1"))
        return jsonify(status="ok", database="postgresql")

    def register_resource(name, model, validator, ordering):
        def collection():
            if request.method == "GET":
                query = select(model).order_by(*ordering)
                if name == "appointments":
                    if request.args.get("date"):
                        query = query.where(Appointment.date == parse_date(request.args["date"]))
                return jsonify([item.to_dict() for item in db.session.scalars(query)])
            item = model(**validator(json_body()))
            db.session.add(item)
            db.session.commit()
            return jsonify(item.to_dict()), 201

        def detail(record_id):
            item = db.get_or_404(model, record_id)
            if request.method == "GET":
                return jsonify(item.to_dict())
            if request.method == "DELETE":
                if model in (Patient, Doctor):
                    column = Appointment.patient_id if model is Patient else Appointment.doctor_id
                    if db.session.scalar(select(Appointment.id).where(column == record_id).limit(1)):
                        raise ValidationError("This record has appointment history and cannot be deleted.", 409)
                db.session.delete(item)
                db.session.commit()
                return "", 204
            for key, value in validator(json_body(), item).items():
                setattr(item, key, value)
            db.session.commit()
            db.session.refresh(item)
            return jsonify(item.to_dict())

        app.add_url_rule(f"/api/{name}", f"{name}_collection", collection, methods=["GET", "POST"])
        app.add_url_rule(f"/api/{name}/<int:record_id>", f"{name}_detail", detail, methods=["GET", "PATCH", "PUT", "DELETE"])

    register_resource("patients", Patient, patient_values, [Patient.name])
    register_resource("doctors", Doctor, doctor_values, [Doctor.name])
    register_resource("appointments", Appointment, appointment_values, [Appointment.date, Appointment.time, Appointment.id])

    @app.get("/api/dashboard")
    def dashboard():
        today = date.today()
        appointments = list(db.session.scalars(select(Appointment).where(Appointment.date == today).order_by(Appointment.time)))
        return jsonify(totalPatients=db.session.scalar(select(func.count(Patient.id))),
                       totalDoctors=db.session.scalar(select(func.count(Doctor.id))),
                       todayAppointments=len([a for a in appointments if a.status != "Cancelled"]),
                       completedToday=len([a for a in appointments if a.status == "Completed"]),
                       appointments=[a.to_dict() for a in appointments])

    @app.cli.command("init-db")
    def init_db():
        """Create missing tables; does not modify existing schema."""
        db.create_all()
        click.echo("Database tables are ready.")

    @app.cli.command("seed")
    def seed():
        """Insert synthetic demonstration records only into an empty database."""
        db.create_all()
        if any(db.session.scalar(select(model.id).limit(1)) for model in (Patient, Doctor, Appointment)):
            click.echo("Database already has records; seed skipped.")
            return
        seed_data()
        click.echo("Created synthetic demo patients, doctors and appointments.")

    return app


def seed_data():
    doctors = [
        Doctor(name="Dr. Sarah Mitchell", email="sarah.mitchell@example.com", phone="+1 (415) 555-0101", specialty="Cardiology", color="sage"),
        Doctor(name="Dr. James Wilson", email="james.wilson@example.com", phone="+1 (415) 555-0102", specialty="General Medicine", color="blue"),
        Doctor(name="Dr. Emily Chen", email="emily.chen@example.com", phone="+1 (415) 555-0103", specialty="Pediatrics", color="lavender"),
        Doctor(name="Dr. Michael Roberts", email="michael.roberts@example.com", phone="+1 (415) 555-0104", specialty="Orthopedics", color="peach"),
    ]
    people = [
        ("Olivia Rhye", "1992-06-12", "Female", "A+", "Routine cardiac checkup"),
        ("Phoenix Baker", "1985-04-18", "Male", "O+", "Annual wellness visit"),
        ("Lana Steiner", "1996-09-24", "Female", "B+", "Follow-up consultation"),
        ("Demi Wilkinson", "1988-11-07", "Female", "AB+", "Knee pain assessment"),
        ("Drew Cano", "1979-02-15", "Male", "O-", "Blood pressure review"),
        ("Natali Craig", "2000-07-03", "Female", "A-", "General consultation"),
        ("Orlando Diggs", "1990-12-21", "Male", "B-", "Sports injury follow-up"),
        ("Andi Lane", "2015-03-09", "Female", "O+", "Pediatric wellness visit"),
        ("Kate Morrison", "1994-08-17", "Female", "A+", "Preventive health screening"),
        ("Maxim Ivanov", "1982-05-29", "Male", "B+", "Annual checkup"),
        ("Sofia Martinez", "1998-01-11", "Female", "O+", "Routine consultation"),
        ("Noah Williams", "2018-10-02", "Male", "AB-", "Pediatric follow-up"),
    ]
    patients = [Patient(name=p[0], email=p[0].lower().replace(" ", ".") + "@example.com",
                        phone=f"+1 (415) 555-{1200+i:04}", date_of_birth=date.fromisoformat(p[1]),
                        gender=p[2], blood_group=p[3], address=f"{120+i} Market Street, San Francisco, CA",
                        notes="Synthetic demonstration record.") for i, p in enumerate(people)]
    db.session.add_all(doctors + patients)
    db.session.flush()
    today = date.today()
    slots = [(0, 0, "09:00", "Completed"), (1, 1, "09:30", "Completed"),
             (2, 0, "10:00", "Confirmed"), (3, 3, "10:30", "Confirmed"),
             (4, 0, "11:00", "Scheduled"), (5, 1, "11:30", "Confirmed"),
             (7, 2, "12:00", "Scheduled"), (6, 3, "14:00", "Scheduled")]
    for patient_index, doctor_index, at, status in slots:
        db.session.add(Appointment(patient=patients[patient_index], doctor=doctors[doctor_index],
                       date=today, time=time.fromisoformat(at), status=status,
                       reason=people[patient_index][4], duration=30))
    for offset in (-3, -2, -1, 1, 2, 3, 4, 5):
        for i in range(3):
            patient_index = (offset + i) % len(patients)
            db.session.add(Appointment(patient=patients[patient_index], doctor=doctors[i % 4],
                           date=today + timedelta(days=offset), time=time(9+i, 0),
                           status="Completed" if offset < 0 else "Confirmed",
                           reason=people[patient_index][4], duration=30))
    db.session.commit()


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")))
