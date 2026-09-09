const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, "data", "templates.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const PRINT_DIR = path.join(__dirname, "prints");
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PRINT_DIR, { recursive: true });

app.use(express.json({ limit: "5mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/prints", express.static(PRINT_DIR));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads are allowed."));
    cb(null, true);
  }
});

function readData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get("/api/templates", (_, res) => res.json(readData()));

app.post("/api/upload", upload.single("file"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post("/api/prints", (req, res) => {
  const dataUrl = req.body?.dataUrl;
  const id = req.body?.id;
  if (!/^[a-zA-Z0-9-]+$/.test(id || "") || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/jpeg;base64,")) {
    return res.status(400).send("A valid print ID and JPEG data URL are required.");
  }

  const filename = `${id}.jpg`;
  const base64 = dataUrl.slice("data:image/jpeg;base64,".length);
  fs.writeFileSync(path.join(PRINT_DIR, filename), Buffer.from(base64, "base64"));

  res.json({ id, url: `/prints/${filename}` });
});

app.post("/api/categories", (req, res) => {
  const data = readData();
  const item = {
    id: crypto.randomUUID(),
    name: req.body.name || "Untitled",
    enabled: req.body.enabled !== false,
    coverImage: req.body.coverImage || "",
    subtemplates: []
  };
  data.push(item);
  writeData(data);
  res.json(item);
});

app.patch("/api/categories/:id", (req, res) => {
  const data = readData();
  const item = data.find(x => x.id === req.params.id);
  if (!item) return res.status(404).send("Template not found.");

  for (const key of ["name", "enabled", "coverImage"]) {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  }

  writeData(data);
  res.json(item);
});

app.delete("/api/categories/:id", (req, res) => {
  const data = readData().filter(x => x.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

app.post("/api/categories/:categoryId/subtemplates", (req, res) => {
  const data = readData();
  const cat = data.find(x => x.id === req.params.categoryId);
  if (!cat) return res.status(404).send("Template not found.");

  const b = req.body;
  const item = {
    id: crypto.randomUUID(),
    name: b.name || "Untitled",
    enabled: b.enabled !== false,
    captureCount: Math.max(4, Math.min(6, Number(b.captureCount || 6))),
    finalPhotoCount: Math.max(1, Math.min(4, Number(b.finalPhotoCount || 4))),
    countdownSeconds: Number(b.countdownSeconds || 3),
    fitMode: b.fitMode === "cover" ? "cover" : "contain",
    canvas: b.canvas || { width: 1200, height: 1800 },
    background: b.background || "",
    overlay: b.overlay || "",
    backgroundColor: b.backgroundColor || "#ffffff",
    slotBackground: b.slotBackground || "#ffffff",
    slots: b.slots || []
  };

  cat.subtemplates.push(item);
  writeData(data);
  res.json(item);
});

app.patch("/api/categories/:categoryId/subtemplates/:subId", (req, res) => {
  const data = readData();
  const cat = data.find(x => x.id === req.params.categoryId);
  if (!cat) return res.status(404).send("Template not found.");

  const sub = cat.subtemplates.find(x => x.id === req.params.subId);
  if (!sub) return res.status(404).send("Subtemplate not found.");

  const allowed = [
    "name", "enabled", "captureCount", "finalPhotoCount", "countdownSeconds",
    "fitMode", "canvas", "background", "overlay", "backgroundColor",
    "slotBackground", "slots"
  ];

  for (const key of allowed) {
    if (req.body[key] !== undefined) sub[key] = req.body[key];
  }

  sub.captureCount = Math.max(4, Math.min(6, Number(sub.captureCount || 6)));
  sub.finalPhotoCount = Math.max(1, Math.min(4, Number(sub.finalPhotoCount || 4)));
  sub.fitMode = sub.fitMode === "cover" ? "cover" : "contain";

  writeData(data);
  res.json(sub);
});

app.delete("/api/categories/:categoryId/subtemplates/:subId", (req, res) => {
  const data = readData();
  const cat = data.find(x => x.id === req.params.categoryId);
  if (!cat) return res.status(404).send("Template not found.");

  cat.subtemplates = cat.subtemplates.filter(x => x.id !== req.params.subId);
  writeData(data);
  res.json({ ok: true });
});

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get("/{*splat}", (_, res) => res.sendFile(path.join(CLIENT_DIST, "index.html")));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).send(err.message || "Request failed.");
});

app.listen(PORT, () => {
  console.log(`Photobooth server running on http://localhost:${PORT}`);
});
