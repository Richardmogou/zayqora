import os

TEST_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://aqarflow:aqarflow_dev@127.0.0.1:5433/aqarflow_test?options=-csearch_path%3Dzayqora",
)
# Sécurité : les tests vident les tables, ils ne doivent jamais viser la base de développement
assert TEST_URL.split("?", 1)[0].rsplit("/", 1)[-1].endswith("_test"), "Refusing to run tests on a database whose name does not end with _test"
os.environ["DATABASE_URL"] = TEST_URL

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def clean_state():
    limiter.clear()
    yield
    with engine.begin() as conn:
        conn.execute(text(
            "TRUNCATE audit_logs, user_sessions, restaurant_members, branches, restaurants, users RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    with TestClient(fastapi_app) as c:
        yield c
