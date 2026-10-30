
import pandas as pd


def prepare_material_usage(csv_path: str) -> pd.DataFrame:
    """Load and prepare historical material-consumption records."""

    df = pd.read_csv(csv_path)

    required_columns = {
        "material_name",
        "usage_date",
        "daily_quantity_used",
    }

    missing = required_columns - set(df.columns)
    if missing:
        raise ValueError(
            f"CSV is missing required columns: {sorted(missing)}"
        )

    df = df.copy()
    df["usage_date"] = pd.to_datetime(
        df["usage_date"], errors="coerce"
    )
    df["daily_quantity_used"] = pd.to_numeric(
        df["daily_quantity_used"], errors="coerce"
    )

    df = df.dropna(
        subset=["material_name", "usage_date", "daily_quantity_used"]
    )

    if (df["daily_quantity_used"] < 0).any():
        raise ValueError("Usage quantities cannot be negative.")

    # Combine duplicate records for the same material and date.
    df = (
        df.groupby(
            ["material_name", "usage_date"],
            as_index=False,
        )["daily_quantity_used"]
        .sum()
        .sort_values(["material_name", "usage_date"])
        .reset_index(drop=True)
    )

    return df


if __name__ == "__main__":
    path = input("Enter the path to your daily usage CSV: ").strip().strip('"')

    try:
        data = prepare_material_usage(path)

        print("\nPrepared material-usage data:")
        print(data.to_string(index=False))

        print("\nRecords:", len(data))
        print("Materials:", data["material_name"].nunique())
        print("Distinct dates:", data["usage_date"].nunique())

        print(
            "\nNote: more historical dates are needed before "
            "a reliable forecasting model can be evaluated."
        )
    except (ValueError, OSError, pd.errors.ParserError) as exc:
        print(f"Could not prepare data: {exc}")
