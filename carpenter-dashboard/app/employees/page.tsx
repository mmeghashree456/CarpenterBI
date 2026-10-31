
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Users, RefreshCw, Search, UserPlus, X } from "lucide-react";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Employee = Record<string, unknown>;

type EmployeeForm = {
  name: string;
  email: string;
  phone: string;
  experience_years: string;
  availability: boolean;
};

const initialForm: EmployeeForm = {
  name: "",
  email: "",
  phone: "",
  experience_years: "0",
  availability: true,
};

function getEmployees(data: unknown): Employee[] {
  if (Array.isArray(data)) return data as Employee[];

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.employees)) return obj.employees as Employee[];
    if (Array.isArray(obj.data)) return obj.data as Employee[];
  }

  return [];
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function label(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<EmployeeForm>(initialForm);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/employees`);

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data: unknown = await response.json();
      setEmployees(getEmployees(data));
    } catch {
      setError("Could not load employees. Check that your backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");

    const experience = Number(form.experience_years);

    if (!form.name.trim() || !form.email.trim()) {
      setFormError("Name and email are required.");
      return;
    }

    if (!Number.isInteger(experience) || experience < 0) {
      setFormError("Experience must be a non-negative whole number.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          experience_years: experience,
          availability: form.availability,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : `Could not save employee (HTTP ${response.status}).`
        );
      }

      setForm(initialForm);
      setShowForm(false);
      setSuccess("Employee added successfully.");
      await loadEmployees();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Could not save employee. Check your backend."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredEmployees = employees.filter((employee) =>
    Object.entries(employee)
      .filter(([key]) => key.toLowerCase() !== "password")
      .some(([, value]) =>
        formatValue(value).toLowerCase().includes(search.toLowerCase())
      )
  );

  const columns = employees.length
    ? Object.keys(employees[0]).filter(
        (key) => key.toLowerCase() !== "password"
      )
    : [];

  return (
    <div className="min-h-screen bg-slate-50 p-5 text-slate-900 md:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Workspace / Employees</p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold">
            <Users className="h-8 w-8 text-amber-600" />
            Employee Directory
          </h1>
          <p className="mt-2 text-slate-500">
            View, search and add workshop employees.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadEmployees()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setShowForm((value) => !value);
              setFormError("");
              setSuccess("");
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
          >
            {showForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {showForm ? "Close form" : "Add employee"}
          </button>
        </div>
      </header>

      {success && (
        <div role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {showForm && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold">Add New Employee</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter employee details and save them to your database.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm font-medium text-slate-700">
                Full name *
                <input
                  required
                  maxLength={150}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter employee name"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Email *
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="employee@example.com"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Phone
                <input
                  type="tel"
                  maxLength={30}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Experience (years)
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={form.experience_years}
                  onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </label>

              <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.availability}
                  onChange={(e) => setForm({ ...form, availability: e.target.checked })}
                  className="h-4 w-4 accent-amber-600"
                />
                Currently available
              </label>
            </div>

            {formError && (
              <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                {formError}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save employee"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setForm(initialForm);
                  setFormError("");
                }}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50"
              >
                Clear form
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total employees</p>
          <p className="mt-2 text-3xl font-bold">{loading ? "…" : employees.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Displayed results</p>
          <p className="mt-2 text-3xl font-bold">{loading ? "…" : filteredEmployees.length}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">All Employees</h2>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employees..."
              className="w-full min-w-0 bg-transparent text-sm outline-none sm:w-56"
            />
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-slate-500">Loading employees...</p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>
        ) : filteredEmployees.length === 0 ? (
          <p className="py-10 text-center text-slate-500">No employees found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {columns.map((column) => (
                    <th key={column} className="whitespace-nowrap px-4 py-3 font-medium">
                      {label(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee, index) => (
                  <tr
                    key={String(employee.id ?? index)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    {columns.map((column) => (
                      <td key={column} className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatValue(employee[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
