
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  RefreshCw,
  BrainCircuit,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const ML_API =
  process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

type Row = Record<string, unknown>;

type InsightsData = {
  employees: Row[];
  materials: Row[];
  orders: Row[];
  dashboard: unknown;
};

type Prediction = {
  material_name: string;
  forecast_date: string;
  opening_stock: number;
  predicted_quantity_used: number;
  reorder_level: number;
  stockout_warning: boolean;
  low_stock_warning: boolean;
};

type PredictionResponse = {
  data_source?: string;
  warning?: string;
  count?: number;
  predictions?: Prediction[];
};

function getItems(data: unknown): Row[] {
  if (Array.isArray(data)) return data as Row[];

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    for (const key of ["data", "employees", "materials", "orders", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as Row[];
    }
  }

  return [];
}

function getLabel(row: Row, index: number): string {
  const value =
    row.name ??
    row.material_name ??
    row.product_name ??
    row.status ??
    row.order_status ??
    row.employee_name;

  return value === null || value === undefined
    ? `Record ${index + 1}`
    : String(value);
}

function getNumericValue(row: Row): number {
  const possibleKeys = [
    "quantity",
    "stock_quantity",
    "quantity_in_stock",
    "total",
    "amount",
    "price",
    "total_amount",
    "hours_worked",
  ];

  for (const key of possibleKeys) {
    const value = row[key];

    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return 1;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData>({
    employees: [],
    materials: [],
    orders: [],
    dashboard: null,
  });

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predictionWarning, setPredictionWarning] = useState("");
  const [predictionSource, setPredictionSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [mlLoading, setMlLoading] = useState(true);
  const [error, setError] = useState("");
  const [mlError, setMlError] = useState("");

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [employeesRes, materialsRes, ordersRes, dashboardRes] =
        await Promise.all([
          fetch(`${API}/employees`),
          fetch(`${API}/materials`),
          fetch(`${API}/orders`),
          fetch(`${API}/dashboard`),
        ]);

      if (
        !employeesRes.ok ||
        !materialsRes.ok ||
        !ordersRes.ok ||
        !dashboardRes.ok
      ) {
        throw new Error("One or more backend API requests failed.");
      }

      const [employees, materials, orders, dashboard] = await Promise.all([
        employeesRes.json(),
        materialsRes.json(),
        ordersRes.json(),
        dashboardRes.json(),
      ]);

      setData({
        employees: getItems(employees),
        materials: getItems(materials),
        orders: getItems(orders),
        dashboard,
      });
    } catch {
      setError(
        "Unable to load business data. Check that your Express backend is running on port 3000."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPredictions = useCallback(async () => {
    setMlLoading(true);
    setMlError("");

    try {
      const response = await fetch(
        `${ML_API}/predictions/material-demand`
      );

      if (!response.ok) {
        throw new Error(`ML API returned HTTP ${response.status}.`);
      }

      const result: PredictionResponse = await response.json();

      if (!Array.isArray(result.predictions)) {
        throw new Error("The ML API response did not contain predictions.");
      }

      setPredictions(result.predictions);
      setPredictionWarning(result.warning ?? "");
      setPredictionSource(result.data_source ?? "unknown");
    } catch (err) {
      setMlError(
        err instanceof Error
          ? `${err.message} Check that the Python ML API is running on port 8000.`
          : "Could not load ML predictions."
      );
      setPredictions([]);
    } finally {
      setMlLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadInsights(), loadPredictions()]);
  }, [loadInsights, loadPredictions]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const chartData = data.materials.slice(0, 8).map((material, index) => ({
    name: getLabel(material, index),
    value: getNumericValue(material),
  }));

  const orderChartData = data.orders.slice(0, 8).map((order, index) => ({
    name: getLabel(order, index),
    value: getNumericValue(order),
  }));

  const stockoutCount = predictions.filter(
    (item) => item.stockout_warning
  ).length;

  const lowStockCount = predictions.filter(
    (item) => item.low_stock_warning
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 p-5 text-slate-900 md:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Workspace / Business Insights
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold">
            <BarChart3 className="h-8 w-8 text-amber-600" />
            Business Insights
          </h1>
          <p className="mt-2 text-slate-500">
            Explore workshop operations and experimental ML forecasts.
          </p>
        </div>

        <button
          onClick={refreshAll}
          disabled={loading || mlLoading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loading || mlLoading ? "animate-spin" : ""
            }`}
          />
          Refresh insights
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* ML forecast section */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <BrainCircuit className="h-6 w-6 text-violet-600" />
              ML Material Demand Forecast
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Experimental next-day material-consumption estimates from your
              Python ML service.
            </p>
          </div>

          <button
            onClick={loadPredictions}
            disabled={mlLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                mlLoading ? "animate-spin" : ""
              }`}
            />
            Refresh forecast
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Prototype data notice</p>
          <p className="mt-1">
            These forecasts use synthetic demonstration data. They have not
            been validated against real workshop demand and should not be used
            to make purchasing decisions.
          </p>
          {predictionWarning && (
            <p className="mt-2 text-xs">{predictionWarning}</p>
          )}
        </div>

        {mlError && (
          <div className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
            <p className="font-semibold">Unable to load ML forecasts</p>
            <p className="mt-1">{mlError}</p>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Materials forecast</p>
            <p className="mt-2 text-2xl font-bold">
              {mlLoading ? "…" : predictions.length}
            </p>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
            <p className="text-sm text-rose-700">
              Potential stockout warnings
            </p>
            <p className="mt-2 text-2xl font-bold text-rose-800">
              {mlLoading ? "…" : stockoutCount}
            </p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              At/below reorder level
            </p>
            <p className="mt-2 text-2xl font-bold text-amber-900">
              {mlLoading ? "…" : lowStockCount}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="mb-3 font-semibold">
            Predicted material consumption
          </h3>

          {mlLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading forecasts from the Python ML service...
            </p>
          ) : predictions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No forecasts are available. Check that the ML API is running and
              its prediction endpoint returns records.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="whitespace-nowrap px-3 py-3 font-medium">
                      Material
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-medium">
                      Forecast date
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                      Opening stock
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                      Predicted usage
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-right font-medium">
                      Reorder level
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 font-medium">
                      Stock status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {predictions.map((item) => (
                    <tr
                      key={`${item.material_name}-${item.forecast_date}`}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-3 py-4 font-medium">
                        {item.material_name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-slate-600">
                        {item.forecast_date}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-right">
                        {formatNumber(item.opening_stock)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-right font-semibold">
                        {formatNumber(item.predicted_quantity_used)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-right">
                        {formatNumber(item.reorder_level)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4">
                        {item.stockout_warning ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Potential stockout
                          </span>
                        ) : item.low_stock_warning ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Low stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            No immediate warning
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Data source: {predictionSource || "Waiting for ML service"}
        </p>
      </section>

      {/* Inventory and orders charts */}
      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Inventory Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Material records and their detected numeric values.
          </p>

          {loading ? (
            <p className="py-12 text-center text-slate-500">
              Loading chart...
            </p>
          ) : chartData.length === 0 ? (
            <p className="py-12 text-center text-slate-500">
              No material records available to chart.
            </p>
          ) : (
            <div className="mt-6 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={65}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Value"
                    fill="#d97706"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Orders Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Numeric values detected in the first eight orders.
          </p>

          {loading ? (
            <p className="py-12 text-center text-slate-500">
              Loading chart...
            </p>
          ) : orderChartData.length === 0 ? (
            <p className="py-12 text-center text-slate-500">
              No order records available to chart.
            </p>
          ) : (
            <div className="mt-6 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderChartData} margin={{ bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={65}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Value"
                    fill="#7c3aed"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Dashboard API summary */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Dashboard API Summary</h2>
        <p className="mt-1 text-sm text-slate-500">
          Raw summary returned by your backend&apos;s /dashboard endpoint.
        </p>

        {loading ? (
          <p className="py-6 text-sm text-slate-500">Loading summary...</p>
        ) : data.dashboard === null ? (
          <p className="py-6 text-sm text-slate-500">
            No dashboard summary returned.
          </p>
        ) : (
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">
            {JSON.stringify(data.dashboard, null, 2)}
          </pre>
        )}
      </section>

      <p className="mt-6 text-xs text-slate-400">
        Note: Operational charts visualize fields returned by your backend.
        ML forecasts use synthetic demonstration data and are not verified
        business KPIs or validated real-world predictions.
      </p>
    </div>
  );
}
