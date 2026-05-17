const DB_NAME = "choir-books";
const DB_VERSION = 1;

const $ = (id) => document.getElementById(id);
const state = {
  members: [],
  books: [],
  events: [],
  scanMode: "checkout",
  stream: null,
  detector: null,
  scanTimer: null,
  lastScan: { value: "", at: 0 },
};

let db;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const nextDb = request.result;
      if (!nextDb.objectStoreNames.contains("members")) {
        nextDb.createObjectStore("members", { keyPath: "id" });
      }
      if (!nextDb.objectStoreNames.contains("books")) {
        nextDb.createObjectStore("books", { keyPath: "qr" });
      }
      if (!nextDb.objectStoreNames.contains("events")) {
        nextDb.createObjectStore("events", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(store, mode = "readonly") {
  return db.transaction(store, mode).objectStore(store);
}

function all(store) {
  return new Promise((resolve, reject) => {
    const request = tx(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put(store, value) {
  return new Promise((resolve, reject) => {
    const request = tx(store, "readwrite").put(value);
    request.onsuccess = () => resolve(value);
    request.onerror = () => reject(request.error);
  });
}

function remove(store, key) {
  return new Promise((resolve, reject) => {
    const request = tx(store, "readwrite").delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function replaceAll(data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["members", "books", "events"], "readwrite");
    transaction.objectStore("members").clear();
    transaction.objectStore("books").clear();
    transaction.objectStore("events").clear();
    data.members.forEach((item) => transaction.objectStore("members").put(item));
    data.books.forEach((item) => transaction.objectStore("books").put(item));
    data.events.forEach((item) => transaction.objectStore("events").put(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadState() {
  state.members = (await all("members")).sort((a, b) => a.name.localeCompare(b.name));
  state.books = await all("books");
  state.events = (await all("events")).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  render();
}

function activeMembers() {
  return state.members.filter((member) => member.active !== false);
}

function memberName(id) {
  return state.members.find((member) => member.id === id)?.name || "Unknown member";
}

function assignedBooks(memberId) {
  return state.books.filter((book) => book.currentMemberId === memberId);
}

function memberHistory(memberId) {
  return state.events.filter((event) => event.memberId === memberId).slice(0, 4);
}

function formatEventTime(timestamp) {
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
}

function shortQr(qr) {
  return qr.length > 18 ? `${qr.slice(0, 8)}...${qr.slice(-6)}` : qr;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

function render() {
  renderDashboard();
  renderMembers();
  renderScanMemberOptions();
}

function renderDashboard() {
  const search = $("globalSearch").value.trim().toLowerCase();
  const assigned = state.books.filter((book) => book.currentMemberId);
  $("memberCount").textContent = activeMembers().length;
  $("knownBookCount").textContent = state.books.length;
  $("assignedBookCount").textContent = assigned.length;

  const rows = assigned
    .filter((book) => {
      const haystack = `${book.qr} ${memberName(book.currentMemberId)}`.toLowerCase();
      return !search || haystack.includes(search);
    })
    .sort((a, b) => memberName(a.currentMemberId).localeCompare(memberName(b.currentMemberId)));

  $("assignedList").innerHTML = rows.length
    ? rows.map((book) => `
      <article class="item">
        <div class="item-head">
          <div>
            <h3>${escapeHtml(memberName(book.currentMemberId))}</h3>
            <p class="meta">Book ${escapeHtml(book.qr)}</p>
          </div>
          <button class="secondary" type="button" data-return="${escapeAttr(book.qr)}">Return</button>
        </div>
      </article>
    `).join("")
    : `<article class="item"><p class="meta">No assigned books found.</p></article>`;
}

function renderMembers() {
  const search = $("memberSearch").value.trim().toLowerCase();
  const rows = state.members.filter((member) => {
    const haystack = `${member.name} ${member.voice || ""} ${member.contact || ""}`.toLowerCase();
    return !search || haystack.includes(search);
  });

  $("memberList").innerHTML = rows.length
    ? rows.map((member) => {
      const books = assignedBooks(member.id);
      const history = memberHistory(member.id);
      return `
        <article class="item">
          <div class="item-head">
            <div>
              <h3>${escapeHtml(member.name)}${member.active === false ? " <span class=\"meta\">Inactive</span>" : ""}</h3>
              <p class="meta">${escapeHtml([member.voice, member.contact].filter(Boolean).join(" · ") || "No details")}</p>
            </div>
            <div class="item-actions">
              <button class="secondary" type="button" data-edit-member="${member.id}">Edit</button>
              <button class="secondary" type="button" data-toggle-member="${member.id}">${member.active === false ? "Activate" : "Deactivate"}</button>
              <button class="secondary" type="button" data-delete-member="${member.id}">Delete</button>
            </div>
          </div>
          <div class="chips">
            ${books.length ? books.map((book) => `<span class="chip">${escapeHtml(shortQr(book.qr))}</span>`).join("") : `<span class="chip">No books assigned</span>`}
          </div>
          ${history.length ? `
            <div class="history">
              ${history.map((event) => `<p>${escapeHtml(formatEventTime(event.timestamp))}: ${event.action === "checkout" ? "Checked out" : "Returned"} ${escapeHtml(shortQr(event.qr))}</p>`).join("")}
            </div>
          ` : ""}
        </article>
      `;
    }).join("")
    : `<article class="item"><p class="meta">No members found.</p></article>`;
}

function renderScanMemberOptions() {
  const select = $("scanMember");
  const current = select.value;
  const members = activeMembers();
  select.innerHTML = members.length
    ? members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")
    : `<option value="">Add a member first</option>`;
  if (members.some((member) => member.id === current)) {
    select.value = current;
  }
  $("memberPickerLabel").classList.toggle("hidden", state.scanMode === "return");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

async function saveMember(event) {
  event.preventDefault();
  const id = $("memberId").value || uid();
  const existing = state.members.find((member) => member.id === id);
  const member = {
    id,
    name: $("memberName").value.trim(),
    voice: $("memberVoice").value,
    contact: $("memberContact").value.trim(),
    active: existing?.active ?? true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!member.name) return;
  await put("members", member);
  resetMemberForm();
  await loadState();
  showToast("Member saved");
}

function editMember(id) {
  const member = state.members.find((item) => item.id === id);
  if (!member) return;
  $("memberId").value = member.id;
  $("memberName").value = member.name;
  $("memberVoice").value = member.voice || "";
  $("memberContact").value = member.contact || "";
  $("memberForm").classList.remove("hidden");
  $("memberName").focus();
}

function resetMemberForm() {
  $("memberForm").reset();
  $("memberId").value = "";
  $("memberForm").classList.add("hidden");
}

async function toggleMember(id) {
  const member = state.members.find((item) => item.id === id);
  if (!member) return;
  await put("members", { ...member, active: member.active === false, updatedAt: new Date().toISOString() });
  await loadState();
}

async function deleteMember(id) {
  const hasBooks = state.books.some((book) => book.currentMemberId === id);
  const hasEvents = state.events.some((event) => event.memberId === id);
  if (hasBooks) {
    showToast("Return this member's books before deleting");
    return;
  }
  if (hasEvents && !confirm("This member has history. Delete the member record anyway? History will show Unknown member.")) return;
  await remove("members", id);
  await loadState();
}

async function processQr(rawValue) {
  const qr = rawValue.trim();
  if (!qr) return;
  const now = Date.now();
  if (state.lastScan.value === qr && now - state.lastScan.at < 1800) return;
  state.lastScan = { value: qr, at: now };

  if (state.scanMode === "return") {
    await returnBook(qr);
  } else {
    await checkoutBook(qr, $("scanMember").value);
  }
}

async function checkoutBook(qr, memberId) {
  if (!memberId) {
    showToast("Add or select a member first");
    return;
  }

  let book = state.books.find((item) => item.qr === qr);
  const now = new Date().toISOString();

  if (book?.currentMemberId && book.currentMemberId !== memberId) {
    const message = `Book ${qr} is assigned to ${memberName(book.currentMemberId)}. Transfer to ${memberName(memberId)}?`;
    if (!confirm(message)) {
      addLog(`Skipped ${qr}`);
      return;
    }
  }

  book = {
    qr,
    firstSeenAt: book?.firstSeenAt || now,
    currentMemberId: memberId,
    updatedAt: now,
  };

  await put("books", book);
  await put("events", {
    id: uid(),
    qr,
    memberId,
    action: "checkout",
    timestamp: now,
  });
  await loadState();
  addLog(`Assigned ${qr} to ${memberName(memberId)}`);
  showToast("Book assigned");
}

async function returnBook(qr) {
  const book = state.books.find((item) => item.qr === qr);
  if (!book) {
    addLog(`Unknown book ${qr}`);
    showToast("Unknown book");
    return;
  }
  if (!book.currentMemberId) {
    addLog(`${qr} is already unassigned`);
    showToast("Book is already returned");
    return;
  }
  const memberId = book.currentMemberId;
  const now = new Date().toISOString();
  await put("books", { ...book, currentMemberId: "", updatedAt: now });
  await put("events", {
    id: uid(),
    qr,
    memberId,
    action: "return",
    timestamp: now,
  });
  await loadState();
  addLog(`Returned ${qr} from ${memberName(memberId)}`);
  showToast("Book returned");
}

function addLog(message) {
  const log = $("scanLog");
  const item = document.createElement("p");
  item.textContent = `${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}: ${message}`;
  log.prepend(item);
}

async function startScanner() {
  if (!("BarcodeDetector" in window)) {
    $("scannerMessage").textContent = "Camera QR scanning is not available here. Use manual entry.";
    return;
  }
  try {
    state.detector = new BarcodeDetector({ formats: ["qr_code"] });
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    $("scanVideo").srcObject = state.stream;
    await $("scanVideo").play();
    $("scannerMessage").textContent = "Point the camera at a QR code";
    state.scanTimer = setInterval(scanFrame, 650);
  } catch (error) {
    $("scannerMessage").textContent = "Camera unavailable. Use manual entry.";
    showToast("Camera permission or scanner support failed");
  }
}

async function scanFrame() {
  if (!state.detector || !$("scanVideo").srcObject) return;
  try {
    const codes = await state.detector.detect($("scanVideo"));
    if (codes[0]?.rawValue) {
      await processQr(codes[0].rawValue);
    }
  } catch {
    $("scannerMessage").textContent = "Scanner paused. Try manual entry.";
  }
}

function stopScanner() {
  clearInterval(state.scanTimer);
  state.scanTimer = null;
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
  $("scanVideo").srcObject = null;
  $("scannerMessage").textContent = "Camera scanner is off";
}

function setMode(mode) {
  state.scanMode = mode;
  $("checkoutMode").classList.toggle("active", mode === "checkout");
  $("returnMode").classList.toggle("active", mode === "return");
  renderScanMemberOptions();
}

function exportData() {
  const data = {
    exportedAt: new Date().toISOString(),
    app: "choir-books",
    version: 1,
    members: state.members,
    books: state.books,
    events: state.events,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `choir-books-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data.members) || !Array.isArray(data.books) || !Array.isArray(data.events)) {
    throw new Error("Backup file is not valid");
  }
  if (!confirm("Importing replaces all local data on this device.")) return;
  await replaceAll({
    members: data.members,
    books: data.books,
    events: data.events,
  });
  await loadState();
  showToast("Backup imported");
}

async function clearData() {
  if (!confirm("Clear all choir book data from this device?")) return;
  await replaceAll({ members: [], books: [], events: [] });
  await loadState();
  showToast("Local data cleared");
}

function bindEvents() {
  document.querySelectorAll(".tabbar button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tabbar button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      $(button.dataset.view).classList.add("active");
    });
  });

  $("refreshButton").addEventListener("click", loadState);
  $("globalSearch").addEventListener("input", renderDashboard);
  $("memberSearch").addEventListener("input", renderMembers);
  $("newMemberButton").addEventListener("click", () => {
    resetMemberForm();
    $("memberForm").classList.remove("hidden");
    $("memberName").focus();
  });
  $("cancelMemberButton").addEventListener("click", resetMemberForm);
  $("memberForm").addEventListener("submit", saveMember);
  $("memberList").addEventListener("click", async (event) => {
    const editId = event.target.dataset.editMember;
    const toggleId = event.target.dataset.toggleMember;
    const deleteId = event.target.dataset.deleteMember;
    if (editId) editMember(editId);
    if (toggleId) await toggleMember(toggleId);
    if (deleteId) await deleteMember(deleteId);
  });
  $("assignedList").addEventListener("click", async (event) => {
    if (event.target.dataset.return) await returnBook(event.target.dataset.return);
  });
  $("checkoutMode").addEventListener("click", () => setMode("checkout"));
  $("returnMode").addEventListener("click", () => setMode("return"));
  $("startScanButton").addEventListener("click", startScanner);
  $("stopScanButton").addEventListener("click", stopScanner);
  $("manualScanForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await processQr($("manualQr").value);
    $("manualQr").value = "";
    $("manualQr").focus();
  });
  $("exportButton").addEventListener("click", exportData);
  $("importInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await importData(file);
    } catch (error) {
      showToast(error.message);
    } finally {
      event.target.value = "";
    }
  });
  $("clearButton").addEventListener("click", clearData);
  window.addEventListener("beforeunload", stopScanner);
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("sw.js");
    } catch {
      console.warn("Service worker registration failed");
    }
  }
}

async function init() {
  bindEvents();
  db = await openDb();
  await loadState();
  await registerServiceWorker();
}

init();
