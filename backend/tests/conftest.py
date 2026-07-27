"""Test fixtures.

The backend modules import as top-level names (`data_loader`, `predictor`,
`api.routes`), so the backend directory has to be on sys.path regardless of
where pytest is invoked from.
"""

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    """One app instance for the whole session.

    Entering the context manager fires the startup handler, which loads the
    backtest DataFrame and the model artifact — both are expensive, so this
    is session-scoped.
    """
    import main

    with TestClient(main.app) as c:
        yield c


@pytest.fixture(scope="session")
def any_date(client):
    """A date that is guaranteed to have games."""
    dates = client.get("/api/dates").json()["dates"]
    assert dates, "fixture data has no dates"
    return dates[0]
