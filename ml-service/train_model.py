
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "carpenter_inventory_stock_10000_plus.csv"
MODEL_FILE = BASE_DIR / "material_demand_model.joblib"
METRICS_FILE = BASE_DIR / "model_metrics.txt"
PREDICTIONS_FILE = BASE_DIR / "next_day_predictions.csv"

TARGET = "quantity_used"

NUMERIC_FEATURES = [
    "day_of_week",
    "day_of_year",
    "month",
    "opening_stock",
    "reorder_level",
    "lag_1",
    "lag_7",
    "rolling_mean_7",
]

CATEGORICAL_FEATURES = ["material_name"]


def load_and_prepare_data():
    """Load data and create features using only past consumption."""

    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}\n"
            "Place the CSV inside the ml-service folder."
        )

    df = pd.read_csv(DATA_FILE)
    required = {
        "date",
        "material_name",
        "opening_stock",
        "quantity_used",
        "reorder_level",
    }

    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing columns: {sorted(missing)}")

    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    for column in ["opening_stock", "quantity_used", "reorder_level"]:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(
        subset=[
            "date",
            "material_name",
            "opening_stock",
            "quantity_used",
            "reorder_level",
        ]
    )

    if (df["quantity_used"] < 0).any():
        raise ValueError("quantity_used cannot contain negative values.")

    df = df.sort_values(["material_name", "date"]).reset_index(drop=True)

    # Calendar features
    df["day_of_week"] = df["date"].dt.dayofweek
    df["day_of_year"] = df["date"].dt.dayofyear
    df["month"] = df["date"].dt.month

    # Historical consumption features: never use future target values.
    grouped = df.groupby("material_name", sort=False)[TARGET]

    df["lag_1"] = grouped.shift(1)
    df["lag_7"] = grouped.shift(7)
    df["rolling_mean_7"] = grouped.transform(
        lambda series: series.shift(1).rolling(7, min_periods=7).mean()
    )

    df = df.dropna(
        subset=["lag_1", "lag_7", "rolling_mean_7"]
    ).reset_index(drop=True)

    return df


def build_model():
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                "passthrough",
                NUMERIC_FEATURES,
            ),
            (
                "material",
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
                    min_samples_leaf=3,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def main():
    df = load_and_prepare_data()

    if df["date"].nunique() < 10:
        raise ValueError(
            "Not enough distinct dates for a meaningful time-based evaluation."
        )

    # Split chronologically: later dates are reserved for testing.
    unique_dates = np.sort(df["date"].unique())
    split_index = int(len(unique_dates) * 0.8)
    split_index = min(max(split_index, 1), len(unique_dates) - 1)
    test_start = pd.Timestamp(unique_dates[split_index])

    train = df[df["date"] < test_start].copy()
    test = df[df["date"] >= test_start].copy()

    if train.empty or test.empty:
        raise ValueError("Could not create chronological train/test sets.")

    features = NUMERIC_FEATURES + CATEGORICAL_FEATURES

    X_train = train[features]
    y_train = train[TARGET]
    X_test = test[features]
    y_test = test[TARGET]

    model = build_model()
    model.fit(X_train, y_train)

    predictions = np.maximum(model.predict(X_test), 0)

    mae = mean_absolute_error(y_test, predictions)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    r2 = r2_score(y_test, predictions) if len(test) > 1 else float("nan")

    # Save the trained model.
    joblib.dump(model, MODEL_FILE)

    # Save evaluation results.
    report = (
        "CARPENTER BI - MATERIAL DEMAND MODEL\n"
        "Dataset: synthetic demonstration data\n"
        f"Usable records: {len(df)}\n"
        f"Materials: {df['material_name'].nunique()}\n"
        f"Training records: {len(train)}\n"
        f"Testing records: {len(test)}\n"
        f"Test period begins: {test_start.date()}\n"
        f"MAE: {mae:.3f}\n"
        f"RMSE: {rmse:.3f}\n"
        f"R2: {r2:.3f}\n"
        "\nMAE and RMSE are measured in each material's own units.\n"
        "Results on synthetic data do not validate real-world accuracy.\n"
    )

    METRICS_FILE.write_text(report, encoding="utf-8")

    # Forecast one day after each material's latest available record.
    next_day_rows = []

    for material_name, history in df.groupby("material_name"):
        history = history.sort_values("date")
        last = history.iloc[-1]

        # Need at least 7 days of history for the rolling feature.
        if len(history) < 7:
            continue

        previous_seven = history[TARGET].tail(7)

        future_date = last["date"] + pd.Timedelta(days=1)

        next_day_rows.append(
            {
                "date": future_date,
                "material_name": material_name,
                "day_of_week": future_date.dayofweek,
                "day_of_year": future_date.dayofyear,
                "month": future_date.month,
                "opening_stock": last["closing_stock"]
                if "closing_stock" in history.columns
                else last["opening_stock"],
                "reorder_level": last["reorder_level"],
                "lag_1": last[TARGET],
                "lag_7": history.iloc[-7][TARGET],
                "rolling_mean_7": previous_seven.mean(),
            }
        )

    if next_day_rows:
        future = pd.DataFrame(next_day_rows)
        future["predicted_quantity_used"] = np.maximum(
            model.predict(future[features]), 0
        )

        # This is a simple risk estimate, not a probability.
        future["estimated_stockout_risk"] = future.apply(
            lambda row: (
                "Potential stockout"
                if row["predicted_quantity_used"] > row["opening_stock"]
                else "No immediate stockout indicated"
            ),
            axis=1,
        )

        future[
            [
                "date",
                "material_name",
                "opening_stock",
                "predicted_quantity_used",
                "estimated_stockout_risk",
            ]
        ].to_csv(PREDICTIONS_FILE, index=False)

    print("\nModel training and evaluation completed.")
    print(report)
    print(f"Saved model: {MODEL_FILE.name}")
    print(f"Saved metrics: {METRICS_FILE.name}")

    if next_day_rows:
        print(f"Saved prototype predictions: {PREDICTIONS_FILE.name}")
        print("\nNext-day predictions:")
        print(pd.read_csv(PREDICTIONS_FILE).to_string(index=False))

    print(
        "\nReminder: this model uses synthetic data. "
        "Do not use these predictions for real purchasing decisions."
    )


if __name__ == "__main__":
    main()
