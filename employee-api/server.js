
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3001",
}));

app.use(express.json({ limit: "1mb" }));

const pool = require("./db");
const PORT = process.env.PORT || 3000;
const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

// ---------- Shared validation helpers ----------

const isPositiveInt = (value) =>
  Number.isInteger(value) && value > 0;

const isNonNegativeNumber = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0;

const isPositiveNumber = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0;

const isValidDate = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
};

const allowedStatuses = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

const handleError = (res, error, message) => {
  console.error(`${message}:`, error.message);

  if (error.code === "23505") {
    return res.status(409).json({
      error: "A record with this unique value already exists",
    });
  }

  if (error.code === "23503") {
    return res.status(409).json({
      error: "Operation conflicts with related database records",
    });
  }

  if (error.code === "23514" || error.code === "22P02") {
    return res.status(400).json({
      error: "Invalid value supplied",
    });
  }

  return res.status(500).json({
    error: "Internal server error",
  });
};

// ==================================================
// EMPLOYEES
// ==================================================

// GET all employees
app.get("/employees", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM employees ORDER BY id"
    );

    res.json(result.rows);
  } catch (error) {
    handleError(res, error, "Fetch employees failed");
  }
});

// GET one employee
app.get("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({
      error: "Invalid employee ID",
    });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM employees WHERE id = $1",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Fetch employee failed");
  }
});

// CREATE employee
app.post("/employees", async (req, res) => {
  const {
    name,
    email,
    phone,
    experience_years,
    availability,
  } = req.body;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof email !== "string" || !email.trim()
  ) {
    return res.status(400).json({
      error: "Name and email are required",
    });
  }

  if (
    phone !== undefined &&
    phone !== null &&
    typeof phone !== "string"
  ) {
    return res.status(400).json({
      error: "Phone must be a string or null",
    });
  }

  if (
    experience_years !== undefined &&
    (!Number.isInteger(experience_years) ||
      experience_years < 0)
  ) {
    return res.status(400).json({
      error: "Experience must be a non-negative integer",
    });
  }

  if (
    availability !== undefined &&
    typeof availability !== "boolean"
  ) {
    return res.status(400).json({
      error: "Availability must be true or false",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO employees
         (name, email, phone, experience_years, availability)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        email.trim(),
        phone?.trim() || null,
        experience_years ?? 0,
        availability ?? true,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Create employee failed");
  }
});

// UPDATE employee fields
app.patch("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({
      error: "Invalid employee ID",
    });
  }

  const {
    name,
    email,
    phone,
    experience_years,
    availability,
  } = req.body;

  if (
    [name, email, phone, experience_years, availability]
      .every((value) => value === undefined)
  ) {
    return res.status(400).json({
      error: "Provide at least one field to update",
    });
  }

  if (
    (name !== undefined &&
      (typeof name !== "string" || !name.trim())) ||
    (email !== undefined &&
      (typeof email !== "string" || !email.trim()))
  ) {
    return res.status(400).json({
      error: "Name and email must be non-empty strings",
    });
  }

  if (
    phone !== undefined &&
    phone !== null &&
    (typeof phone !== "string" || !phone.trim())
  ) {
    return res.status(400).json({
      error: "Phone must be a non-empty string or null",
    });
  }

  if (
    experience_years !== undefined &&
    (!Number.isInteger(experience_years) ||
      experience_years < 0)
  ) {
    return res.status(400).json({
      error: "Experience must be a non-negative integer",
    });
  }

  if (
    availability !== undefined &&
    typeof availability !== "boolean"
  ) {
    return res.status(400).json({
      error: "Availability must be true or false",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE employees
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = CASE WHEN $3 THEN $4 ELSE phone END,
           experience_years = COALESCE($5, experience_years),
           availability = COALESCE($6, availability)
       WHERE id = $7
       RETURNING *`,
      [
        name === undefined ? null : name.trim(),
        email === undefined ? null : email.trim(),
        phone !== undefined,
        phone == null ? null : phone.trim(),
        experience_years ?? null,
        availability ?? null,
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Update employee failed");
  }
});

// DELETE employee without silently deleting work history
app.delete("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({
      error: "Invalid employee ID",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employee = await client.query(
      "SELECT id FROM employees WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (!employee.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Employee not found",
      });
    }

    const logs = await client.query(
      `SELECT 1
       FROM employee_work_logs
       WHERE employee_id = $1
       LIMIT 1`,
      [id]
    );

    if (logs.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          "Employee has work history. Preserve the record instead of deleting it.",
      });
    }

    const result = await client.query(
      "DELETE FROM employees WHERE id = $1 RETURNING *",
      [id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Employee deleted successfully",
      employee: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    handleError(res, error, "Delete employee failed");
  } finally {
    client.release();
  }
});

// ==================================================
// EMPLOYEE WORK LOGS
// ==================================================

// GET work logs, optionally filtered by employee_id or order_id
app.get("/work-logs", async (req, res) => {
  const { employee_id, order_id } = req.query;

  if (
    employee_id !== undefined &&
    (!/^\d+$/.test(employee_id) ||
      !isPositiveInt(Number(employee_id)))
  ) {
    return res.status(400).json({
      error: "Invalid employee_id",
    });
  }

  if (
    order_id !== undefined &&
    (!/^\d+$/.test(order_id) ||
      !isPositiveInt(Number(order_id)))
  ) {
    return res.status(400).json({
      error: "Invalid order_id",
    });
  }

  try {
    const result = await pool.query(
      `SELECT wl.*, e.name AS employee_name
       FROM employee_work_logs wl
       JOIN employees e ON e.id = wl.employee_id
       WHERE ($1::integer IS NULL OR wl.employee_id = $1)
         AND ($2::integer IS NULL OR wl.order_id = $2)
       ORDER BY wl.work_date DESC, wl.id DESC`,
      [
        employee_id === undefined ? null : Number(employee_id),
        order_id === undefined ? null : Number(order_id),
      ]
    );

    res.json(result.rows);
  } catch (error) {
    handleError(res, error, "Fetch work logs failed");
  }
});

// GET one employee's work history
app.get("/employees/:id/work-logs", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({
      error: "Invalid employee ID",
    });
  }

  try {
    const employee = await pool.query(
      "SELECT id FROM employees WHERE id = $1",
      [id]
    );

    if (!employee.rows.length) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM employee_work_logs
       WHERE employee_id = $1
       ORDER BY work_date DESC, id DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    handleError(res, error, "Fetch employee work logs failed");
  }
});

// CREATE employee work log
app.post("/employees/:id/work-logs", async (req, res) => {
  const employeeId = Number(req.params.id);
  const {
    order_id,
    hours_worked,
    work_date,
    task_description,
  } = req.body;

  if (!isPositiveInt(employeeId)) {
    return res.status(400).json({
      error: "Invalid employee ID",
    });
  }

  if (!isPositiveNumber(hours_worked)) {
    return res.status(400).json({
      error: "hours_worked must be a positive number",
    });
  }

  if (
    order_id !== undefined &&
    order_id !== null &&
    !isPositiveInt(order_id)
  ) {
    return res.status(400).json({
      error: "order_id must be a positive integer or null",
    });
  }

  if (
    work_date !== undefined &&
    !isValidDate(work_date)
  ) {
    return res.status(400).json({
      error: "work_date must be a valid YYYY-MM-DD date",
    });
  }

  if (
    task_description !== undefined &&
    task_description !== null &&
    typeof task_description !== "string"
  ) {
    return res.status(400).json({
      error: "task_description must be a string or null",
    });
  }

  try {
    const employee = await pool.query(
      "SELECT id FROM employees WHERE id = $1",
      [employeeId]
    );

    if (!employee.rows.length) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    if (order_id != null) {
      const order = await pool.query(
        "SELECT id FROM orders WHERE id = $1",
        [order_id]
      );

      if (!order.rows.length) {
        return res.status(404).json({
          error: "Order not found",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO employee_work_logs
         (employee_id, order_id, hours_worked, work_date, task_description)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5)
       RETURNING *`,
      [
        employeeId,
        order_id ?? null,
        hours_worked,
        work_date ?? null,
        task_description?.trim() || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Create work log failed");
  }
});

// MATERIALS
// ==================================================

// GET all materials
app.get("/materials", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM materials ORDER BY id"
    );

    res.json(result.rows);
  } catch (error) {
    handleError(res, error, "Fetch materials failed");
  }
});

// GET low-stock materials — before /materials/:id
app.get("/materials/low-stock", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, material_name, material_type,
              quantity, unit, reorder_level
       FROM materials
       WHERE quantity <= reorder_level
       ORDER BY quantity ASC, id`
    );

    res.json(result.rows);
  } catch (error) {
    handleError(res, error, "Fetch low-stock materials failed");
  }
});

// GET one material
app.get("/materials/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({ error: "Invalid material ID" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM materials WHERE id = $1",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Material not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Fetch material failed");
  }
});

// CREATE material
app.post("/materials", async (req, res) => {
  const { material_name, material_type, quantity, unit, reorder_level } =
    req.body;

  if (
    typeof material_name !== "string" || !material_name.trim() ||
    typeof material_type !== "string" || !material_type.trim() ||
    typeof unit !== "string" || !unit.trim()
  ) {
    return res.status(400).json({
      error: "Material name, type, and unit are required",
    });
  }

  if (
    (quantity !== undefined && !isNonNegativeNumber(quantity)) ||
    (reorder_level !== undefined && !isNonNegativeNumber(reorder_level))
  ) {
    return res.status(400).json({
      error: "Quantity and reorder_level must be non-negative numbers",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO materials
         (material_name, material_type, quantity, unit, reorder_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        material_name.trim(),
        material_type.trim(),
        quantity ?? 0,
        unit.trim(),
        reorder_level ?? 0,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Create material failed");
  }
});

// UPDATE material
app.patch("/materials/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({ error: "Invalid material ID" });
  }

  const { material_name, material_type, quantity, unit, reorder_level } =
    req.body;

  if (
    [material_name, material_type, quantity, unit, reorder_level]
      .every((value) => value === undefined)
  ) {
    return res.status(400).json({
      error: "Provide at least one field to update",
    });
  }

  if (
    (material_name !== undefined &&
      (typeof material_name !== "string" || !material_name.trim())) ||
    (material_type !== undefined &&
      (typeof material_type !== "string" || !material_type.trim())) ||
    (unit !== undefined &&
      (typeof unit !== "string" || !unit.trim()))
  ) {
    return res.status(400).json({
      error: "Name, type, and unit must be non-empty strings",
    });
  }

  if (
    (quantity !== undefined && !isNonNegativeNumber(quantity)) ||
    (reorder_level !== undefined && !isNonNegativeNumber(reorder_level))
  ) {
    return res.status(400).json({
      error: "Quantity and reorder_level must be non-negative numbers",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE materials
       SET material_name = COALESCE($1, material_name),
           material_type = COALESCE($2, material_type),
           quantity = COALESCE($3, quantity),
           unit = COALESCE($4, unit),
           reorder_level = COALESCE($5, reorder_level),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        material_name === undefined ? null : material_name.trim(),
        material_type === undefined ? null : material_type.trim(),
        quantity ?? null,
        unit === undefined ? null : unit.trim(),
        reorder_level ?? null,
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Material not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Update material failed");
  }
});

// RESTOCK material
app.post("/materials/:id/restock", async (req, res) => {
  const id = Number(req.params.id);
  const { quantity } = req.body;

  if (!isPositiveInt(id)) {
    return res.status(400).json({ error: "Invalid material ID" });
  }

  if (!isPositiveNumber(quantity)) {
    return res.status(400).json({
      error: "Restock quantity must be a positive number",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE materials
       SET quantity = quantity + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [quantity, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Material not found" });
    }

    res.json({
      message: "Stock replenished successfully",
      material: result.rows[0],
    });
  } catch (error) {
    handleError(res, error, "Restock material failed");
  }
});

// DELETE material — foreign key usage is preserved
app.delete("/materials/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({ error: "Invalid material ID" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM materials WHERE id = $1 RETURNING *",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Material not found" });
    }

    res.json({
      message: "Material deleted successfully",
      material: result.rows[0],
    });
  } catch (error) {
    handleError(res, error, "Delete material failed");
  }
});

// ==================================================
// ==================================================
// ORDERS AND ORDER ITEMS
// ==================================================

const orderSelect = `
  SELECT
    o.*,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price
        )
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::jsonb
    ) AS items
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
`;

// GET orders and their items
app.get("/orders", async (req, res) => {
  try {
    const result = await pool.query(
      `${orderSelect} GROUP BY o.id ORDER BY o.id DESC`
    );

    res.json(result.rows);
  } catch (error) {
    handleError(res, error, "Fetch orders failed");
  }
});

// GET one order and its items
app.get("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  try {
    const result = await pool.query(
      `${orderSelect} WHERE o.id = $1 GROUP BY o.id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Fetch order failed");
  }
});

// GET one order item
app.get("/order-items/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({ error: "Invalid order item ID" });
  }

  try {
    const result = await pool.query(
      `SELECT oi.*, o.status AS order_status, o.due_date
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order item not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Fetch order item failed");
  }
});

// CREATE order and items atomically
app.post("/orders", async (req, res) => {
  const { items, due_date } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "At least one order item is required",
    });
  }

  if (
    due_date !== undefined &&
    due_date !== null &&
    !isValidDate(due_date)
  ) {
    return res.status(400).json({
      error: "due_date must be a valid YYYY-MM-DD date",
    });
  }

  for (const item of items) {
    if (
      !item ||
      typeof item.product_name !== "string" ||
      !item.product_name.trim() ||
      !isPositiveInt(item.quantity) ||
      !isNonNegativeNumber(item.unit_price)
    ) {
      return res.status(400).json({
        error:
          "Each item needs a product name, positive integer quantity, and non-negative unit price",
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `INSERT INTO orders (due_date)
       VALUES ($1)
       RETURNING *`,
      [due_date ?? null]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items
           (order_id, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [
          order.id,
          item.product_name.trim(),
          item.quantity,
          item.unit_price,
        ]
      );
    }

    const updatedOrder = await client.query(
      `UPDATE orders
       SET total_amount = (
         SELECT COALESCE(SUM(quantity * unit_price), 0)
         FROM order_items
         WHERE order_id = $1
       )
       WHERE id = $1
       RETURNING *`,
      [order.id]
    );

    const savedItems = await client.query(
      `SELECT id, product_name, quantity, unit_price
       FROM order_items
       WHERE order_id = $1
       ORDER BY id`,
      [order.id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      ...updatedOrder.rows[0],
      items: savedItems.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    handleError(res, error, "Create order failed");
  } finally {
    client.release();
  }
});

// UPDATE order status
app.patch("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!isPositiveInt(id)) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid status",
      allowed: allowedStatuses,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Update order failed");
  }
});
// MATERIAL USAGE
// ==================================================

// GET material usage for an order item
app.get("/order-items/:id/materials", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({ error: "Invalid order item ID" });
  }

  try {
    const item = await pool.query(
      "SELECT id FROM order_items WHERE id = $1",
      [id]
    );

    if (!item.rows.length) {
      return res.status(404).json({ error: "Order item not found" });
    }

    const result = await pool.query(
      `SELECT oim.id, oim.order_item_id, oim.material_id,
              m.material_name, m.unit,
              oim.quantity_used, oim.recorded_at
       FROM order_item_materials oim
       JOIN materials m ON m.id = oim.material_id
       WHERE oim.order_item_id = $1
       ORDER BY oim.id`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    handleError(res, error, "Fetch item material usage failed");
  }
});

// RECORD material usage and deduct stock atomically
app.post("/order-items/:id/materials", async (req, res) => {
  const orderItemId = Number(req.params.id);
  const { material_id, quantity_used } = req.body;

  if (!isPositiveInt(orderItemId)) {
    return res.status(400).json({ error: "Invalid order item ID" });
  }

  if (!isPositiveInt(material_id)) {
    return res.status(400).json({
      error: "material_id must be a positive integer",
    });
  }

  if (!isPositiveNumber(quantity_used)) {
    return res.status(400).json({
      error: "quantity_used must be a positive number",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const item = await client.query(
      "SELECT id FROM order_items WHERE id = $1 FOR UPDATE",
      [orderItemId]
    );

    if (!item.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order item not found" });
    }

    const stock = await client.query(
      `UPDATE materials
       SET quantity = quantity - $1, updated_at = NOW()
       WHERE id = $2 AND quantity >= $1
       RETURNING id, material_name, quantity, unit`,
      [quantity_used, material_id]
    );

    if (!stock.rows.length) {
      const material = await client.query(
        "SELECT id FROM materials WHERE id = $1",
        [material_id]
      );

      await client.query("ROLLBACK");

      if (!material.rows.length) {
        return res.status(404).json({ error: "Material not found" });
      }

      return res.status(409).json({ error: "Insufficient stock" });
    }

    const usage = await client.query(
      `INSERT INTO order_item_materials
         (order_item_id, material_id, quantity_used)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [orderItemId, material_id, quantity_used]
    );

    await client.query("COMMIT");

    res.status(201).json({
      usage: usage.rows[0],
      material: stock.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    handleError(res, error, "Record material usage failed");
  } finally {
    client.release();
  }
});

// GET material usage for an order
app.get("/orders/:id/material-usage", async (req, res) => {
  const orderId = Number(req.params.id);

  if (!isPositiveInt(orderId)) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  try {
    const order = await pool.query(
      "SELECT id FROM orders WHERE id = $1",
      [orderId]
    );

    if (!order.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    const result = await pool.query(
      `SELECT
         o.id AS order_id,
         oi.id AS order_item_id,
         oi.product_name,
         m.id AS material_id,
         m.material_name,
         m.unit,
         oim.quantity_used,
         oim.recorded_at
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN order_item_materials oim
         ON oim.order_item_id = oi.id
       JOIN materials m ON m.id = oim.material_id
       WHERE o.id = $1
       ORDER BY oi.id, oim.recorded_at`,
      [orderId]
    );

    res.json(result.rows);
  } catch (error) {
    handleError(res, error, "Fetch order material usage failed");
  }
});

// ==================================================
// ==================================================
// DASHBOARD
// ==================================================

app.get("/dashboard", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM employees) AS total_employees,
        (SELECT COUNT(*) FROM employees
         WHERE availability = TRUE) AS available_employees,
        (SELECT COUNT(*) FROM materials) AS total_materials,
        (SELECT COUNT(*) FROM materials
         WHERE quantity <= reorder_level) AS low_stock_materials,
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COUNT(*) FROM orders
         WHERE status = 'pending') AS pending_orders,
        (SELECT COUNT(*) FROM orders
         WHERE status = 'completed') AS completed_orders
    `);

    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, "Fetch dashboard failed");
  }
});

/**
 * POST /recommendations/worker
 *
 * Transparent ranking baseline — not an ML probability.
 * Uses currently available employees, experience and work-log
 * task descriptions to rank candidates for an existing order.
 */

app.post("/recommendations/worker", async (req, res) => {
  const orderId = req.body?.order_id;

  if (!isPositiveInt(orderId)) {
    return res.status(400).json({
      error: "order_id must be a positive integer",
    });
  }

  try {
    // 1. Fetch the order.
    const orderResult = await pool.query(
      `SELECT id, status, due_date
       FROM orders
       WHERE id = $1`,
      [orderId]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    // 2. Fetch its products.
    const itemsResult = await pool.query(
      `SELECT product_name, quantity
       FROM order_items
       WHERE order_id = $1
       ORDER BY id`,
      [orderId]
    );

    if (!itemsResult.rows.length) {
      return res.status(400).json({
        error: "The order has no items",
      });
    }

    const taskType = itemsResult.rows
      .map((item) => item.product_name)
      .join(" ");

    // 3. Fetch available employees and their work history.
    const employeesResult = await pool.query(
      `SELECT
         e.id AS employee_id,
         e.name AS employee_name,
         e.experience_years,
         COUNT(wl.id)::int AS total_work_logs,
         COALESCE(
           AVG(wl.hours_worked),
           0
         )::float AS average_previous_hours,
         COALESCE(
           STRING_AGG(
             DISTINCT wl.task_description,
             ' '
           ),
           ''
         ) AS task_history
       FROM employees e
       LEFT JOIN employee_work_logs wl
         ON wl.employee_id = e.id
       WHERE e.availability = TRUE
       GROUP BY e.id, e.name, e.experience_years
       ORDER BY e.id`
    );

    if (!employeesResult.rows.length) {
      return res.status(409).json({
        error: "No available employees",
      });
    }

    // 4. Request an ML duration estimate for each employee.
    const predictions = await Promise.all(
      employeesResult.rows.map(async (employee) => {
        const response = await fetch(
          `${ML_SERVICE_URL}/predictions/worker-duration`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              experience_years:
                Number(employee.experience_years) || 0,
              previous_task_count:
                Number(employee.total_work_logs) || 0,
              average_previous_hours:
                Number(employee.average_previous_hours) || 0,
              task_type: taskType,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Worker ML service returned HTTP ${response.status}`
          );
        }

        const prediction = await response.json();

        return {
          employee,
          predictedHours: prediction.predicted_hours,
        };
      })
    );

    // 5. Rank by predicted duration and relevant task history.
    const normalizeWords = (value) =>
      String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2);

    const productWords = [
      ...new Set(normalizeWords(taskType)),
    ];

    const ranked = predictions.map(
      ({ employee, predictedHours }) => {
        const historyWords = new Set(
          normalizeWords(employee.task_history)
        );

        const matchingWords = productWords.filter((word) =>
          historyWords.has(word)
        );

        const experience =
          Number(employee.experience_years) || 0;

        const historyScore =
          productWords.length > 0
            ? (matchingWords.length / productWords.length) * 50
            : 0;

        // Lower predicted duration produces a higher duration score.
        // This is a ranking formula, not a probability.
        const durationScore =
          50 / (1 + Math.max(predictedHours, 0));

        const score = Math.round(
          Math.min(100, historyScore + durationScore)
        );

        const reasons = [
          `ML-estimated task duration: ${predictedHours} hours`,
          `${experience} years of experience`,
        ];

        if (matchingWords.length) {
          reasons.push(
            `Relevant task history: ${matchingWords.join(", ")}`
          );
        } else {
          reasons.push("No matching task keywords found");
        }

        return {
          employee_id: employee.employee_id,
          employee_name: employee.employee_name,
          score,
          predicted_hours: predictedHours,
          reason: reasons.join("; "),
          experience_years: experience,
          relevant_task_matches: matchingWords,
          total_work_logs: Number(employee.total_work_logs),
        };
      }
    );

    ranked.sort(
      (a, b) =>
        a.predicted_hours - b.predicted_hours ||
        b.score - a.score ||
        b.experience_years - a.experience_years
    );

    return res.json({
      order_id: orderId,
      recommendations: ranked,
      ranking_method: "ml_duration_plus_task_history",
      score_type: "heuristic_ranking_score_not_probability",
      prediction_type: "estimated_task_duration",
      warning:
        "Prototype model trained on a small dataset. Validate estimates before operational use.",
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Worker recommendation failed:", error.message);

    return res.status(503).json({
      error: "Could not generate worker recommendations",
      details: error.message,
      hint:
        "Check that PostgreSQL, Express, and FastAPI are running.",
    });
  }
});
// ==================================================
// TASK ASSIGNMENTS
// ==================================================

// GET assignments
// Optional filters: /task-assignments?order_id=1&employee_id=2
app.get("/task-assignments", async (req, res) => {
  const { order_id, employee_id } = req.query;

  if (
    order_id !== undefined &&
    (!/^\d+$/.test(order_id) || !isPositiveInt(Number(order_id)))
  ) {
    return res.status(400).json({ error: "Invalid order_id" });
  }

  if (
    employee_id !== undefined &&
    (!/^\d+$/.test(employee_id) ||
      !isPositiveInt(Number(employee_id)))
  ) {
    return res.status(400).json({ error: "Invalid employee_id" });
  }

  try {
    const result = await pool.query(
      `SELECT
         ta.*,
         e.name AS employee_name,
         o.status AS order_status
       FROM task_assignments ta
       JOIN employees e ON e.id = ta.employee_id
       JOIN orders o ON o.id = ta.order_id
       WHERE ($1::integer IS NULL OR ta.order_id = $1)
         AND ($2::integer IS NULL OR ta.employee_id = $2)
       ORDER BY ta.assigned_at DESC, ta.id DESC`,
      [
        order_id === undefined ? null : Number(order_id),
        employee_id === undefined ? null : Number(employee_id),
      ]
    );

    return res.json(result.rows);
  } catch (error) {
    if (error.code === "42P01") {
      return res.status(500).json({
        error:
          "task_assignments table does not exist. Run the supplied SQL setup first.",
      });
    }

    return handleError(res, error, "Fetch task assignments failed");
  }
});

// GET one assignment
app.get("/task-assignments/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!isPositiveInt(id)) {
    return res.status(400).json({ error: "Invalid assignment ID" });
  }

  try {
    const result = await pool.query(
      `SELECT
         ta.*,
         e.name AS employee_name,
         o.status AS order_status
       FROM task_assignments ta
       JOIN employees e ON e.id = ta.employee_id
       JOIN orders o ON o.id = ta.order_id
       WHERE ta.id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Task assignment not found",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === "42P01") {
      return res.status(500).json({
        error:
          "task_assignments table does not exist. Run the supplied SQL setup first.",
      });
    }

    return handleError(res, error, "Fetch task assignment failed");
  }
});

// CREATE assignment
app.post("/task-assignments", async (req, res) => {
  const {
    order_id,
    employee_id,
    task_description,
    due_date,
  } = req.body ?? {};




  if (!isPositiveInt(order_id)) {
    return res.status(400).json({
      error: "order_id must be a positive integer",
    });
  }

  if (!isPositiveInt(employee_id)) {
    return res.status(400).json({
      error: "employee_id must be a positive integer",
    });
  }

  if (
    typeof task_description !== "string" ||
    !task_description.trim() ||
    task_description.trim().length > 500
  ) {
    return res.status(400).json({
      error:
        "task_description is required and must be at most 500 characters",
    });
  }

  if (
    due_date !== undefined &&
    due_date !== null &&
    due_date !== "" &&
    !isValidDate(due_date)
  ) {
    return res.status(400).json({
      error: "due_date must be a valid YYYY-MM-DD date or null",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify the order exists and is not cancelled.
    const orderResult = await client.query(
      "SELECT id, status FROM orders WHERE id = $1 FOR UPDATE",
      [order_id]
    );

    if (!orderResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Order not found",
      });
    }

    if (orderResult.rows[0].status === "cancelled") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "Cannot assign a task to a cancelled order",
      });
    }

    // Verify the employee exists and is available.
    const employeeResult = await client.query(
      `SELECT id, name, availability
       FROM employees
       WHERE id = $1
       FOR UPDATE`,
      [employee_id]
    );

    if (!employeeResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Employee not found",
      });
    }

    if (!employeeResult.rows[0].availability) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "This employee is currently unavailable",
      });
    }

    // Save the assignment.
    const result = await client.query(
      `INSERT INTO task_assignments
         (order_id, employee_id, task_description, due_date, status)
       VALUES ($1, $2, $3, $4, 'assigned')
       RETURNING *`,
      [
        order_id,
        employee_id,
        task_description.trim(),
        due_date || null,
      ]
    );
    
    await client.query(
      `UPDATE orders
      SET status = 'in_progress'
      WHERE id = $1
        AND status = 'pending'`,
      [order_id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Task assigned successfully",
      assignment: {
        ...result.rows[0],
        employee_name: employeeResult.rows[0].name,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    if (error.code === "42P01") {
      return res.status(500).json({
        error:
          "task_assignments table does not exist. Run the supplied SQL setup first.",
      });
    }

    return handleError(res, error, "Create task assignment failed");
  } finally {
    client.release();
  }
});

// UPDATE assignment status
app.patch("/task-assignments/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body ?? {};

  const validAssignmentStatuses = [
    "assigned",
    "in_progress",
    "completed",
    "cancelled",
  ];

  if (!isPositiveInt(id)) {
    return res.status(400).json({
      error: "Invalid assignment ID",
    });
  }

  if (!validAssignmentStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid assignment status",
      allowed: validAssignmentStatuses,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE task_assignments
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Task assignment not found",
      });
    }

    return res.json({
      message: "Task assignment status updated",
      assignment: result.rows[0],
    });
  } catch (error) {
    if (error.code === "42P01") {
      return res.status(500).json({
        error:
          "task_assignments table does not exist. Run the supplied SQL setup first.",
      });
    }

    return handleError(res, error, "Update task assignment failed");
  }
});

// ==================================================
// ==================================================
// GLOBAL ERROR HANDLER
// ==================================================

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "Internal server error",
  });
});

app.get("/analytics/inventory", async (req, res) => {
  console.log("HIT /analytics/inventory");
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total_materials,

        COUNT(*) FILTER (
          WHERE quantity <= reorder_level
        )::int AS low_stock_count,

        COUNT(*) FILTER (
          WHERE quantity = 0
        )::int AS out_of_stock_count,

        COALESCE(
          SUM(GREATEST(reorder_level - quantity, 0)),
          0
        ) AS total_reorder_quantity

      FROM materials
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Inventory analytics failed:", error);

    res.status(500).json({
      error: "Failed to fetch inventory analytics",
    });
  }
});

// ==================================================
// SERVER STARTUP
// ==================================================

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});