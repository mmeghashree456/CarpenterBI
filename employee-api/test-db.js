
const pool = require("./db");

async function testConnection() {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database_name"
    );

    console.log("Connected successfully!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:", error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
