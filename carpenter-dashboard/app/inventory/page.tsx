
"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Package,
  RefreshCw,
  Search,
  AlertTriangle,
  CircleX,
  Boxes,
} from "lucide-react";

const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Material = Record<string, unknown>;

type InventoryAnalytics = {
  total_materials: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_reorder_quantity: number | string;
};

function getItems(data: unknown): Material[] {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Material =>
        item !== null && typeof item === "object" && !Array.isArray(item)
    );
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    for (const key of ["data", "materials", "items"]) {
      if (Array.isArray(obj[key])) {
        return getItems(obj[key]);
      }
    }
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

function getNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function InventoryPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [lowStock, setLowStock] = useState<Material[]>([]);
  const [analytics, setAnalytics] = useState<InventoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  // Add material form
const [showAddForm, setShowAddForm] = useState(false);

// Restock form
const [showRestockForm, setShowRestockForm] = useState(false);

// Form loading and messages
const [saving, setSaving] = useState(false);
const [formMessage, setFormMessage] = useState("");
const [formError, setFormError] = useState("");

// New material fields
const [newMaterial, setNewMaterial] = useState({
  material_name: "",
  material_type: "",
  quantity: "",
  unit: "",
  reorder_level: "",
});

// Restock fields
const [restockMaterialId, setRestockMaterialId] = useState("");
const [restockQuantity, setRestockQuantity] = useState("");

  async function loadInventory() {
    setLoading(true);
    setError("");

    try {
      const [materialsResponse, lowStockResponse, analyticsResponse] =
        await Promise.all([
          fetch(`${API}/materials`),
          fetch(`${API}/materials/low-stock`),
          fetch(`${API}/analytics/inventory`),
        ]);

      if (!materialsResponse.ok) {
        throw new Error(`/materials returned HTTP ${materialsResponse.status}`);
      }

      if (!lowStockResponse.ok) {
        throw new Error(
          `/materials/low-stock returned HTTP ${lowStockResponse.status}`
        );
      }

      if (!analyticsResponse.ok) {
        throw new Error(
          `/analytics/inventory returned HTTP ${analyticsResponse.status}`
        );
      }

      const [materialsData, lowStockData, analyticsData] = await Promise.all([
        materialsResponse.json(),
        lowStockResponse.json(),
        analyticsResponse.json(),
      ]);

      setMaterials(getItems(materialsData));
      setLowStock(getItems(lowStockData));
      setAnalytics(analyticsData as InventoryAnalytics);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not load inventory analytics: ${err.message}`
          : "Could not load inventory. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  
async function handleAddMaterial(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setSaving(true);
  setFormError("");
  setFormMessage("");

  try {
    const response = await fetch(`${API}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        material_name: newMaterial.material_name.trim(),
        material_type: newMaterial.material_type.trim(),
        quantity: Number(newMaterial.quantity),
        unit: newMaterial.unit.trim(),
        reorder_level: Number(newMaterial.reorder_level),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to add material");
    }

    setFormMessage("New material added successfully!");

    setNewMaterial({
      material_name: "",
      material_type: "",
      quantity: "",
      unit: "",
      reorder_level: "",
    });

    setShowAddForm(false);
    await loadInventory();
  } catch (error) {
    setFormError(
      error instanceof Error ? error.message : "Failed to add material"
    );
  } finally {
    setSaving(false);
  }
}

async function handleRestockMaterial(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setSaving(true);
  setFormError("");
  setFormMessage("");

  try {
    const response = await fetch(
      `${API}/materials/${restockMaterialId}/restock`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity: Number(restockQuantity),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to restock material");
    }

    setFormMessage("Stock replenished successfully!");

    setRestockMaterialId("");
    setRestockQuantity("");

    setShowRestockForm(false);
    await loadInventory();
  } catch (error) {
    setFormError(
      error instanceof Error ? error.message : "Failed to restock material"
    );
  } finally {
    setSaving(false);
  }
}


  const filteredMaterials = materials.filter((material) =>
    Object.values(material).some((value) =>
      formatValue(value).toLowerCase().includes(search.toLowerCase())
    )
  );

  const materialColumns = materials.length ? Object.keys(materials[0]) : [];
  const lowStockColumns = lowStock.length ? Object.keys(lowStock[0]) : [];

  const totalMaterials =
    getNumber(analytics?.total_materials) ?? materials.length;

  const lowStockCount =
    getNumber(analytics?.low_stock_count) ?? lowStock.length;

  const outOfStockCount = getNumber(analytics?.out_of_stock_count);

  const reorderQuantity = getNumber(analytics?.total_reorder_quantity);

  return (
    <div className="min-h-screen bg-slate-50 p-5 text-slate-900 md:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Workspace / Inventory</p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-bold">
            <Package className="h-8 w-8 text-amber-600" />
            Inventory Management
          </h1>
          <p className="mt-2 text-slate-500">
            Monitor workshop materials, stock levels, and reorder requirements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
  <button
    onClick={() => {
      setShowAddForm(!showAddForm);
      setShowRestockForm(false);
      setFormError("");
      setFormMessage("");
    }}
    className="rounded-xl bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
  >
    + Add New Material
  </button>

  <button
    onClick={() => {
      setShowRestockForm(!showRestockForm);
      setShowAddForm(false);
      setFormError("");
      setFormMessage("");
    }}
    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
  >
    + Restock Material
  </button>
</div>
        <button
          onClick={loadInventory}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>
      
{/* SUCCESS AND FORM ERRORS */}
{formMessage && (
  <div className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
    {formMessage}
  </div>
)}

{formError && (
  <div className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
    {formError}
  </div>
)}

{/* ADD NEW MATERIAL FORM */}
{showAddForm && (
  <form
    onSubmit={handleAddMaterial}
    className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
  >
    <h2 className="mb-5 text-lg font-bold">
      Add New Material
    </h2>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <input
        required
        placeholder="Material name"
        value={newMaterial.material_name}
        onChange={(e) =>
          setNewMaterial({
            ...newMaterial,
            material_name: e.target.value,
          })
        }
        className="rounded-lg border p-3"
      />

      <input
        required
        placeholder="Material type"
        value={newMaterial.material_type}
        onChange={(e) =>
          setNewMaterial({
            ...newMaterial,
            material_type: e.target.value,
          })
        }
        className="rounded-lg border p-3"
      />

      <input
        required
        type="number"
        min="0"
        step="any"
        placeholder="Initial quantity"
        value={newMaterial.quantity}
        onChange={(e) =>
          setNewMaterial({
            ...newMaterial,
            quantity: e.target.value,
          })
        }
        className="rounded-lg border p-3"
      />

      <input
        required
        placeholder="Unit (kg, pieces, etc.)"
        value={newMaterial.unit}
        onChange={(e) =>
          setNewMaterial({
            ...newMaterial,
            unit: e.target.value,
          })
        }
        className="rounded-lg border p-3"
      />

      <input
        required
        type="number"
        min="0"
        step="any"
        placeholder="Reorder level"
        value={newMaterial.reorder_level}
        onChange={(e) =>
          setNewMaterial({
            ...newMaterial,
            reorder_level: e.target.value,
          })
        }
        className="rounded-lg border p-3"
      />
    </div>

    <div className="mt-5 flex gap-3">
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-amber-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Material"}
      </button>

      <button
        type="button"
        onClick={() => setShowAddForm(false)}
        className="rounded-lg border px-5 py-2.5"
      >
        Cancel
      </button>
    </div>
  </form>
)}

{/* RESTOCK MATERIAL FORM */}
{showRestockForm && (
  <form
    onSubmit={handleRestockMaterial}
    className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
  >
    <h2 className="mb-5 text-lg font-bold">
      Restock Existing Material
    </h2>

    <div className="grid gap-4 sm:grid-cols-2">
      <select
        required
        value={restockMaterialId}
        onChange={(e) => setRestockMaterialId(e.target.value)}
        className="rounded-lg border p-3"
      >
        <option value="">Select material</option>

        {materials.map((material) => (
          <option
            key={String(material.id)}
            value={String(material.id)}
          >
            {formatValue(material.material_name)} — Current stock:{" "}
            {formatValue(material.quantity)}{" "}
            {formatValue(material.unit)}
          </option>
        ))}
      </select>

      <input
        required
        type="number"
        min="0"
        step="any"
        placeholder="Additional quantity"
        value={restockQuantity}
        onChange={(e) => setRestockQuantity(e.target.value)}
        className="rounded-lg border p-3"
      />
    </div>

    <div className="mt-5 flex gap-3">
      <button
        type="submit"
        disabled={saving || materials.length === 0}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Restocking..." : "Confirm Restock"}
      </button>

      <button
        type="button"
        onClick={() => setShowRestockForm(false)}
        className="rounded-lg border px-5 py-2.5"
      >
        Cancel
      </button>
    </div>
  </form>
)}

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">Unable to load inventory data</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2">
            Confirm the backend is running and the analytics endpoint exists.
          </p>
        </div>
      )}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Total materials</p>
            <span className="rounded-xl bg-amber-50 p-3 text-amber-700">
              <Package className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold">
            {loading ? "…" : totalMaterials}
          </p>
          <p className="mt-2 text-xs text-slate-400">Material records</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-rose-700">Low-stock materials</p>
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
          <p className="mt-4 text-3xl font-bold text-rose-800">
            {loading ? "…" : lowStockCount}
          </p>
          <p className="mt-2 text-xs text-rose-600">
            At or below reorder level
          </p>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-orange-700">Out of stock</p>
            <CircleX className="h-5 w-5 text-orange-600" />
          </div>
          <p className="mt-4 text-3xl font-bold text-orange-800">
            {loading ? "…" : outOfStockCount ?? "—"}
          </p>
          <p className="mt-2 text-xs text-orange-600">Materials with zero quantity</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-500">
              Quantity to reach reorder levels
            </p>
            <Boxes className="h-5 w-5 shrink-0 text-slate-500" />
          </div>
          <p className="mt-4 text-3xl font-bold">
            {loading
              ? "…"
              : reorderQuantity === null
                ? "—"
                : reorderQuantity.toLocaleString()}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Combined quantity; units may differ
          </p>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <h2 className="font-semibold">Materials Requiring Attention</h2>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">
            Loading low-stock records...
          </p>
        ) : lowStockColumns.length === 0 ? (
          <p className="text-sm text-slate-500">
            No low-stock records returned by the API.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  {lowStockColumns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap px-3 py-3 font-medium"
                    >
                      {label(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lowStock.map((material, index) => (
                  <tr
                    key={String(material.id ?? index)}
                    className="border-b border-slate-50 last:border-0"
                  >
                    {lowStockColumns.map((column) => (
                      <td
                        key={column}
                        className="whitespace-nowrap px-3 py-3 text-slate-700"
                      >
                        {formatValue(material[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">All Materials</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search and review your workshop inventory.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search materials..."
              aria-label="Search materials"
              className="w-full bg-transparent text-sm outline-none sm:w-56"
            />
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-slate-500">
            Loading inventory...
          </p>
        ) : filteredMaterials.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            No materials found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {materialColumns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap px-4 py-3 font-medium"
                    >
                      {label(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((material, index) => (
                  <tr
                    key={String(material.id ?? index)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    {materialColumns.map((column) => (
                      <td
                        key={column}
                        className="whitespace-nowrap px-4 py-3 text-slate-700"
                      >
                        {formatValue(material[column])}
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