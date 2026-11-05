from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier


def make_records(client):
    patient = client.post("/api/patients", json={"name": "Test Patient", "dateOfBirth": "1994-04-10", "gender": "Female", "bloodGroup": "A+"})
    assert patient.status_code == 201
    doctor = client.post("/api/doctors", json={"name": "Dr. Test", "specialty": "Cardiology"})
    assert doctor.status_code == 201
    return patient.json, doctor.json


def appointment(patient, doctor, **overrides):
    result = {"patientId": patient["id"], "doctorId": doctor["id"], "date": date.today().isoformat(),
              "time": "10:00", "duration": 30, "reason": "Follow-up", "status": "Confirmed"}
    result.update(overrides)
    return result


def test_health_and_patient_lifecycle(client):
    assert client.get("/api/health").json == {"status": "ok", "database": "postgresql"}
    patient, doctor = make_records(client)
    assert client.get("/api/patients").json[0]["name"] == "Test Patient"
    response = client.patch(f'/api/patients/{patient["id"]}', json={"notes": "Allergy recorded", "email": "patient@example.com"})
    assert response.status_code == 200
    assert response.json["notes"] == "Allergy recorded"
    assert response.json["dateOfBirth"] == "1994-04-10"
    assert client.delete(f'/api/patients/{patient["id"]}').status_code == 204
    assert client.get(f'/api/patients/{patient["id"]}').status_code == 404


def test_validation_rejects_bad_patient(client):
    assert client.post("/api/patients", json={"name": ""}).status_code == 400
    assert client.post("/api/patients", json={"name": "Future", "dateOfBirth": (date.today()+timedelta(days=1)).isoformat()}).status_code == 400
    assert client.post("/api/patients", json={"name": "Invalid", "email": "invalid"}).status_code == 400
    assert client.post("/api/doctors", json={"name": "Doctor"}).status_code == 400
    assert client.post("/api/patients", json=[]).status_code == 400
    assert client.get("/api/patients").json == []


def test_unknown_blood_group_matches_frontend_default(client):
    response = client.post("/api/patients", json={"name": "Unknown Blood Group", "bloodGroup": "Unknown"})
    assert response.status_code == 201
    assert response.json["bloodGroup"] == "Unknown"
    assert client.get(f'/api/patients/{response.json["id"]}').json["bloodGroup"] == "Unknown"
    assert client.patch(f'/api/patients/{response.json["id"]}', json={"notes": "Updated"}).status_code == 200
    default = client.post("/api/patients", json={"name": "Default Blood Group"})
    assert default.status_code == 201
    assert default.json["bloodGroup"] == "Unknown"


def test_appointment_conflicts_and_cancellation(client):
    patient, doctor = make_records(client)
    created = client.post("/api/appointments", json=appointment(patient, doctor))
    assert created.status_code == 201
    assert created.json["patientName"] == "Test Patient"
    assert created.json["doctorName"] == "Dr. Test"
    assert client.post("/api/appointments", json=appointment(patient, doctor, time="10:15")).status_code == 409
    adjacent = client.post("/api/appointments", json=appointment(patient, doctor, time="10:30"))
    assert adjacent.status_code == 201
    assert client.patch(f'/api/appointments/{created.json["id"]}', json={"status": "Cancelled"}).status_code == 200
    assert client.post("/api/appointments", json=appointment(patient, doctor)).status_code == 201
    assert client.delete(f'/api/patients/{patient["id"]}').status_code == 409
    assert client.delete(f'/api/doctors/{doctor["id"]}').status_code == 409
    assert client.get("/api/dashboard").json["todayAppointments"] == 2


def test_patient_cannot_be_booked_with_two_doctors(client):
    patient, doctor = make_records(client)
    other_doctor = client.post("/api/doctors", json={"name": "Dr. Other", "specialty": "General Medicine"}).json
    assert client.post("/api/appointments", json=appointment(patient, doctor)).status_code == 201
    overlap = client.post("/api/appointments", json=appointment(patient, other_doctor, time="10:20"))
    assert overlap.status_code == 409
    assert "Patient" in overlap.json["error"]


def test_appointment_validation_and_updates(client):
    patient, doctor = make_records(client)
    assert client.post("/api/appointments", json=appointment(patient, doctor, patientId=9999)).status_code == 404
    for bad_values in ({"duration": 0}, {"duration": "30"}, {"status": "Unknown"}, {"time": "26:00"}, {"date": "invalid"}, {"time": "23:45"}):
        assert client.post("/api/appointments", json=appointment(patient, doctor, **bad_values)).status_code == 400
    created = client.post("/api/appointments", json=appointment(patient, doctor))
    changed = client.patch(f'/api/appointments/{created.json["id"]}', json={"status": "Completed"})
    assert changed.status_code == 200
    assert changed.json["status"] == "Completed"
    assert client.get("/api/dashboard").json["completedToday"] == 1
    assert client.delete(f'/api/appointments/{created.json["id"]}').status_code == 204
    assert client.delete(f'/api/patients/{patient["id"]}').status_code == 204


def test_seed_is_repeatable(client):
    runner = client.application.test_cli_runner()
    assert runner.invoke(args=["seed"]).exit_code == 0
    patients_before = client.get("/api/patients").json
    appointments_before = client.get("/api/appointments").json
    result = runner.invoke(args=["seed"])
    assert result.exit_code == 0
    assert "skipped" in result.output
    assert len(patients_before) == 12
    assert len(appointments_before) == 32
    assert client.get("/api/patients").json == patients_before
    assert client.get("/api/appointments").json == appointments_before


def test_concurrent_requests_cannot_double_book(client):
    patient, doctor = make_records(client)
    barrier = Barrier(2)
    app = client.application

    def book():
        with app.test_client() as independent_client:
            barrier.wait(timeout=5)
            return independent_client.post("/api/appointments", json=appointment(patient, doctor)).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: book(), range(2)))
    assert sorted(results) == [201, 409]
    assert len(client.get("/api/appointments").json) == 1
