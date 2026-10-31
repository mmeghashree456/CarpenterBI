
"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ShoppingCart,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  X,
  Package,
  CalendarDays,
  ClipboardList,
  Users,
  Sparkles,
  UserCheck,
  ClipboardCheck,
} from "lucide-react";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type OrderItemForm = {
  product_name: string;
  quantity: string;
  unit_price: string;
};

type OrderItem = {
  id?: number;
  product_name?: string;
  quantity?: number;
  unit_price?: number | string;
};

type WorkerRecommendation = {
  employee_id: number;
  employee_name: string;
  score: number;
  reason: string;
  predicted_hours?: number;
  experience_years?: number;
  relevant_task_matches?: string[];
  total_work_logs?: number;
};

type RecommendationResponse = {
  order_id?: number;
  recommendations?: WorkerRecommendation[];
  error?: string;
  ranking_method?: string;
  score_type?: string;
};


type TaskAssignment = {
  id: number;
  order_id: number;
  employee_id: number;
  employee_name: string;
  task_description: string;
  due_date: string | null;
  status: string;
};


type Order = {
  id?: number;
  order_date?: string;
  due_date?: string | null;
  status?: string;
  total_amount?: number | string;
  created_at?: string;
  items?: OrderItem[] | string;
  [key: string]: unknown;
};

const emptyItem: OrderItemForm = {
  product_name: "",
  quantity: "1",
  unit_price: "0",
};

function getOrders(data: unknown): Order[] {
  if (Array.isArray(data)) return data as Order[];

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["data", "orders", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as Order[];
    }
  }

  return [];
}

function getOrderItems(value: unknown): OrderItem[] {
  if (Array.isArray(value)) return value as OrderItem[];

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as OrderItem[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function formatCurrency(value: unknown): string {
  const amount = Number(value);

  if (value === null || value === undefined || value === "" || !Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: unknown): string {
  if (!value || typeof value !== "string") return "—";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
    case "delivered":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "in_progress":
    case "in progress":
      return "bg-blue-50 text-blue-700 ring-blue-600/20";
    case "cancelled":
    case "canceled":
      return "bg-rose-50 text-rose-700 ring-rose-600/20";
    case "pending":
    default:
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
  }
}

function formatStatus(status: unknown): string {
  if (typeof status !== "string" || !status.trim()) return "Unknown";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function today(): string {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<OrderItemForm[]>([{ ...emptyItem }]);

  const [recommendationOrderId, setRecommendationOrderId] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<WorkerRecommendation[]>([]);
  const [assignedWorkers, setAssignedWorkers] = useState<TaskAssignment[]>([]);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [recommendationMethod, setRecommendationMethod] = useState("");
  const [selectedWorker, setSelectedWorker] = useState<WorkerRecommendation | null>(null);
  const [assignmentTask, setAssignmentTask] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentSuccess, setAssignmentSuccess] = useState("");
  const [allAssignments, setAllAssignments] = useState<TaskAssignment[]>([]);

  
const loadOrders = useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    // Fetch orders
    const response = await fetch(`${API}/orders`);

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const data: unknown = await response.json();
    setOrders(getOrders(data));

    // Fetch saved task assignments
    const assignmentsResponse = await fetch(
      `${API}/task-assignments`
    );

    if (!assignmentsResponse.ok) {
      throw new Error("Failed to load task assignments");
    }

    const assignmentsData: TaskAssignment[] =
      await assignmentsResponse.json();

    setAllAssignments(
      Array.isArray(assignmentsData) ? assignmentsData : []
    );

  } catch (error) {
    console.error(error);
    setError("Could not load orders or task assignments. Check that your backend is running.");
  } finally {
    setLoading(false);
  }
}, []);

    

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  function updateItem(
    index: number,
    field: keyof OrderItemForm,
    value: string
  ) {
    setItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addItem() {
    setItems((current) => [...current, { ...emptyItem }]);
  }

  function removeItem(index: number) {
    setItems((current) =>
      current.length === 1 ? current : current.filter((_, i) => i !== index)
    );
  }

  const estimatedTotal = items.reduce((total, item) => {
    const quantity = Number(item.quantity);
    const price = Number(item.unit_price);

    if (
      item.quantity.trim() === "" ||
      item.unit_price.trim() === "" ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(price)
    ) {
      return total;
    }

    return total + quantity * price;
  }, 0);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((order) => {
      const searchable = [
        order.id,
        order.status,
        order.order_date,
        order.due_date,
        order.total_amount,
        ...getOrderItems(order.items).flatMap((item) => [
          item.product_name,
          item.quantity,
          item.unit_price,
        ]),
      ];

      return searchable.some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      );
    });
  }, [orders, search]);

  const pendingOrders = orders.filter(
    (order) => String(order.status ?? "").toLowerCase() === "pending"
  ).length;

  async function handleRecommendWorkers(orderId: number) {
    setRecommendationOrderId(orderId);
    setRecommendations([]);
    setRecommendationError("");
    setRecommendationMethod("");
    setSelectedWorker(null);
    setAssignmentTask("");
    setAssignmentDueDate("");
    setAssignmentError("");
    setAssignmentSuccess("");
    setRecommendationLoading(true);

    try {
      const response = await fetch(`${API}/recommendations/worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });

      const result: RecommendationResponse = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : `Could not get recommendations (HTTP ${response.status}).`
        );
      }

      setRecommendations(
        Array.isArray(result.recommendations) ? result.recommendations : []
      );
      setRecommendationMethod(result.ranking_method ?? "");
      
      // Fetch assignments already saved for this order
      const assignmentsResponse = await fetch(
        `${API}/task-assignments?order_id=${orderId}`
      );

      if (!assignmentsResponse.ok) {
        throw new Error("Could not load existing task assignments.");
      }

      const assignmentsData: TaskAssignment[] =
        await assignmentsResponse.json();

      setAssignedWorkers(
        Array.isArray(assignmentsData) ? assignmentsData : []
      );
    } catch (err) {
      setRecommendationError(
        err instanceof Error
          ? err.message
          : "Could not get worker recommendations. Check that your backend is running."
      );
    } finally {
      setRecommendationLoading(false);
    }
  }

  async function handleAssignTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssignmentError("");
    setAssignmentSuccess("");

    if (recommendationOrderId === null || !selectedWorker) {
      setAssignmentError("Select a recommended worker first.");
      return;
    }

    if (!assignmentTask.trim()) {
      setAssignmentError("Enter a task description.");
      return;
    }

    setAssignmentLoading(true);

    try {
      const response = await fetch(`${API}/task-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: recommendationOrderId,
          employee_id: selectedWorker.employee_id,
          task_description: assignmentTask.trim(),
          due_date: assignmentDueDate || null,
          estimated_hours: selectedWorker.predicted_hours ?? null,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : `Could not assign task (HTTP ${response.status}).`
        );
      }

      
const assignedEmployee = selectedWorker;

setAssignmentSuccess(
  `Task assigned to ${assignedEmployee.employee_name}.`
);

// Refresh assignments from PostgreSQL
const assignmentsResponse = await fetch(
  `${API}/task-assignments?order_id=${recommendationOrderId}`
);

if (!assignmentsResponse.ok) {
  throw new Error("Task was saved, but assignments could not be refreshed.");
}

const assignmentsData: TaskAssignment[] =
  await assignmentsResponse.json();

setAssignedWorkers(
  Array.isArray(assignmentsData) ? assignmentsData : []
);

// Refresh order status in the table
await loadOrders();

setSelectedWorker(null);
setAssignmentTask("");
setAssignmentDueDate("");

    } catch (err) {
      setAssignmentError(
        err instanceof Error
          ? err.message
          : "Could not assign task. Check that the backend endpoint is available."
      );
    } finally {
      setAssignmentLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const quantity = Number(item.quantity);
      const price = Number(item.unit_price);

      if (!item.product_name.trim()) {
        setFormError(`Enter a product name for item ${index + 1}.`);
        return;
      }

      if (
        item.quantity.trim() === "" ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        setFormError(
          `Item ${index + 1}: quantity must be a positive whole number.`
        );
        return;
      }

      if (
        item.unit_price.trim() === "" ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        setFormError(
          `Item ${index + 1}: unit price must be zero or greater.`
        );
        return;
      }
    }

    if (dueDate) {
      const parsed = new Date(`${dueDate}T00:00:00Z`);

      if (
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== dueDate
      ) {
        setFormError("Enter a valid due date.");
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        due_date: dueDate || null,
        items: items.map((item) => ({
          product_name: item.product_name.trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
      };

      const response = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : `Could not save order (HTTP ${response.status}).`
        );
      }

      setItems([{ ...emptyItem }]);
      setDueDate("");
      setShowForm(false);
      setSuccess(
        `Order #${result.id ?? ""} created successfully. Total: ${formatCurrency(
          result.total_amount ?? estimatedTotal
        )}.`
      );

      await loadOrders();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Could not save order. Check your backend."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Workspace / Orders</p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
            <ShoppingCart className="h-8 w-8 text-amber-600" />
            Order Management
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Manage workshop orders, products and delivery dates.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setShowForm((value) => !value);
              setFormError("");
              setSuccess("");
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {showForm ? "Close form" : "Add order"}
          </button>
        </div>
      </header>

      {success && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {success}
        </div>
      )}

      {recommendationOrderId !== null && (
        <section
          aria-live="polite"
          className="mb-6 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-2.5 text-indigo-700 shadow-sm">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">
                  Worker recommendations for Order #{recommendationOrderId}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  ML-estimated task duration and recorded work history help rank available employees.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecommendationOrderId(null);
                setRecommendations([]);
                setRecommendationError("");
              }}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-800"
              aria-label="Close recommendations"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5">
            {recommendationLoading ? (
              <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
                Finding suitable available employees...
              </div>
            ) : recommendationError ? (
              <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                {recommendationError}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                No employee recommendations were returned for this order.
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-500">
                    {recommendations.length} available {recommendations.length === 1 ? "employee" : "employees"} ranked
                  </p>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                    Duration estimate + heuristic ranking
                  </span>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {recommendations.map((person, index) => (
                    <article
                      key={person.employee_id}
                      className="rounded-xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-slate-900">
                                {person.employee_name}
                              </h3>
                              
                              {assignedWorkers.some(
                                (assignment) =>
                                  assignment.employee_id === person.employee_id &&
                                  assignment.status !== "cancelled"
                              ) && (
                                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Assigned to {person.employee_name}
                                </span>
                              )}

                              <p className="mt-0.5 text-xs text-slate-500">
                                Employee ID: {person.employee_id}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-indigo-700">
                                {Number.isFinite(Number(person.score)) ? Math.round(Number(person.score)) : 0}
                                <span className="text-xs font-medium text-slate-400"> / 100</span>
                              </p>
                              <p className="text-[11px] text-slate-400">Ranking score</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                              {person.experience_years ?? 0} years experience
                            </span>
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                              {person.total_work_logs ?? 0} work logs
                            </span>
                            {Number.isFinite(Number(person.predicted_hours)) && person.predicted_hours !== undefined && (
                              <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs text-violet-700">
                                Est. {Number(person.predicted_hours).toFixed(2)} hours
                              </span>
                            )}
                          </div>

                          <p className="mt-3 text-sm leading-5 text-slate-600">
                            {person.reason || "No explanation provided."}
                          </p>
                          {person.relevant_task_matches && person.relevant_task_matches.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {person.relevant_task_matches.map((match) => (
                                <span
                                  key={match}
                                  className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                                >
                                  {match}
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWorker(person);
                              setAssignmentError("");
                              setAssignmentSuccess("");
                            }}
                            className={`mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                              selectedWorker?.employee_id === person.employee_id
                                ? "bg-indigo-700 text-white"
                                : "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                            }`}
                          >
                            <UserCheck className="h-4 w-4" />
                            {selectedWorker?.employee_id === person.employee_id
                              ? "Selected for assignment"
                              : "Select worker"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <section className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-indigo-700" />
                    <h3 className="font-semibold text-slate-900">Assign task</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedWorker
                      ? `Selected worker: ${selectedWorker.employee_name} (ID ${selectedWorker.employee_id})`
                      : "Select a worker above, then enter the task details."}
                  </p>

                  <form onSubmit={handleAssignTask} className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                      Task description *
                      <textarea
                        required
                        maxLength={1000}
                        rows={3}
                        value={assignmentTask}
                        onChange={(event) => setAssignmentTask(event.target.value)}
                        placeholder="e.g. Build and finish 2 wooden chairs for this order"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Task deadline (optional)
                      <input
                        type="date"
                        min={today()}
                        value={assignmentDueDate}
                        onChange={(event) => setAssignmentDueDate(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={!selectedWorker || assignmentLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        {assignmentLoading ? "Assigning..." : "Assign task"}
                      </button>
                    </div>
                  </form>

                  {assignmentError && (
                    <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                      {assignmentError}
                    </p>
                  )}
                  {assignmentSuccess && (
                    <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                      {assignmentSuccess}
                    </p>
                  )}
                </section>

                <p className="mt-4 text-xs leading-5 text-slate-400">
                  {recommendationMethod
                    ? `Method: ${recommendationMethod.replace(/_/g, " ")}. `
                    : ""}
                  Scores are heuristic ranking scores based on available data, not probabilities or guaranteed performance.
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {showForm && (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold">Create New Order</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add one or more products. The backend calculates the saved order
            total.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <label className="block max-w-sm text-sm font-medium text-slate-700">
              Due date (optional)
              <input
                type="date"
                value={dueDate}
                min={today()}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </label>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">Order item {index + 1}</h3>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1 || saving}
                      title="Remove item"
                      className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block text-sm font-medium text-slate-700 sm:col-span-3 lg:col-span-1">
                      Product name *
                      <input
                        required
                        maxLength={200}
                        value={item.product_name}
                        onChange={(event) =>
                          updateItem(index, "product_name", event.target.value)
                        }
                        placeholder="e.g. Wooden chair"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Quantity *
                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Unit price (₹) *
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(event) =>
                          updateItem(index, "unit_price", event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                    </label>
                  </div>

                  <p className="mt-3 text-right text-sm text-slate-500">
                    Item subtotal:{" "}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(
                        Math.max(0, Number(item.quantity) || 0) *
                          Math.max(0, Number(item.unit_price) || 0)
                      )}
                    </span>
                  </p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add another item
            </button>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Estimated order total</p>
              <p className="mt-1 text-2xl font-bold">
                {formatCurrency(estimatedTotal)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Calculated from quantity × unit price. The backend recalculates
                the saved total.
              </p>
            </div>

            {formError && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
              >
                {formError}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? "Saving order..." : "Save order"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setItems([{ ...emptyItem }]);
                  setDueDate("");
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Total orders</p>
            <div className="rounded-xl bg-amber-50 p-2">
              <ClipboardList className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold">
            {loading ? "…" : orders.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">All recorded orders</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Pending orders</p>
            <div className="rounded-xl bg-orange-50 p-2">
              <Package className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold">
            {loading ? "…" : pendingOrders}
          </p>
          <p className="mt-1 text-xs text-slate-400">Awaiting completion</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-bold">All Orders</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredOrders.length}{" "}
              {filteredOrders.length === 1 ? "order" : "orders"} displayed
            </p>
          </div>

          <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 sm:w-72">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID, product, status..."
              className="w-full min-w-0 bg-transparent text-sm outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-slate-500">Loading orders...</p>
        ) : error ? (
          <p
            role="alert"
            className="m-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : filteredOrders.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">No orders found</p>
            <p className="mt-1 text-sm text-slate-500">
              Try another search or create a new order.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4 font-semibold">Order</th>
                  <th className="px-5 py-4 font-semibold">Products</th>
                  <th className="px-5 py-4 font-semibold">Order date</th>
                  <th className="px-5 py-4 font-semibold">Due date</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 text-right font-semibold">Total</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order, index) => {
                  const orderItems = getOrderItems(order.items);
                  const status = formatStatus(order.status);

                  return (
                    <tr
                      key={String(order.id ?? index)}
                      className="align-top transition hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-5 py-5">
                        <p className="font-bold text-slate-900">
                          #{order.id ?? "—"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Created {formatDate(order.created_at)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="min-w-52 space-y-3">
                          {orderItems.length ? (
                            orderItems.map((item, itemIndex) => (
                              <div
                                key={item.id ?? `${item.product_name}-${itemIndex}`}
                                className="flex items-start gap-2.5"
                              >
                                <div className="mt-0.5 rounded-lg bg-amber-50 p-2">
                                  <Package className="h-4 w-4 text-amber-700" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800">
                                    {item.product_name || "Unnamed product"}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    Qty: {item.quantity ?? "—"} ×{" "}
                                    {formatCurrency(item.unit_price)}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-400">
                              No item details
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-slate-600">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-slate-400" />
                          {formatDate(order.order_date ?? order.created_at)}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-slate-600">
                        {formatDate(order.due_date)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusClasses(
                            String(order.status ?? "")
                          )}`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-right">
                        <span className="font-bold text-slate-900">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-right">
                        <div className="mb-2 space-y-1">
                          {allAssignments
                            .filter(
                              (assignment) =>
                                assignment.order_id === Number(order.id) &&
                                assignment.status !== "cancelled"
                            )
                            .map((assignment) => (
                              <div
                                key={assignment.id}
                                className="text-xs font-semibold text-emerald-700"
                              >
                                <UserCheck className="mr-1 inline h-3.5 w-3.5" />
                                Assigned to {assignment.employee_name}
                              </div>
                            ))}
                        </div>
                        <button
                          type="button"
                          disabled={!Number.isInteger(Number(order.id)) || recommendationLoading}
                          onClick={() => {
                            if (Number.isInteger(Number(order.id))) {
                              void handleRecommendWorkers(Number(order.id));
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {recommendationLoading && recommendationOrderId === Number(order.id)
                            ? "Ranking..."
                            : "Recommend workers"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
