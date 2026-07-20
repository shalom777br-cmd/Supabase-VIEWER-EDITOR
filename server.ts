import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Session password checker helper
function verifyAuth(req: express.Request) {
  const authHeader = req.headers["authorization"] || req.headers["x-admin-password"];
  let password = "";
  if (authHeader) {
    if (typeof authHeader === "string") {
      if (authHeader.startsWith("Bearer ")) {
        password = authHeader.substring(7);
      } else {
        password = authHeader;
      }
    }
  }

  const expected = process.env.VIEWER_PASSWORD || "admin";
  if (!password || password !== expected) {
    throw new Error("Unauthorized: Invalid or missing administrator password.");
  }
}

// Lazy Supabase client initialization
let supabaseClient: any = null;
function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are missing.");
    }
    supabaseClient = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Health & Connection Verification Endpoint
app.get("/api/health", async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL;
    const keySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const passwordSet = !!process.env.VIEWER_PASSWORD;

    if (!url || !keySet) {
      return res.status(200).json({
        status: "misconfigured",
        message: "Supabase URL or Service Role Key is not configured in environment variables.",
        url: url || null,
        passwordSet,
      });
    }

    // Try a simple connection verification by fetching schema
    const client = getSupabase();
    // Test fetch to see if Supabase responds
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY!,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase REST connection failed: ${response.statusText}`);
    }

    const openApiSpec: any = await response.json();
    const tableCount = Object.keys(openApiSpec.definitions || {}).length;

    console.log(`[VERIFICATION SUCCESS] Successfully connected to Supabase. Discovered ${tableCount} tables.`);

    res.json({
      status: "connected",
      message: `Successfully authenticated & connected to Supabase. Found ${tableCount} tables.`,
      url,
      tableCount,
      passwordSet,
    });
  } catch (err: any) {
    console.error("[VERIFICATION FAILED]", err.message);
    res.status(200).json({
      status: "error",
      message: `Connection test failed: ${err.message}`,
      url: process.env.SUPABASE_URL || null,
      passwordSet: !!process.env.VIEWER_PASSWORD,
    });
  }
});

// 2. Auth verification endpoint
app.post("/api/auth/verify", (req, res) => {
  try {
    verifyAuth(req);
    res.json({ success: true, message: "Authentication verified." });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// 3. Schema Discovery (tables and columns)
app.get("/api/schema", async (req, res) => {
  try {
    verifyAuth(req);
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      return res.status(400).json({ error: "Supabase environment variables not configured." });
    }

    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI definition: ${response.statusText}`);
    }

    const openApiSpec: any = await response.json();
    const definitions = openApiSpec.definitions || {};

    const schemas = Object.keys(definitions).map((tableName) => {
      const def = definitions[tableName];
      const properties = def.properties || {};
      const requiredList = def.required || [];

      const columns = Object.keys(properties).map((colName) => {
        const colDef = properties[colName];
        return {
          name: colName,
          type: colDef.type || "string",
          required: requiredList.includes(colName),
          description: colDef.description || "",
          format: colDef.format || "",
        };
      });

      const hasUserId = columns.some((col) => col.name === "user_id");

      return {
        name: tableName,
        columns,
        hasUserId,
      };
    });

    res.json({ tables: schemas });
  } catch (err: any) {
    console.error("Schema fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. List Table Rows (with Search, Filtering, and Pagination)
app.post("/api/table/:tableName/query", async (req, res) => {
  try {
    verifyAuth(req);
    const { tableName } = req.params;
    const { page = 1, pageSize = 50, search = "", filters = {}, columns = [], hasUserId = false } = req.body;

    const supabase = getSupabase();
    let query = supabase.from(tableName).select("*", { count: "exact" });

    // 1. user_id dynamic filtering
    if (hasUserId) {
      query = query.eq("user_id", "5fb13a09-5ce3-4aec-bb4e-8e357070b76b");
    }

    // 2. Dropdown / Column Filters
    if (filters && typeof filters === "object") {
      for (const [col, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== "") {
          query = query.eq(col, val);
        }
      }
    }

    // 3. Keyword Search (Across string/text columns)
    if (search && typeof search === "string" && search.trim() !== "") {
      const searchTerm = search.trim();
      // Filter out only text/string columns to perform dynamic OR searches
      const stringCols = columns
        .filter((col: any) => col.type === "string")
        .map((col: any) => col.name);

      if (stringCols.length > 0) {
        const orConditions = stringCols.map((col: string) => `${col}.ilike.%${searchTerm}%`).join(",");
        query = query.or(orConditions);
      }
    }

    // 4. Pagination Range
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;
    query = query.range(from, to);

    // Apply basic order (prefer id, created_at, or first column, descending)
    const colNames = columns.map((c: any) => c.name);
    if (colNames.includes("id")) {
      query = query.order("id", { ascending: false });
    } else if (colNames.includes("created_at")) {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Diagnostics: Calculate total records in table (without user_id filter) to provide user guidance
    let unfilteredCount = 0;
    if (hasUserId) {
      try {
        const diagQuery = supabase.from(tableName).select("*", { count: "exact", head: true });
        const { count: diagCount } = await diagQuery;
        unfilteredCount = diagCount || 0;
      } catch (err) {
        unfilteredCount = 0;
      }
    } else {
      unfilteredCount = count || 0;
    }

    res.json({
      data: data || [],
      count: count || 0,
      unfilteredCount,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error(`Query error for table ${req.params.tableName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Get Unique Column Values (for filtering dropdowns like category, importance)
app.post("/api/table/:tableName/unique-values", async (req, res) => {
  try {
    verifyAuth(req);
    const { tableName } = req.params;
    const { columnName, hasUserId = false } = req.body;

    const supabase = getSupabase();
    let query = supabase.from(tableName).select(columnName);

    if (hasUserId) {
      query = query.eq("user_id", "5fb13a09-5ce3-4aec-bb4e-8e357070b76b");
    }

    // Limit to fetch up to 1000 records to extract unique values
    const { data, error } = await query.limit(1000);

    if (error) {
      throw error;
    }

    const values = Array.from(
      new Set(
        (data || [])
          .map((row: any) => row[columnName])
          .filter((val) => val !== null && val !== undefined && val !== "")
      )
    ).sort();

    res.json({ values });
  } catch (err: any) {
    console.error(`Unique values fetch error for ${req.params.tableName}.${req.body.columnName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Update Row
app.post("/api/table/:tableName/update", async (req, res) => {
  try {
    verifyAuth(req);
    const { tableName } = req.params;
    const { match, changes, hasUserId = false } = req.body;

    if (!match || !changes) {
      return res.status(400).json({ error: "Both match conditions and changes are required." });
    }

    const supabase = getSupabase();
    let query = supabase.from(tableName).update(changes);

    // Apply matches
    for (const [key, val] of Object.entries(match)) {
      query = query.eq(key, val);
    }

    // Security block
    if (hasUserId) {
      query = query.eq("user_id", "5fb13a09-5ce3-4aec-bb4e-8e357070b76b");
    }

    const { data, error } = await query.select();

    if (error) {
      throw error;
    }

    res.json({ success: true, data });
  } catch (err: any) {
    console.error(`Update error for table ${req.params.tableName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Insert Row
app.post("/api/table/:tableName/insert", async (req, res) => {
  try {
    verifyAuth(req);
    const { tableName } = req.params;
    const { record, hasUserId = false } = req.body;

    if (!record) {
      return res.status(400).json({ error: "Record data is required." });
    }

    // Enforce user_id isolation if column exists
    if (hasUserId) {
      record.user_id = "5fb13a09-5ce3-4aec-bb4e-8e357070b76b";
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.from(tableName).insert(record).select();

    if (error) {
      throw error;
    }

    res.json({ success: true, data });
  } catch (err: any) {
    console.error(`Insert error for table ${req.params.tableName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Delete Row(s) (supports single or bulk delete)
app.post("/api/table/:tableName/delete", async (req, res) => {
  try {
    verifyAuth(req);
    const { tableName } = req.params;
    const { rows, hasUserId = false } = req.body; // array of match objects, e.g. [{id: 1}, {id: 2}]

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "An array of match objects to delete is required." });
    }

    const supabase = getSupabase();
    const deletedCount = rows.length;

    for (const match of rows) {
      let query = supabase.from(tableName).delete();
      for (const [key, val] of Object.entries(match)) {
        query = query.eq(key, val);
      }
      if (hasUserId) {
        query = query.eq("user_id", "5fb13a09-5ce3-4aec-bb4e-8e357070b76b");
      }
      const { error } = await query;
      if (error) {
        throw error;
      }
    }

    res.json({ success: true, message: `Successfully deleted ${deletedCount} record(s).` });
  } catch (err: any) {
    console.error(`Delete error for table ${req.params.tableName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// 9. Scan entire table for duplicates in content or title columns (returns duplicate values and row counts)
app.post("/api/table/:tableName/scan-duplicates", async (req, res) => {
  try {
    verifyAuth(req);
    const { tableName } = req.params;
    const { columns, hasUserId = false } = req.body;

    const colNames = columns.map((c: any) => c.name);
    const targetCols = ["content", "title"].filter((colName) => colNames.includes(colName));

    if (targetCols.length === 0) {
      return res.json({ targetColumns: [], duplicates: {} });
    }

    const supabase = getSupabase();
    // Select the necessary columns to compute duplicates
    const selectStr = ["id", ...targetCols].join(",");
    let query = supabase.from(tableName).select(selectStr);

    if (hasUserId) {
      query = query.eq("user_id", "5fb13a09-5ce3-4aec-bb4e-8e357070b76b");
    }

    const { data, error } = await query.limit(2000); // scan first 2000 records for duplicates

    if (error) {
      throw error;
    }

    const duplicates: Record<string, { value: string; ids: any[]; count: number }[]> = {};

    targetCols.forEach((col) => {
      const valueMap = new Map<string, any[]>();
      (data || []).forEach((row: any) => {
        const val = row[col];
        if (val !== null && val !== undefined && String(val).trim() !== "") {
          const key = String(val).trim();
          if (!valueMap.has(key)) {
            valueMap.set(key, []);
          }
          valueMap.get(key)!.push(row.id);
        }
      });

      const colDuplicates: { value: string; ids: any[]; count: number }[] = [];
      valueMap.forEach((ids, value) => {
        if (ids.length > 1) {
          colDuplicates.push({
            value,
            ids,
            count: ids.length,
          });
        }
      });

      if (colDuplicates.length > 0) {
        duplicates[col] = colDuplicates.sort((a, b) => b.count - a.count);
      }
    });

    res.json({
      targetColumns: targetCols,
      duplicates,
    });
  } catch (err: any) {
    console.error(`Duplicate scan error for ${req.params.tableName}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Vite and Static Assets serving setup
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER RUNNING] Supabase Generic Viewer running on http://localhost:${PORT}`);
  });
}

startServer();
