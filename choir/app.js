const DB_NAME = "choir-books";
const DB_VERSION = 1;

const $ = (id) => document.getElementById(id);
const state = {
  members: [],
  books: [],
  events: [],
  pendingQr: "",
  stream: null,
  detector: null,
  scanTimer: null,
  scanBusy: false,
  scanMethod: "",
  qrCanvas: document.createElement("canvas"),
  qrContext: null,
  lastScan: { value: "", at: 0 },
};
state.qrContext = state.qrCanvas.getContext("2d", { willReadFrequently: true });

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
  const match = String(qr).match(/book(\d{4})(\d{4})/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
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
  renderScanResult();
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

function memberOptions(selectedId = "") {
  const members = activeMembers();
  return members.length
    ? members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("")
    : `<option value="">Add a member first</option>`;
}

function renderScanResult() {
  const panel = $("scanResult");
  const scanView = $("scanView");
  if (!panel) return;
  if (!state.pendingQr) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    scanView?.classList.remove("scan-has-result");
    return;
  }

  const book = state.books.find((item) => item.qr === state.pendingQr);
  panel.classList.remove("hidden");
  scanView?.classList.add("scan-has-result");

  if (book?.currentMemberId) {
    panel.innerHTML = `
      <h3>Book is checked out</h3>
      <p class="meta">Book ${escapeHtml(book.qr)}</p>
      <p class="meta">Assigned to ${escapeHtml(memberName(book.currentMemberId))}</p>
      <div class="actions">
        <button type="button" data-confirm-return="${escapeAttr(book.qr)}">Confirm Return</button>
        <button class="secondary" type="button" data-cancel-scan>Scan Another</button>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <h3>Book is available</h3>
    <p class="meta">Book ${escapeHtml(state.pendingQr)}</p>
    <label>
      <span>Assign to member</span>
      <select id="pendingMember">${memberOptions()}</select>
    </label>
    <div class="actions">
      <button type="button" data-confirm-checkout="${escapeAttr(state.pendingQr)}">Check Out</button>
      <button class="secondary" type="button" data-cancel-scan>Scan Another</button>
    </div>
  `;
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
  if (state.pendingQr) return;
  const now = Date.now();
  if (state.lastScan.value === qr && now - state.lastScan.at < 1800) return;
  state.lastScan = { value: qr, at: now };

  let book = state.books.find((item) => item.qr === qr);
  if (!book) {
    const timestamp = new Date().toISOString();
    book = {
      qr,
      firstSeenAt: timestamp,
      currentMemberId: "",
      updatedAt: timestamp,
    };
    await put("books", book);
    await loadState();
    addLog(`Added new book ${qr}`);
  }

  state.pendingQr = qr;
  renderScanResult();
}

async function checkoutBook(qr, memberId) {
  if (!memberId) {
    showToast("Add or select a member first");
    return false;
  }

  let book = state.books.find((item) => item.qr === qr);
  const now = new Date().toISOString();

  if (book?.currentMemberId && book.currentMemberId !== memberId) {
    const message = `Book ${qr} is assigned to ${memberName(book.currentMemberId)}. Transfer to ${memberName(memberId)}?`;
    if (!confirm(message)) {
      addLog(`Skipped ${qr}`);
      return false;
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
  return true;
}

async function returnBook(qr) {
  const book = state.books.find((item) => item.qr === qr);
  if (!book) {
    addLog(`Unknown book ${qr}`);
    showToast("Unknown book");
    return false;
  }
  if (!book.currentMemberId) {
    addLog(`${qr} is already unassigned`);
    showToast("Book is already returned");
    return false;
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
  return true;
}

function clearScanResult() {
  state.pendingQr = "";
  state.lastScan = { value: "", at: 0 };
  renderScanResult();
}

function addLog(message) {
  console.info(message);
}

async function startScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $("scannerMessage").textContent = "Camera access is not available here.";
    return;
  }
  try {
    stopScanner();
    if ("BarcodeDetector" in window) {
      state.detector = new BarcodeDetector({ formats: ["qr_code"] });
      state.scanMethod = "native";
    } else if (window.jsQR && state.qrContext) {
      state.detector = null;
      state.scanMethod = "jsqr";
    } else {
      $("scannerMessage").textContent = "QR decoder did not load. Check your connection.";
      return;
    }
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    $("scanVideo").srcObject = state.stream;
    await $("scanVideo").play();
    $("scannerMessage").textContent = "Point the camera at a QR code";
    state.scanTimer = setInterval(scanFrame, state.scanMethod === "native" ? 650 : 250);
  } catch (error) {
    $("scannerMessage").textContent = "Camera unavailable.";
    showToast("Camera permission or scanner support failed");
  }
}

async function scanFrame() {
  if (state.scanBusy || !$("scanVideo").srcObject) return;
  state.scanBusy = true;
  try {
    if (state.scanMethod === "native") {
      const codes = await state.detector.detect($("scanVideo"));
      if (codes[0]?.rawValue) {
        await processQr(codes[0].rawValue);
      }
    } else {
      const video = $("scanVideo");
      if (!video.videoWidth || !video.videoHeight) return;
      state.qrCanvas.width = video.videoWidth;
      state.qrCanvas.height = video.videoHeight;
      state.qrContext.drawImage(video, 0, 0, state.qrCanvas.width, state.qrCanvas.height);
      const image = state.qrContext.getImageData(0, 0, state.qrCanvas.width, state.qrCanvas.height);
      const code = window.jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
      if (code?.data) {
        await processQr(code.data);
      }
    }
  } catch {
    $("scannerMessage").textContent = "Scanner paused. Restart the camera.";
  } finally {
    state.scanBusy = false;
  }
}

function stopScanner() {
  clearInterval(state.scanTimer);
  state.scanTimer = null;
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
  }
  state.stream = null;
  state.scanBusy = false;
  state.scanMethod = "";
  state.detector = null;
  $("scanVideo").srcObject = null;
  $("scannerMessage").textContent = "Camera scanner is off";
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
      if (button.dataset.view !== "scanView") {
        stopScanner();
      }
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
  $("startScanButton").addEventListener("click", startScanner);
  $("stopScanButton").addEventListener("click", stopScanner);
  $("scanResult").addEventListener("click", async (event) => {
    const checkoutQr = event.target.dataset.confirmCheckout;
    const returnQr = event.target.dataset.confirmReturn;
    if (event.target.dataset.cancelScan !== undefined) {
      clearScanResult();
      return;
    }
    if (checkoutQr) {
      const success = await checkoutBook(checkoutQr, $("pendingMember")?.value || "");
      if (success) clearScanResult();
    }
    if (returnQr) {
      const success = await returnBook(returnQr);
      if (success) clearScanResult();
    }
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
