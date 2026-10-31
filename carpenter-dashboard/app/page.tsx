"use client";

import { useEffect, useState } from "react";

type ApiData = unknown;

type ApiState = {
  dashboard: ApiData;
  employees: ApiData;
  materials: ApiData;
  orders: ApiData;
  lowStock: ApiData;
};

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

function getItems(data: ApiData): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === "object"
    );
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    for (const key of ["data", "employees", "materials", "orders", "items"]) {
      if (Array.isArray(obj[key])) return getItems(obj[key]);
    }
  }

  return [];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function displayLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DataTable({
  title,
  data,
}: {
  title: string;
  data: ApiData;
}) {
  const items = getItems(data);
  const columns = items.length ? Object.keys(items[0]).slice(0, 5) : [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <span className="text-sm text-slate-500">{items.length} records</span>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">
          No records available from this endpoint.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500">
                {columns.map((column) => (
                  <th key={column} className="px-3 py-3 font-medium">
                    {displayLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 6).map((item, index) => (
                <tr
                  key={String(item.id ?? index)}
                  className="border-b border-slate-50 last:border-0"
                >
                  {columns.map((column) => (
                    <td
                      key={column}
                      className="max-w-48 truncate px-3 py-3 text-slate-700"
                    >
                      {formatValue(item[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [api, setApi] = useState<ApiState>({
    dashboard: null,
    employees: null,
    materials: null,
    orders: null,
    lowStock: null,
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const endpoints = [
        ["dashboard", "/dashboard"],
        ["employees", "/employees"],
        ["materials", "/materials"],
        ["orders", "/orders"],
        ["lowStock", "/materials/low-stock"],
      ] as const;

      const results = await Promise.all(
        endpoints.map(async ([key, path]) => {
          try {
            const response = await fetch(`${API}${path}`);

            if (!response.ok) {
              throw new Error(`${path}: HTTP ${response.status}`);
            }

            return {
              key,
              data: await response.json(),
              error: null,
            };
          } catch (error) {
            return {
              key,
              data: null,
              error:
                error instanceof Error ? error.message : `${path} failed`,
            };
          }
        })
      );

      const nextData = { ...api };
      const nextErrors: string[] = [];

      for (const result of results) {
        nextData[result.key] = result.data;
        if (result.error) nextErrors.push(result.error);
      }

      setApi(nextData);
      setErrors(nextErrors);
      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employeeCount = getItems(api.employees).length;
  const materialCount = getItems(api.materials).length;
  const orderCount = getItems(api.orders).length;
  const lowStockCount = getItems(api.lowStock).length;

  const stats = [
    {
      label: "Employees",
      value: loading ? "…" : employeeCount,
      icon: "👥",
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "Inventory Items",
      value: loading ? "…" : materialCount,
      icon: "🪵",
      color: "bg-amber-50 text-amber-700",
    },
    {
      label: "Orders",
      value: loading ? "…" : orderCount,
      icon: "📦",
      color: "bg-violet-50 text-violet-700",
    },
    {
      label: "Low-Stock Records",
      value: loading ? "…" : lowStockCount,
      icon: "⚠️",
      color: "bg-rose-50 text-rose-700",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-[1600px] p-5 md:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Workspace / Overview</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Business Overview
            </h1>
            <p className="mt-2 text-slate-500">
              Monitor your workshop&apos;s operations and resources.
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-100"
          >
            ↻ &nbsp; Refresh data
          </button>
        </header>

        {errors.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Some API requests failed</p>
            <ul className="mt-2 list-inside list-disc">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {stat.label}
                </p>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}
                >
                  {stat.icon}
                </span>
              </div>
              <p className="mt-4 text-3xl font-bold">{stat.value}</p>
              <p className="mt-2 text-xs text-slate-400">
                {loading ? "Fetching from backend…" : "Current API record count"}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <DataTable title="Employee Directory" data={api.employees} />
          <DataTable title="Inventory Overview" data={api.materials} />
          <DataTable title="Recent Orders" data={api.orders} />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800">Business Summary</h2>
            <p className="mt-1 text-sm text-slate-500">
              Values returned by the dashboard API.
            </p>

            {api.dashboard === null ? (
              <p className="py-6 text-sm text-slate-500">
                {loading ? "Loading summary…" : "No summary data returned."}
              </p>
            ) : (
              <pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">
                {JSON.stringify(api.dashboard, null, 2)}
              </pre>
            )}

            {lowStockCount > 0 && (
              <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-4">
                <p className="font-semibold text-rose-800">
                  ⚠️ Low-stock items need attention
                </p>
                <p className="mt-1 text-sm text-rose-700">
                  {lowStockCount} low-stock records returned by the API.
                </p>
              </div>
            )}
          </section>
        </section>

        <footer className="mt-8 border-t border-slate-200 py-5 text-xs text-slate-400">
          Carpenter BI · Local development · Powered by your existing backend
        </footer>
      </div>
    </div>
  );
}
