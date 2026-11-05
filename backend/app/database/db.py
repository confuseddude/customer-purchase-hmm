"""SQLite persistence: model configurations, customer sequences, experiments.

Uses only the standard-library sqlite3 module. The database file lives in
backend/data/hmm.sqlite3 by default (override with the HMM_DB_PATH env var).
"""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from app.models.hmm import HMM
from app.services.dataset import load_csv

DB_PATH = Path(os.environ.get("HMM_DB_PATH", Path(__file__).resolve().parents[2] / "data" / "hmm.sqlite3"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS model_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pi TEXT NOT NULL,
    A TEXT NOT NULL,
    B TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customer_sequences (
    id INTEGER PRIMARY KEY,
    customer_id TEXT NOT NULL,
    archetype TEXT NOT NULL,
    behaviour TEXT NOT NULL,
    observations TEXT NOT NULL,
    hidden_states TEXT NOT NULL,
    length INTEGER NOT NULL,
    purchased INTEGER NOT NULL,
    ended_with TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    input TEXT NOT NULL,
    summary TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        if conn.execute("SELECT COUNT(*) FROM model_configs").fetchone()[0] == 0:
            _insert_model(conn, HMM.default(), "Illustrative default", "default", active=True)
        if conn.execute("SELECT COUNT(*) FROM customer_sequences").fetchone()[0] == 0:
            df = load_csv()
            conn.executemany(
                "INSERT INTO customer_sequences VALUES (?,?,?,?,?,?,?,?,?)",
                [
                    (int(r.sequence_id), r.customer_id, r.archetype, r.behaviour, r.observations,
                     r.hidden_states, int(r.length), int(r.purchased), r.ended_with)
                    for r in df.itertuples()
                ],
            )


def _insert_model(conn, hmm: HMM, name: str, source: str, active: bool) -> int:
    if active:
        conn.execute("UPDATE model_configs SET is_active = 0")
    cur = conn.execute(
        "INSERT INTO model_configs (name, pi, A, B, source, is_active, created_at) VALUES (?,?,?,?,?,?,?)",
        (name, json.dumps(hmm.pi.tolist()), json.dumps(hmm.A.tolist()), json.dumps(hmm.B.tolist()),
         source, int(active), _now()),
    )
    return int(cur.lastrowid)


def _row_to_config(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "source": row["source"],
        "created_at": row["created_at"],
        "pi": json.loads(row["pi"]),
        "A": json.loads(row["A"]),
        "B": json.loads(row["B"]),
    }


def get_active_config() -> dict:
    with connect() as conn:
        row = conn.execute("SELECT * FROM model_configs WHERE is_active = 1 ORDER BY id DESC LIMIT 1").fetchone()
        if row is None:
            _insert_model(conn, HMM.default(), "Illustrative default", "default", active=True)
            row = conn.execute("SELECT * FROM model_configs WHERE is_active = 1").fetchone()
    return _row_to_config(row)


def get_active_model() -> HMM:
    cfg = get_active_config()
    return HMM(cfg["pi"], cfg["A"], cfg["B"])


def save_model(hmm: HMM, name: str, source: str) -> dict:
    with connect() as conn:
        _insert_model(conn, hmm, name, source, active=True)
    return get_active_config()


def list_configs(limit: int = 20) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM model_configs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [_row_to_config(r) | {"is_active": bool(r["is_active"])} for r in rows]


def list_sequences(behaviour: str | None = None, purchased: bool | None = None, limit: int = 50, offset: int = 0):
    where, args = [], []
    if behaviour:
        where.append("behaviour = ?")
        args.append(behaviour)
    if purchased is not None:
        where.append("purchased = ?")
        args.append(int(purchased))
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    with connect() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM customer_sequences {clause}", args).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM customer_sequences {clause} ORDER BY id LIMIT ? OFFSET ?", [*args, limit, offset]
        ).fetchall()
    return total, [_seq(r) for r in rows]


def all_sequences() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM customer_sequences ORDER BY id").fetchall()
    return [_seq(r) for r in rows]


def get_sequence(seq_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM customer_sequences WHERE id = ?", (seq_id,)).fetchone()
    return _seq(row) if row else None


def _seq(r) -> dict:
    return {
        "id": r["id"],
        "customer_id": r["customer_id"],
        "archetype": r["archetype"],
        "behaviour": r["behaviour"],
        "observations": r["observations"].split("|"),
        "hidden_states": r["hidden_states"].split("|"),
        "length": r["length"],
        "purchased": bool(r["purchased"]),
        "ended_with": r["ended_with"],
    }


def log_experiment(kind: str, input_data: dict, summary: dict) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO experiments (kind, created_at, input, summary) VALUES (?,?,?,?)",
            (kind, _now(), json.dumps(input_data, default=str), json.dumps(summary, default=str)),
        )
        conn.execute("DELETE FROM experiments WHERE id NOT IN (SELECT id FROM experiments ORDER BY id DESC LIMIT 500)")
        return int(cur.lastrowid)


def list_experiments(limit: int = 30) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM experiments ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [
        {"id": r["id"], "kind": r["kind"], "created_at": r["created_at"],
         "input": json.loads(r["input"]), "summary": json.loads(r["summary"])}
        for r in rows
    ]
