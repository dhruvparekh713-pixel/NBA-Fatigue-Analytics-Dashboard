"""API contract tests.

Several of these encode fixes rather than just behaviour — notably that the
headline accuracy reports real backtest rows rather than blending in the
synthetic demo season, and that the baseline is majority-class rather than
the old below-chance "always predict up". Those are the assertions most
worth keeping honest as the project changes.
"""

import pytest


# ---------------------------------------------------------------------------
# Health and catalog
# ---------------------------------------------------------------------------

def test_health(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_dates_sorted_and_unique(client):
    dates = client.get("/api/dates").json()["dates"]
    assert dates
    assert dates == sorted(dates)
    assert len(dates) == len(set(dates))


def test_games_for_valid_date(client, any_date):
    body = client.get(f"/api/games/{any_date}").json()
    assert body["date"] == any_date
    assert body["games"]
    for g in body["games"]:
        assert g["correct"] <= g["n_predictions"]
        assert 0 <= g["accuracy_pct"] <= 100


def test_games_unknown_date_404(client):
    assert client.get("/api/games/1999-01-01").status_code == 404


def test_predictions_summary_matches_rows(client, any_date):
    body = client.get(f"/api/predictions/{any_date}").json()
    preds, summary = body["predictions"], body["summary"]
    assert summary["total_players"] == len(preds)
    assert summary["correct"] == sum(p["prediction_correct"] for p in preds)


# ---------------------------------------------------------------------------
# Player
# ---------------------------------------------------------------------------

def test_player_profile_and_game_log(client):
    p = client.get("/api/player/LeBron James").json()
    assert p["name"]
    assert p["total_games"] == len(p["games"])
    assert 0 <= p["season_accuracy"] <= 100


def test_player_unknown_404(client):
    assert client.get("/api/player/Definitely Not A Player").status_code == 404


def test_player_search_substring(client):
    names = client.get("/api/players/search", params={"q": "le"}).json()["players"]
    assert all("le" in n.lower() for n in names)


# ---------------------------------------------------------------------------
# Accuracy
# ---------------------------------------------------------------------------

def test_cumulative_totals_are_monotonic(client):
    data = client.get("/api/accuracy/cumulative").json()["data"]
    assert data
    totals = [d["cumulative_total"] for d in data]
    correct = [d["cumulative_correct"] for d in data]
    assert totals == sorted(totals), "cumulative totals must never decrease"
    assert correct == sorted(correct)
    assert all(c <= t for c, t in zip(correct, totals))


def test_segments_have_expected_groups(client):
    segs = client.get("/api/accuracy/segments").json()["segments"]
    for key in ("by_role", "by_rest", "by_age", "by_minutes"):
        assert key in segs
    for group in segs.values():
        for s in group:
            assert s["correct"] <= s["total"]


# ---------------------------------------------------------------------------
# Overview — provenance split and baseline. These are regression tests.
# ---------------------------------------------------------------------------

def test_overview_reports_all_three_splits(client):
    o = client.get("/api/stats/overview").json()
    assert o["real"] is not None
    assert o["combined"] is not None
    assert o["real"]["total_predictions"] <= o["combined"]["total_predictions"]


def test_headline_mirrors_real_not_combined(client):
    """The headline must not blend synthetic rows back in."""
    o = client.get("/api/stats/overview").json()
    assert o["overall_accuracy"] == o["real"]["accuracy_pct"]
    assert o["total_predictions"] == o["real"]["total_predictions"]
    assert o["baseline_accuracy"] == o["real"]["baseline_pct"]

    if o["synthetic"] and o["synthetic"]["total_predictions"] > 0:
        combined_n = o["combined"]["total_predictions"]
        assert o["total_predictions"] < combined_n, (
            "headline is counting synthetic rows"
        )


def test_baseline_is_majority_class(client):
    """Majority class is >= 50% by definition; the old baseline was 45%."""
    o = client.get("/api/stats/overview").json()
    for key in ("real", "synthetic", "combined"):
        split = o[key]
        if not split:
            continue
        assert split["baseline_pct"] >= 50.0, (
            f"{key} baseline {split['baseline_pct']}% is below chance — "
            "majority class can never be"
        )
        assert split["lift_pct"] == pytest.approx(
            split["accuracy_pct"] - split["baseline_pct"], abs=0.05
        )


def test_catalog_counts_cover_everything(client):
    """Games/players describe all browsable rows, not just the real ones."""
    o = client.get("/api/stats/overview").json()
    dates = client.get("/api/dates").json()["dates"]
    assert o["total_games"] > 0
    assert o["total_players"] > 0
    assert len(dates) > 0


# ---------------------------------------------------------------------------
# Online inference
# ---------------------------------------------------------------------------

def test_predict_status(client):
    st = client.get("/api/predict/status").json()
    assert "ready" in st
    if st["ready"]:
        assert len(st["targets"]) == 4
        assert st["known_players"] > 0


def test_predict_known_player(client):
    st = client.get("/api/predict/status").json()
    if not st["ready"]:
        pytest.skip("model artifact unavailable")

    r = client.post("/api/predict", json={
        "player_name": "LeBron James",
        "minutes_so_far": 32, "pace": 98, "rest_days": 1,
    })
    assert r.status_code == 200
    d = r.json()
    assert d["used_league_medians"] is False
    assert d["matched_profile"]
    assert len(d["predictions"]) == 4
    assert len(d["features_used"]) == 11
    assert 0 <= d["fatigue_risk_score"] <= 100


def test_predict_unknown_player_falls_back_to_medians(client):
    st = client.get("/api/predict/status").json()
    if not st["ready"]:
        pytest.skip("model artifact unavailable")

    d = client.post("/api/predict", json={
        "player_name": "Zzzz Nonexistent", "minutes_so_far": 20, "rest_days": 0,
    }).json()
    assert d["used_league_medians"] is True
    assert "league-median" in d["model_note"]


def test_predict_context_changes_the_answer(client):
    """A heavier workload on no rest must not score identically to a light one."""
    st = client.get("/api/predict/status").json()
    if not st["ready"]:
        pytest.skip("model artifact unavailable")

    def call(minutes, rest):
        return client.post("/api/predict", json={
            "player_name": "LeBron James",
            "minutes_so_far": minutes, "pace": 100, "rest_days": rest,
        }).json()

    tired, fresh = call(38, 0), call(12, 4)
    assert tired["fatigue_risk_score"] > fresh["fatigue_risk_score"]
    assert tired["predictions"] != fresh["predictions"]


@pytest.mark.parametrize("payload", [
    {"player_name": "", "minutes_so_far": 20},          # empty name
    {"player_name": "X", "minutes_so_far": 99},         # minutes out of range
    {"player_name": "X", "minutes_so_far": -1},         # negative minutes
    {"player_name": "X", "minutes_so_far": 20, "rest_days": -3},
    {"minutes_so_far": 20},                             # missing name
])
def test_predict_rejects_bad_input(client, payload):
    assert client.post("/api/predict", json=payload).status_code == 422
