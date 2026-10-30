
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
MODEL_FILE = BASE_DIR / "material_demand_model.joblib"
DATA_FILE = BASE_DIR / "carpenter_inventory_stock_10000_plus.csv"
WORKER_MODEL_FILE = BASE_DIR / "worker_model.joblib"

app = FastAPI(title="Carpenter BI ML API", version="1.0.0")

# Permit requests from your local Next.js frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

FEATURES = [
    "day_of_week",
    "day_of_year",
    "month",
    "opening_stock",
    "reorder_level",
    "lag_1",
    "lag_7",
    "rolling_mean_7",
    "material_name",
]


def load_inputs():
    if not MODEL_FILE.exists():
        raise FileNotFoundError(
            "Trained model not found. Run python train_model.py first."
        )

    if not DATA_FILE.exists():
        raise FileNotFoundError("Synthetic inventory CSV was not found.")

    df = pd.read_csv(DATA_FILE)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    for column in ["quantity_used", "opening_stock", "reorder_level"]:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = (
        df.dropna(
            subset=[
                "date",
                "material_name",
                "quantity_used",
                "opening_stock",
                "reorder_level",
            ]
        )
        .sort_values(["material_name", "date"])
    )

    if df.empty:
        raise ValueError("The dataset contains no valid inventory records.")

    return df, joblib.load(MODEL_FILE)


@app.get("/")
def home():
    return {
        "service": "Carpenter BI ML API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/predictions/worker-model/health")
def worker_model_health():
    return {
        "worker_model_exists": WORKER_MODEL_FILE.exists(),
        "model_file": WORKER_MODEL_FILE.name,
    }


@app.post("/predictions/worker-duration")
def predict_worker_duration(payload: dict):
    if not WORKER_MODEL_FILE.exists():
        raise HTTPException(
            status_code=503,
            detail="Worker model not trained yet. Run worker_model.py first.",
        )

    required = [
        "experience_years",
        "previous_task_count",
        "average_previous_hours",
        "task_type",
    ]

    missing = [
        key for key in required
        if key not in payload
    ]

    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing fields: {missing}",
        )

    try:
        model = joblib.load(WORKER_MODEL_FILE)

        row = pd.DataFrame([{
            "experience_years": float(payload["experience_years"]),
            "previous_task_count": float(payload["previous_task_count"]),
            "average_previous_hours": float(
                payload["average_previous_hours"]
            ),
            "task_type": str(payload["task_type"]).strip(),
        }])

        if (
            row["experience_years"].iloc[0] < 0
            or row["previous_task_count"].iloc[0] < 0
            or row["average_previous_hours"].iloc[0] < 0
            or not row["task_type"].iloc[0]
        ):
            raise ValueError("Input values must be valid and non-negative.")

        predicted_hours = max(
            float(model.predict(row)[0]),
            0.0,
        )

        return {
            "predicted_hours": round(predicted_hours, 2),
            "prediction_type": "estimated_task_duration",
            "warning": (
                "Prototype estimate trained on a small historical dataset. "
                "Not a measure of worker success or quality."
            ),
        }

    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Worker prediction failed: {exc}",
        ) from exc

@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/predictions/material-demand")
def material_demand():
    try:
        df, model = load_inputs()
        predictions = []

        for material_name, history in df.groupby("material_name"):
            history = history.sort_values("date")
            last = history.iloc[-1]

            if len(history) < 7:
                continue

            future_date = last["date"] + pd.Timedelta(days=1)
            last_seven = history["quantity_used"].tail(7)

            features = pd.DataFrame(
                [
                    {
                        "day_of_week": future_date.dayofweek,
                        "day_of_year": future_date.dayofyear,
                        "month": future_date.month,
                        "opening_stock": float(last["closing_stock"])
                        if "closing_stock" in history.columns
                        else float(last["opening_stock"]),
                        "reorder_level": float(last["reorder_level"]),
                        "lag_1": float(last["quantity_used"]),
                        "lag_7": float(history.iloc[-7]["quantity_used"]),
                        "rolling_mean_7": float(last_seven.mean()),
                        "material_name": material_name,
                    }
                ],
                columns=FEATURES,
            )

            predicted_usage = max(float(model.predict(features)[0]), 0.0)
            opening_stock = float(features.iloc[0]["opening_stock"])
            reorder_level = float(features.iloc[0]["reorder_level"])

            
            predicted_remaining_stock = max(
                opening_stock - predicted_usage, 0.0
            )

            recommended_reorder_quantity = max(
                reorder_level - predicted_remaining_stock, 0.0
            )

            predictions.append(
                {
                    "material_name": material_name,
                    "forecast_date": future_date.date().isoformat(),
                    "opening_stock": round(opening_stock, 2),
                    "predicted_quantity_used": round(predicted_usage, 2),
                    "estimated_remaining_stock": round(
                        predicted_remaining_stock, 2
                    ),
                    "reorder_level": round(reorder_level, 2),
                    "recommended_reorder_quantity": round(
                        recommended_reorder_quantity, 2
                    ),
                    "stockout_warning": predicted_usage > opening_stock,
                    "low_stock_warning": (
                        predicted_remaining_stock <= reorder_level
                    ),
                    "reorder_recommended": (
                        recommended_reorder_quantity > 0
                    ),
                }
            )


        return {
            "data_source": "synthetic_training_demo",
            "warning": (
                "Prototype predictions based on synthetic data. "
                "Do not use for real purchasing decisions."
            ),
            "count": len(predictions),
            "predictions": predictions,
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {exc}",
        ) from exc
