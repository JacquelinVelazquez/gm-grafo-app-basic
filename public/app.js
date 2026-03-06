const $ = (id) => document.getElementById(id);

function formatDate(iso) {
  try { return new Date(iso).toLocaleString(); }
  catch { return iso; }
}

let graph = null;
let fullGraphData = null;
let displayedGraphData = null;
let selectedNodeId = null;
let hopRadius = 1;

async function apiHistory() {
  const r = await fetch("/api/history");
  return await r.json();
}
async function apiGraph(id) {
  const r = await fetch(`/api/graph/${id}`);
  return await r.json();
}
async function apiUploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Error al subir");
  return data.entry;
}
async function apiLoadUrl(url) {
  const r = await fetch("/api/load-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Error al cargar URL");
  return data.entry;
}

function showDropZone(msg = "") {
  $("dropZone").style.display = "flex";
  $("uploadMsg").textContent = msg;
}
function hideDropZone() {
  $("dropZone").style.display = "none";
  $("uploadMsg").textContent = "";
}

/** K-hop subgraph alrededor de startId */
function buildKHopSubgraph(graphData, startId, k) {
  if (!graphData || !startId) return graphData;

  const adj = new Map();
  for (const l of graphData.links) {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    if (!adj.has(s)) adj.set(s, []);
    if (!adj.has(t)) adj.set(t, []);
    adj.get(s).push({ other: t, link: l });
    adj.get(t).push({ other: s, link: l });
  }

  const visited = new Set([startId]);
  const queue = [{ id: startId, depth: 0 }];
  const keepLinks = new Set();

  while (queue.length) {
    const { id, depth } = queue.shift();
    if (depth === k) continue;

    for (const { other, link } of (adj.get(id) || [])) {
      keepLinks.add(link);
      if (!visited.has(other)) {
        visited.add(other);
        queue.push({ id: other, depth: depth + 1 });
      }
    }
  }

  return {
    nodes: graphData.nodes.filter(n => visited.has(n.id)),
    links: graphData.links.filter(l => keepLinks.has(l))
  };
}

function pickHighestDegreeNode(graphData) {
  const deg = new Map();
  for (const l of graphData.links || []) {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    deg.set(s, (deg.get(s) || 0) + 1);
    deg.set(t, (deg.get(t) || 0) + 1);
  }
  let best = graphData.nodes?.[0]?.id || null;
  let bestV = -1;
  for (const [id, v] of deg.entries()) {
    if (v > bestV) { best = id; bestV = v; }
  }
  return best;
}

function syncCounts() {
  const n = displayedGraphData?.nodes?.length || 0;
  const l = displayedGraphData?.links?.length || 0;
  $("statNodes").textContent = n;
  $("statLinks").textContent = l;
  $("infoNodes").textContent = n;
  $("infoLinks").textContent = l;
}

function renderRelated(graphData, selectedId = null) {
  const list = $("relatedList");
  if (!graphData) {
    list.innerHTML = `<li class="muted">Cargue un grafo para ver relaciones.</li>`;
    return;
  }

  const degree = new Map();
  const add = (id) => degree.set(id, (degree.get(id) || 0) + 1);

  for (const l of graphData.links || []) {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    add(s); add(t);
  }

  const items = Array.from(degree.entries())
    .filter(([id]) => (selectedId ? id !== selectedId : true))
    .sort((a,b)=>b[1]-a[1])
    .slice(0, 6);

  if (items.length === 0) {
    list.innerHTML = `<li class="muted">No hay relacionados.</li>`;
    return;
  }

  list.innerHTML = items.map(([id,v]) => `<li><b>${id}</b> <span class="muted">(${v})</span></li>`).join("");
}

/** Modal (solo Resumen) */
function openModal(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modal").classList.remove("hidden");
}
function closeModal() {
  $("modal").classList.add("hidden");
}

function initGraph() {
  const el = $("graph3d");
  graph = ForceGraph3D()(el)
    .nodeLabel(n => n.id)
    .linkLabel(l => l.label)
    .linkDirectionalParticles(2)
    .linkDirectionalParticleSpeed(0.01)
    .onNodeClick((node) => {
      selectedNodeId = node.id;
      displayedGraphData = buildKHopSubgraph(fullGraphData, selectedNodeId, hopRadius);
      graph.graphData(displayedGraphData);
      syncCounts();
      renderRelated(displayedGraphData, selectedNodeId);
    });

  const resize = () => {
    graph.width(el.clientWidth);
    graph.height(el.clientHeight);
  };
  window.addEventListener("resize", resize);
  setTimeout(resize, 50);
}

function setGraphEntry(entry) {
  fullGraphData = entry.graphData;
  selectedNodeId = pickHighestDegreeNode(fullGraphData);

  displayedGraphData = buildKHopSubgraph(fullGraphData, selectedNodeId, hopRadius);
  graph.graphData(displayedGraphData);

  $("infoName").textContent = entry.name;
  $("infoDate").textContent = formatDate(entry.createdAt);

  $("btnExpand").textContent = `Expandir Conexiones (K=${hopRadius})`;

  syncCounts();
  renderRelated(displayedGraphData, selectedNodeId);

  hideDropZone();
}

async function refreshHistory() {
  const list = await apiHistory();
  const container = $("historyList");

  if (!list || list.length === 0) {
    container.innerHTML = `<div class="hint">Aún no hay consultas.</div>`;
    return;
  }

  container.innerHTML = list.map(h => {
    const date = formatDate(h.createdAt);
    return `
      <div class="historyItem" data-id="${h.id}">
        <div><b>${h.name}</b></div>
        <div class="meta">#${h.id} · ${date}</div>
        <div class="meta">Nodos: ${h.stats.nodes} · Conexiones: ${h.stats.links}</div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".historyItem").forEach(el => {
    el.addEventListener("click", async () => {
      const id = el.getAttribute("data-id");
      const entry = await apiGraph(id);
      hopRadius = 1; // vuelve a básico al abrir
      $("btnExpand").textContent = `Expandir Conexiones (K=${hopRadius})`;
      setGraphEntry(entry);
    });
  });
}

async function handleFile(file) {
  try {
    showDropZone("Subiendo y procesando...");
    const meta = await apiUploadFile(file);
    await refreshHistory();
    const entry = await apiGraph(meta.id);
    hopRadius = 1;
    setGraphEntry(entry);
  } catch (e) {
    showDropZone("❌ " + (e.message || e));
  }
}

async function handleUrl(url) {
  try {
    showDropZone("Cargando URL y procesando...");
    const meta = await apiLoadUrl(url);
    await refreshHistory();
    const entry = await apiGraph(meta.id);
    hopRadius = 1;
    setGraphEntry(entry);
  } catch (e) {
    showDropZone("❌ " + (e.message || e));
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  initGraph();
  showDropZone("Arrastra un JSON o elige un archivo.");

  await refreshHistory();

  $("btnPickFile").addEventListener("click", () => $("fileInput").click());
  $("btnUploadOpen").addEventListener("click", () => showDropZone("Cargue un JSON o pegue una URL."));
  $("btnDoc").addEventListener("click", () => showDropZone("Cargue un JSON o pegue una URL."));
  $("btnNew").addEventListener("click", () => showDropZone("Nueva consulta: sube un JSON o usa URL."));

  $("fileInput").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  });

  $("btnLoadUrl").addEventListener("click", () => {
    const url = $("urlInput").value.trim();
    if (!url) return showDropZone("Pega una URL válida a un JSON.");
    handleUrl(url);
  });

  // Drag & drop
  const dz = $("dropZone");
  dz.addEventListener("dragover", (e) => { e.preventDefault(); $("uploadMsg").textContent = "Suelta el archivo para cargarlo…"; });
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  // Expandir conexiones: 1->2->3->4->1
  $("btnExpand").addEventListener("click", () => {
  if (!fullGraphData || !selectedNodeId) return;

  const prevN = displayedGraphData?.nodes?.length || 0;
  const prevL = displayedGraphData?.links?.length || 0;

  // intenta subir K
  const nextK = hopRadius >= 4 ? 1 : hopRadius + 1;
  const candidate = buildKHopSubgraph(fullGraphData, selectedNodeId, nextK);

  const newN = candidate.nodes.length;
  const newL = candidate.links.length;

  // Si no cambia nada, significa que ya no hay más nodos que agregar
  if (newN === prevN && newL === prevL && nextK > 1) {
    $("btnExpand").textContent = `Expandir Conexiones (K=${hopRadius}) · Máximo`;
    return;
  }

  // aplica cambio
  hopRadius = nextK;
  displayedGraphData = candidate;
  graph.graphData(displayedGraphData);

  $("btnExpand").textContent = `Expandir Conexiones (K=${hopRadius})`;
  syncCounts();
  renderRelated(displayedGraphData, selectedNodeId);
});
  // Resumen Auto: modal simple
  $("btnSummary").addEventListener("click", () => {
    if (!fullGraphData) return openModal("Resumen", `<p>No hay grafo cargado.</p>`);

    const relCounts = new Map();
    const deg = new Map();
    for (const l of fullGraphData.links) {
      relCounts.set(l.label, (relCounts.get(l.label) || 0) + 1);
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      deg.set(s, (deg.get(s) || 0) + 1);
      deg.set(t, (deg.get(t) || 0) + 1);
    }

    const topNodes = Array.from(deg.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const topRels  = Array.from(relCounts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);

    openModal("Resumen (Auto)", `
      <p><b>Resumen automático del grafo</b>:</p>
      <p><b>Nodos:</b> ${fullGraphData.nodes.length} &nbsp; | &nbsp; <b>Conexiones:</b> ${fullGraphData.links.length}</p>

      <div style="margin-top:10px;">
        <b>Top nodos más conectados</b>
        <ol>${topNodes.map(([id,v]) => `<li>${id} (${v})</li>`).join("")}</ol>
      </div>

      <div style="margin-top:10px;">
        <b>Relaciones (verbos) más frecuentes</b>
        <ol>${topRels.map(([lab,v]) => `<li>${lab} (${v})</li>`).join("")}</ol>
      </div>

      <p class="muted small">Esto luego se reemplaza por GraphRAG/LLM.</p>
    `);
  });

  $("modalClose").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
});