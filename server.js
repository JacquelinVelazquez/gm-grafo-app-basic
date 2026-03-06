const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = 5173;

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage() });

// Historial en memoria (demo). No hay BD.
const history = [];
let nextId = 1;

function verbMapToGraphData(verbMap) {
  // Formato soportado:
  // { "choca": ["coche","edificio"], ... }
  // o multi-pares:
  // { "choca": [["coche","edificio"],["auto","poste"]] }
  const nodeSet = new Set();
  const links = [];

  for (const [verb, val] of Object.entries(verbMap || {})) {
    const pairs = Array.isArray(val?.[0]) ? val : [val];

    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const source = String(pair[0]);
      const target = String(pair[1]);
      nodeSet.add(source);
      nodeSet.add(target);
      links.push({ source, target, label: verb });
    }
  }

  const nodes = Array.from(nodeSet).map((id) => ({ id }));
  return { nodes, links };
}

function statsOf(graphData) {
  return {
    nodes: graphData.nodes?.length || 0,
    links: graphData.links?.length || 0,
  };
}

function addToHistory(name, graphData) {
  const entry = {
    id: nextId++,
    name,
    createdAt: new Date().toISOString(),
    graphData,
    stats: statsOf(graphData),
  };
  history.unshift(entry);
  return entry;
}

app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió archivo." });
    const text = req.file.buffer.toString("utf-8");
    const raw = JSON.parse(text);

    const graphData = verbMapToGraphData(raw);
    const entry = addToHistory(req.file.originalname, graphData);

    res.json({ ok: true, entry: { id: entry.id } });
  } catch (e) {
    res.status(400).json({
      error: "JSON inválido o no se pudo procesar.",
      detail: String(e.message || e),
    });
  }
});

app.post("/api/load-url", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "URL inválida." });

    const r = await fetch(url);
    if (!r.ok) return res.status(400).json({ error: `No se pudo descargar: ${r.status}` });

    const text = await r.text();
    const raw = JSON.parse(text);

    const graphData = verbMapToGraphData(raw);
    const entry = addToHistory(`URL: ${url}`, graphData);

    res.json({ ok: true, entry: { id: entry.id } });
  } catch (e) {
    res.status(400).json({
      error: "No se pudo cargar/parsear la URL como JSON.",
      detail: String(e.message || e),
    });
  }
});

app.get("/api/history", (req, res) => {
  res.json(
    history.map((h) => ({
      id: h.id,
      name: h.name,
      createdAt: h.createdAt,
      stats: h.stats,
    }))
  );
});

app.get("/api/graph/:id", (req, res) => {
  const id = Number(req.params.id);
  const entry = history.find((h) => h.id === id);
  if (!entry) return res.status(404).json({ error: "No encontrado." });
  res.json(entry);
});

app.listen(PORT, () => {
  console.log(`App corriendo en http://localhost:${PORT}`);
});