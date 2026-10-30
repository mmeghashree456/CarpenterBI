
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


BASE_DIR = Path(__file__).resolve().parent

# Read historical work logs exported from PostgreSQL.
DATA_FILE = BASE_DIR / "worker_training_data.csv"
MODEL_FILE = BASE_DIR / "worker_model.joblib"
METRICS_FILE = BASE_DIR / "worker_model_metrics.txt"

NUMERIC_FEATURES = [
    "experience_years",
    "previous_task_count",
    "average_previous_hours",
]

CATEGORICAL_FEATURES = ["task_type"]
TARGET = "hours_worked"



def load_and_prepare_data():
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"{DATA_FILE.name} not found."
        )

    df = pd.read_csv(DATA_FILE)

    required = {
        "experience_years",
        "employee_id",
        "order_id",
        "work_date",
        "task_type",
        "hours_worked",
    }

    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"CSV is missing columns: {sorted(missing)}"
        )

    df["work_date"] = pd.to_datetime(
        df["work_date"], errors="coerce"
    )

    df["hours_worked"] = pd.to_numeric(
        df["hours_worked"], errors="coerce"
    )
    df["experience_years"] = pd.to_numeric(
        df["experience_years"], errors="coerce"
    )

    df["task_type"] = (
        df["task_type"].fillna("").astype(str).str.strip()
    )

    df = df.dropna(
        subset=[
            "employee_id",
            "work_date",
            "experience_years",
            "hours_worked",
        ]
    )

    df = df[
        (df["hours_worked"] > 0)
        & (df["experience_years"] >= 0)
        & (df["task_type"] != "")
    ].copy()

    df = df.sort_values(
        ["employee_id", "work_date"]
    ).reset_index(drop=True)

    # Only use each employee's earlier records as features.
    grouped = df.groupby("employee_id")["hours_worked"]

    df["previous_task_count"] = grouped.transform(
        lambda s: s.shift(1).expanding().count()
    )

    df["average_previous_hours"] = grouped.transform(
        lambda s: s.shift(1).expanding().mean()
    )

    # The first task for each employee has no previous history.
    df = df.dropna(
        subset=[
            "previous_task_count",
            "average_previous_hours",
        ]
    ).copy()

    if len(df) < 10:
        raise ValueError(
            f"Only {len(df)} usable historical rows remain "
            "after feature preparation. Collect more records "
            "before training this prototype."
        )

    return df



def build_model():
    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", "passthrough", NUMERIC_FEATURES),
            (
                "task",
                OneHotEncoder(handle_unknown="ignore"),
                CATEGORICAL_FEATURES,
            ),
        ]
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=200,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def main():
    df = load_and_prepare_data()

    # Random row splitting is only a baseline evaluation.
    # For a production model, evaluate chronologically and
    # avoid using information from the target task in its features.
    rng = np.random.RandomState(42)
    indices = rng.permutation(len(df))

    split = int(len(df) * 0.8)
    split = min(max(split, 1), len(df) - 1)

    train = df.iloc[indices[:split]]
    test = df.iloc[indices[split:]]

    features = NUMERIC_FEATURES + CATEGORICAL_FEATURES

    model = build_model()
    model.fit(train[features], train[TARGET])

    predictions = np.maximum(
        model.predict(test[features]), 0
    )

    mae = mean_absolute_error(
        test[TARGET], predictions
    )

    # Train the final model on all available historical records.
    model.fit(df[features], df[TARGET])
    joblib.dump(model, MODEL_FILE)

    report = (
        "WORKER TASK-DURATION MODEL - PROTOTYPE\n"
        "Target: historical hours_worked\n"
        "Dataset: exported work-log records\n"
        f"Valid records: {len(df)}\n"
        f"Training records for evaluation: {len(train)}\n"
        f"Testing records for evaluation: {len(test)}\n"
        f"Baseline test MAE: {mae:.3f} hours\n"
        "\n"
        "This model estimates historical task duration, not "
        "worker success probability or overall worker suitability.\n"
        "Evaluation is a preliminary baseline and may be optimistic "
        "if records from the same worker or order overlap.\n"
        "Use real-world validation before operational decisions.\n"
    )

    METRICS_FILE.write_text(report, encoding="utf-8")

    print(report)
    print(f"Saved model: {MODEL_FILE.name}")
    print(f"Saved metrics: {METRICS_FILE.name}")


if __name__ == "__main__":
    main()
