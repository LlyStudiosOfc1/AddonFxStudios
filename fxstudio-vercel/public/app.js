const API_BASE = `${window.location.origin}/api/v1`;
const STORAGE_KEY = "fxstudio_active_token";

let activeToken = localStorage.getItem(STORAGE_KEY) || "";
let currentEffects = [];
let particles = [];

const $ = (id) => document.getElementById(id);

function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

function addMolangRow(key = "variable.color_r", val = 0.4) {
  const row = document.createElement("div");
  row.className = "molang-row";
  row.innerHTML = `
    <input type="text" class="molang-key" value="${key}" placeholder="variable.nome" />
    <input type="number" step="0.05" class="molang-val" value="${val}" />
    <button type="button" class="btn btn-danger btn-sm">X</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  $("molangList").appendChild(row);
}

function getMolangVars() {
  const vars = {};
  document.querySelectorAll(".molang-row").forEach((row) => {
    const k = row.querySelector(".molang-key").value.trim();
    const v = Number(row.querySelector(".molang-val").value);
    if (k) vars[k] = Number.isFinite(v) ? v : 0;
  });
  return vars;
}

function setMolangVars(varsObj = {}) {
  $("molangList").innerHTML = "";
  const entries = Object.entries(varsObj);
  if (entries.length === 0) {
    addMolangRow("variable.color_r", 0.3);
    addMolangRow("variable.color_g", 0.8);
    addMolangRow("variable.color_b", 1.0);
    return;
  }
  entries.forEach(([k, v]) => addMolangRow(k, v));
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    const badge = $("storageBadge");
    if (data.storage === "vercel-kv") {
      badge.textContent = "Storage: Vercel KV (Persistente)";
      badge.className = "pill pill-online";
    } else {
      badge.textContent = "Storage: Memória (Ativo)";
      badge.className = "pill pill-muted";
    }
  } catch {
    $("storageBadge").textContent = "Storage: Offline";
  }
}

async function generateNewToken() {
  const res = await fetch(`${API_BASE}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label: "Portal Web" })
  });
  const data = await res.json();
  if (data.ok && data.tokenData) {
    activeToken = data.tokenData.token;
    localStorage.setItem(STORAGE_KEY, activeToken);
    $("tokenInput").value = activeToken;
    updatePlayerBadge(data.tokenData);
    await loadEffects();
    showToast(`Token gerado: ${activeToken}`);
  }
}

async function connectToken(tokenValue) {
  const clean = String(tokenValue || "").trim().toUpperCase();
  if (!clean) {
    showToast("Informe um token válido.");
    return;
  }
  const res = await fetch(`${API_BASE}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: clean })
  });
  const data = await res.json();
  if (data.ok) {
    activeToken = data.tokenData.token;
    localStorage.setItem(STORAGE_KEY, activeToken);
    $("tokenInput").value = activeToken;
    updatePlayerBadge(data.tokenData);
    await loadEffects();
    showToast(`Conectado ao token ${activeToken}`);
  }
}

function updatePlayerBadge(tokenData) {
  const badge = $("playerBadge");
  if (tokenData && tokenData.playerName) {
    badge.textContent = `Minecraft: ${tokenData.playerName} (${tokenData.playerId})`;
    badge.className = "pill pill-online";
  } else {
    badge.textContent = "Minecraft: aguardando /auth/validate";
    badge.className = "pill pill-offline";
  }
}

async function loadEffects() {
  if (!activeToken) return;
  const res = await fetch(`${API_BASE}/effects?token=${encodeURIComponent(activeToken)}`);
  const data = await res.json();
  if (!data.ok) return;

  currentEffects = data.effects || [];
  $("versionLabel").textContent = `latestVersion: ${data.latestVersion}`;
  renderEffectsList();
  await runSyncPreview();
}

function renderEffectsList() {
  const grid = $("effectsGrid");
  if (currentEffects.length === 0) {
    grid.innerHTML = `<p class="muted">Nenhum efeito criado neste token ainda.</p>`;
    return;
  }

  grid.innerHTML = currentEffects
    .map(
      (fx) => `
      <article class="effect-item">
        <h3>${fx.name}</h3>
        <div class="effect-meta">
          <div><strong>Tipo:</strong> ${fx.type}</div>
          <div><strong>Pos:</strong> (${fx.position.x}, ${fx.position.y}, ${fx.position.z}) | <strong>Scale:</strong> ${fx.scale}</div>
          <div><strong>Versão:</strong> v${fx.version} &bull; <code>${fx.id}</code></div>
        </div>
        <div class="effect-actions">
          <button class="btn btn-secondary btn-sm" onclick="editEffect('${fx.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="removeEffect('${fx.id}')">Excluir</button>
        </div>
      </article>
    `
    )
    .join("");
}

window.editEffect = function (id) {
  const fx = currentEffects.find((item) => item.id === id);
  if (!fx) return;
  $("effectId").value = fx.id;
  $("effectName").value = fx.name;
  $("effectType").value = fx.type;
  $("posX").value = fx.position.x;
  $("posY").value = fx.position.y;
  $("posZ").value = fx.position.z;
  $("rotX").value = fx.rotation.x;
  $("rotY").value = fx.rotation.y;
  $("rotZ").value = fx.rotation.z;
  $("effectScale").value = fx.scale;
  setMolangVars(fx.molangVars || {});
  $("editorTitle").textContent = `Editando: ${fx.name}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.removeEffect = async function (id) {
  if (!activeToken) return;
  await fetch(
    `${API_BASE}/effects?token=${encodeURIComponent(activeToken)}&id=${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  showToast("Efeito removido e marcado para despawn no sync.");
  await loadEffects();
};

async function runSyncPreview() {
  if (!activeToken) return;
  const res = await fetch(
    `${API_BASE}/effects/sync?token=${encodeURIComponent(activeToken)}&sinceVersion=0`
  );
  const data = await res.json();
  $("syncOutput").textContent = JSON.stringify(data, null, 2);
}

function resetEditor() {
  $("effectId").value = "";
  $("effectName").value = "";
  $("effectType").value = "minecraft:basic_flame_particle";
  $("posX").value = 0;
  $("posY").value = 1;
  $("posZ").value = 0;
  $("rotX").value = 0;
  $("rotY").value = 0;
  $("rotZ").value = 0;
  $("effectScale").value = 1.0;
  setMolangVars();
  $("editorTitle").textContent = "2. Criar / Editar Partícula";
}

// Simple interactive particle canvas preview
function startCanvasPreview() {
  const canvas = $("particleCanvas");
  const ctx = canvas.getContext("2d");

  function loop() {
    ctx.fillStyle = "rgba(7, 9, 13, 0.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const vars = getMolangVars();
    const r = Math.min(255, Math.max(0, Math.round((vars["variable.color_r"] ?? 0.3) * 255)));
    const g = Math.min(255, Math.max(0, Math.round((vars["variable.color_g"] ?? 0.7) * 255)));
    const b = Math.min(255, Math.max(0, Math.round((vars["variable.color_b"] ?? 1.0) * 255)));
    const scale = Math.max(0.4, Number($("effectScale").value) || 1);
    const speed = Math.max(0.2, Number(vars["variable.speed"] ?? 1));

    if (particles.length < 70) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 40,
        y: canvas.height * 0.75,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -(1 + Math.random() * 1.8) * speed,
        life: 1.0
      });
    }

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.014;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2 * scale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.max(0, p.life)})`;
      ctx.fill();
    });

    particles = particles.filter((p) => p.life > 0);
    requestAnimationFrame(loop);
  }

  loop();
}

document.addEventListener("DOMContentLoaded", async () => {
  $("apiUrlInput").value = API_BASE;
  setMolangVars();
  startCanvasPreview();
  await checkHealth();

  if (activeToken) {
    $("tokenInput").value = activeToken;
    await connectToken(activeToken);
  }

  $("btnNewToken").addEventListener("click", generateNewToken);
  $("btnLoadToken").addEventListener("click", () => connectToken($("tokenInput").value));
  $("btnAddMolang").addEventListener("click", () => addMolangRow("variable.custom", 1.0));
  $("btnResetForm").addEventListener("click", resetEditor);
  $("btnRefreshEffects").addEventListener("click", loadEffects);
  $("btnTestSync").addEventListener("click", async () => {
    await runSyncPreview();
    showToast("Endpoint /api/v1/effects/sync testado.");
  });

  $("btnCopyToken").addEventListener("click", () => {
    navigator.clipboard.writeText($("tokenInput").value);
    showToast("Token copiado!");
  });

  $("btnCopyApi").addEventListener("click", () => {
    navigator.clipboard.writeText($("apiUrlInput").value);
    showToast("URL da API copiada!");
  });

  $("effectForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeToken) {
      await generateNewToken();
    }

    const payload = {
      id: $("effectId").value || undefined,
      ownerToken: activeToken,
      name: $("effectName").value,
      type: $("effectType").value,
      position: {
        x: Number($("posX").value),
        y: Number($("posY").value),
        z: Number($("posZ").value)
      },
      rotation: {
        x: Number($("rotX").value),
        y: Number($("rotY").value),
        z: Number($("rotZ").value)
      },
      scale: Number($("effectScale").value),
      molangVars: getMolangVars()
    };

    const res = await fetch(`${API_BASE}/effects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.ok) {
      resetEditor();
      await loadEffects();
      showToast("Partícula salva e pronta para sincronizar no Minecraft!");
    }
  });
});
