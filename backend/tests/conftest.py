import os

import pytest
from sqlalchemy.engine import make_url

from app import create_app, db


@pytest.fixture
def client():
    url = os.environ.get("TEST_DATABASE_URL", "")
    if not url:
        pytest.skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
    assert make_url(url).database.endswith("_test"), "Use a dedicated database ending in _test"
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": url})
    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app.test_client()
        db.session.remove()
        db.drop_all()
