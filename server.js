const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "cse-study-hub";

if (!ADMIN_PASSWORD) console.warn("WARNING: ADMIN_PASSWORD is not set.");
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn("WARNING: SUPABASE_URL or SUPABASE_SECRET_KEY is not set.");
}

const supabase = SUPABASE_URL && SUPABASE_SECRET_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Files are kept in memory only long enough to upload them to Supabase.
// Supabase is the persistent storage layer; Render's local disk is not used.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 500, fileSize: 1024 * 1024 * 1024 }
});

function safePath(value = "") {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => part !== "." && part !== "..")
    .join("/");
}

function safeFileName(name = "file") {
  return path.basename(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "file";
}

function storagePath(folder, originalName) {
  const relative = safePath(originalName);
  const dir = path.posix.dirname(relative);
  const name = safeFileName(path.posix.basename(relative));
  return [safePath(folder), dir === "." ? "" : safePath(dir), name]
    .filter(Boolean)
    .join("/");
}

function publicUrl(filePath) {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${encoded}`;
}

function requireStorage(res) {
  if (!supabase) {
    res.status(500).json({
      error: "Supabase Storage is not configured. Check SUPABASE_URL and SUPABASE_SECRET_KEY."
    });
    return false;
  }
  return true;
}

const sessions = new Set();

function auth(req, res, next) {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, "") ||
    req.headers["x-admin-token"];

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

async function listAll(prefix = "", depth = 0) {
  if (depth > 20) return [];

  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" }
  });
  if (error) throw error;

  const result = [];
  for (const item of data || []) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;

    // Supabase returns folders without an id; files have an id.
    if (item.id) {
      result.push({
        id: itemPath,
        name: item.name,
        folder: itemPath.includes("/") ? itemPath.split("/").slice(0, -1).join("/") : "General",
        path: itemPath,
        size: Number(item.metadata?.size || 0),
        uploadedAt: item.created_at || item.updated_at || null,
        url: publicUrl(itemPath)
      });
    } else {
      result.push(...await listAll(itemPath, depth + 1));
    }
  }
  return result;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, storageConfigured: !!supabase, bucket: BUCKET });
});

app.get("/api/files", async (req, res) => {
  if (!requireStorage(res)) return;
  try {
    const files = await listAll();
    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Could not load files" });
  }
});

app.post("/api/login", (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ADMIN_PASSWORD is not configured." });
  }
  if (req.body?.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.add(token);
  res.json({ ok: true, token });
});

app.post("/api/upload", auth, upload.array("files", 500), async (req, res) => {
  if (!requireStorage(res)) return;
  if (!req.files?.length) return res.status(400).json({ error: "No files selected." });

  const folder = safePath(req.body?.folder || "");
  const added = [];

  try {
    for (const file of req.files) {
      const filePath = storagePath(folder, file.originalname);

      const { error } = await supabase.storage.from(BUCKET).upload(filePath, file.buffer, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: true
      });

      if (error) throw error;

      added.push({
        id: filePath,
        name: path.posix.basename(filePath),
        folder: filePath.includes("/") ? filePath.split("/").slice(0, -1).join("/") : "General",
        size: file.size,
        uploadedAt: new Date().toISOString()
      });
    }

    res.json({ ok: true, added: added.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

app.get("/api/download/*id", async (req, res) => {
  if (!requireStorage(res)) return;
  const id = Array.isArray(req.params.id)
  ? req.params.id.join("/")
  : req.params.id || "";

const filePath = safePath(id);
  if (!filePath) return res.sendStatus(404);

  // The bucket is public, so let Supabase serve the file directly.
  // This avoids using Render's temporary disk and avoids proxying large files through Node.
  res.redirect(publicUrl(filePath));
});

app.delete("/api/files/*id", auth, async (req, res) => {
  if (!requireStorage(res)) return;
  const id = Array.isArray(req.params.id)
  ? req.params.id.join("/")
  : req.params.id || "";

const filePath = safePath(id);
  if (!filePath) return res.sendStatus(404);

  try {
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Delete failed" });
  }
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`CSE Study Hub running on port ${PORT}`));
