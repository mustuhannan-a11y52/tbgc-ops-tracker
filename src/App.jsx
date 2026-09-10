import { useState, useEffect, useMemo, Fragment } from "react";
import { Box, ClipboardList, Truck, History, CalendarDays, LogOut, Plus, Pencil, Trash2, X, Check, Download, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";

const QUALITY_OPTIONS = ["New", "Good", "Fair", "Needs Repair", "Damaged"];
const PROGRAM_STATUS = ["Planning", "Confirmed", "Completed", "Cancelled"];
const QUALITY_COLOR = { New: "#3F7D58", Good: "#4C8C6B", Fair: "#B9763F", "Needs Repair": "#C4522E", Damaged: "#8B2E1F" };
const PROGRAM_STATUS_COLOR = { Planning: "#6B7280", Confirmed: "#2F6FA6", Completed: "#3F7D58", Cancelled: "#C4522E" };

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

async function loadCollection(key) {
  try {
    const res = await window.storage.get(key, true);
    if (res && res.value) return JSON.parse(res.value);
    return [];
  } catch (e) {
    return [];
  }
}
async function saveCollection(key, data) {
  try {
    await window.storage.set(key, JSON.stringify(data), true);
  } catch (e) {
    console.error("Storage save failed", key, e);
  }
}

function transitStatus(t) {
  if (t.actualReturnDate) return "Returned";
  if (t.expectedReturnDate && t.expectedReturnDate < today()) return "Overdue";
  if (t.sentDate) return "In Transit";
  return "Packed";
}
const TRANSIT_STATUS_COLOR = { Packed: "#6B7280", "In Transit": "#2F6FA6", Overdue: "#C4522E", Returned: "#3F7D58" };

function downloadICS(events, filename) {
  const esc = (s) => String(s || "").replace(/[\n,;]/g, " ");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TBGC Ops//Inventory Tracker//EN"];
  events.forEach((e) => {
    const dt = e.date.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + genId() + "@tbgc-ops",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      "DTSTART;VALUE=DATE:" + dt,
      "SUMMARY:" + esc(e.title),
      "DESCRIPTION:" + esc(e.description || ""),
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("inventory");

  const [inventory, setInventory] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [transit, setTransit] = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [expandedProgramId, setExpandedProgramId] = useState(null);

  useEffect(() => {
    (async () => {
      const [inv, prog, trn, log] = await Promise.all([
        loadCollection("inventory-data"),
        loadCollection("programs-data"),
        loadCollection("transit-data"),
        loadCollection("activitylog-data"),
      ]);
      setInventory(inv);
      setPrograms(prog);
      setTransit(trn);
      setLogEntries(log);
      setLoading(false);
    })();
  }, []);

  async function pushLog(action, details) {
    const entry = { id: genId(), timestamp: new Date().toISOString(), user: user || "Unknown", action, details };
    const next = [entry, ...logEntries].slice(0, 500);
    setLogEntries(next);
    await saveCollection("activitylog-data", next);
  }
  async function persistInventory(next) { setInventory(next); await saveCollection("inventory-data", next); }
  async function persistPrograms(next) { setPrograms(next); await saveCollection("programs-data", next); }
  async function persistTransit(next) { setTransit(next); await saveCollection("transit-data", next); }

  const overdueCount = useMemo(() => transit.filter((t) => transitStatus(t) === "Overdue").length, [transit]);
  const activeProgramsCount = useMemo(() => programs.filter((p) => p.status === "Planning" || p.status === "Confirmed").length, [programs]);

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <GlobalStyle />
        <div className="login-card">
          <div className="login-badge">TBGC OPS</div>
          <h1 className="login-title">Inventory Repository</h1>
          <p className="login-sub">Bengaluru operations — sign in with your name to continue.</p>
          {(() => {
            const handleLogin = () => {
              const n = nameInput.trim();
              if (!n) return;
              setUser(n);
              setTimeout(() => pushLog("Logged in", n + " signed in"), 0);
            };
            return (
              <div>
                <input
                  className="login-input"
                  placeholder="Your name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                  autoFocus
                />
                <button className="btn btn-primary login-btn" type="button" onClick={handleLogin}>Enter workspace</button>
              </div>
            );
          })()}
          {loading && <p className="login-loading">Loading team data…</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <GlobalStyle />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TB</div>
          <div>
            <div className="brand-title">Ops Inventory</div>
            <div className="brand-sub">Bengaluru</div>
          </div>
        </div>
        <nav className="nav">
          <NavItem icon={CheckCircle2} label="Completed Programs" active={tab === "completed"} onClick={() => setTab("completed")} />
          <NavItem icon={Box} label="Inventory" active={tab === "inventory"} onClick={() => setTab("inventory")} />
          <NavItem icon={ClipboardList} label="Programs" active={tab === "programs"} onClick={() => setTab("programs")} />
          <NavItem icon={Truck} label="Transit" active={tab === "transit"} badge={overdueCount || null} onClick={() => setTab("transit")} />
          <NavItem icon={History} label="Activity Log" active={tab === "log"} onClick={() => setTab("log")} />
          <NavItem icon={CalendarDays} label="Calendar" active={tab === "calendar"} onClick={() => setTab("calendar")} />
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">{user}</div>
          <button className="link-btn" onClick={() => setUser(null)}>
            <LogOut size={14} /> Switch user
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="statbar">
          <Stat label="Inventory items" value={inventory.length} />
          <Stat label="Active programs" value={activeProgramsCount} />
          <Stat label="Shipments overdue" value={overdueCount} warn={overdueCount > 0} />
        </div>

        {tab === "completed" && <CompletedProgramsTab programs={programs} />}
        {tab === "inventory" && <InventoryTab inventory={inventory} programs={programs} persist={persistInventory} pushLog={pushLog} user={user} />}
        {tab === "programs" && <ProgramsTab programs={programs} inventory={inventory} transit={transit} persist={persistPrograms} pushLog={pushLog} user={user} expandedId={expandedProgramId} setExpandedId={setExpandedProgramId} />}
        {tab === "transit" && <TransitTab transit={transit} programs={programs} inventory={inventory} persist={persistTransit} persistPrograms={persistPrograms} persistInventory={persistInventory} pushLog={pushLog} user={user} onViewProgram={(id) => { setExpandedProgramId(id); setTab("programs"); }} />}
        {tab === "log" && <LogTab logEntries={logEntries} />}
        {tab === "calendar" && <CalendarTab programs={programs} transit={transit} />}
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button className={"nav-item" + (active ? " nav-item-active" : "")} onClick={onClick}>
      <Icon size={17} />
      <span>{label}</span>
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
}
function Stat({ label, value, warn }) {
  return (
    <div className="stat" style={warn ? { borderColor: "var(--warning)" } : undefined}>
      <div className="stat-value" style={warn ? { color: "var(--warning)" } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
function Pill({ text, color }) {
  return <span className="pill" style={{ background: color + "1a", color }}>{text}</span>;
}
function EmptyState({ text }) {
  return <div className="empty">{text}</div>;
}

/* ---------- INVENTORY ---------- */
function InventoryTab({ inventory, programs, persist, pushLog, user }) {
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const usageFor = (invId) =>
    programs.filter((p) => (p.materials || []).some((m) => m.inventoryId === invId)).map((p) => p.name);

  function openNew() { setForm({ name: "", activity: "", quantity: "", quality: "New", notes: "" }); setEditId(null); }
  function openEdit(item) { setForm({ ...item }); setEditId(item.id); }

  async function save() {
    if (!form.name.trim()) return;
    if (editId) {
      const next = inventory.map((i) => (i.id === editId ? { ...form, quantity: Number(form.quantity) || 0, updatedAt: new Date().toISOString() } : i));
      await persist(next);
      pushLog("Updated inventory item", form.name + " edited by " + user);
    } else {
      const item = { id: genId(), ...form, quantity: Number(form.quantity) || 0, addedBy: user, updatedAt: new Date().toISOString() };
      await persist([item, ...inventory]);
      pushLog("Added inventory item", form.name + " (" + item.quantity + ") logged by " + user);
    }
    setForm(null);
    setEditId(null);
  }
  async function confirmRemove(item) {
    await persist(inventory.filter((i) => i.id !== item.id));
    pushLog("Removed inventory item", item.name + " removed by " + user);
    setPendingDeleteId(null);
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Inventory</h2>
          <p className="section-sub">Everything held in the Bengaluru store, by activity.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> Add item</button>
      </div>

      {form && (
        <div className="form-card">
          <div className="form-grid">
            <Field label="Item name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Blindfolds" /></Field>
            <Field label="For activity"><input value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} placeholder="e.g. Trust Walk" /></Field>
            <Field label="Quantity"><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" /></Field>
            <Field label="Quality">
              <select value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })}>
                {QUALITY_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => { setForm(null); setEditId(null); }}><X size={14} /> Cancel</button>
            <button className="btn btn-primary" onClick={save}><Check size={14} /> {editId ? "Save changes" : "Add to inventory"}</button>
          </div>
        </div>
      )}

      {inventory.length === 0 ? (
        <EmptyState text="No items yet. Add the first piece of inventory to get started." />
      ) : (
        <table className="table">
          <thead><tr><th>Name</th><th>For activity</th><th>Qty</th><th>Quality</th><th>Used in programs</th><th></th></tr></thead>
          <tbody>
            {inventory.map((item) => {
              const usage = usageFor(item.id);
              return (
                <tr key={item.id}>
                  <td className="td-strong">{item.name}</td>
                  <td>{item.activity || "—"}</td>
                  <td>{item.quantity}</td>
                  <td><Pill text={item.quality} color={QUALITY_COLOR[item.quality] || "#6B7280"} /></td>
                  <td className="td-muted">{usage.length ? usage.join(", ") : "—"}</td>
                  <td className="td-actions">
                    {pendingDeleteId === item.id ? (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                        <button className="btn btn-primary btn-sm" style={{ background: "var(--warning)" }} onClick={() => confirmRemove(item)}>Delete</button>
                      </>
                    ) : (
                      <>
                        <button className="icon-btn" onClick={() => openEdit(item)}><Pencil size={14} /></button>
                        <button className="icon-btn" onClick={() => setPendingDeleteId(item.id)}><Trash2 size={14} /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ---------- PROGRAMS ---------- */
function ProgramsTab({ programs, inventory, transit, persist, pushLog, user, expandedId, setExpandedId }) {
  const [form, setForm] = useState(null);
  const [matPick, setMatPick] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [attachError, setAttachError] = useState(null);

  function openNew() { setForm({ name: "", client: "", date: today(), location: "", participants: "", status: "Planning", materials: [], notes: "" }); }

  async function confirmDeleteProgram(program) {
    await persist(programs.filter((p) => p.id !== program.id));
    pushLog("Deleted program", program.name + " deleted by " + user);
    setPendingDelete(null);
  }

  async function save() {
    if (!form.name.trim()) return;
    const program = { id: genId(), ...form, participants: Number(form.participants) || 0, createdBy: user, updatedAt: new Date().toISOString() };
    await persist([program, ...programs]);
    pushLog("Created program", form.name + " created by " + user);
    setForm(null);
  }
  async function updateProgram(id, patch, logMsg) {
    const next = programs.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p));
    await persist(next);
    if (logMsg) pushLog("Updated program", logMsg);
  }
  async function addMaterial(program) {
    const pick = matPick[program.id];
    if (!pick || !pick.invId || !pick.qty) return;
    const invItem = inventory.find((i) => i.id === pick.invId);
    if (!invItem) return;
    const materials = [...(program.materials || []), { inventoryId: invItem.id, name: invItem.name, qtyRequired: Number(pick.qty), qtySent: 0 }];
    await updateProgram(program.id, { materials }, invItem.name + " added to " + program.name + " by " + user);
    setMatPick({ ...matPick, [program.id]: { invId: "", qty: "" } });
  }
  async function removeMaterial(program, idx) {
    const materials = program.materials.filter((_, i) => i !== idx);
    await updateProgram(program.id, { materials });
  }
  async function handleAttach(program, file) {
    if (!file) return;
    setAttachError(null);
    if (file.size > 2 * 1024 * 1024) { setAttachError("Please keep attachments under 2MB — this is stored alongside all program data."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      await updateProgram(program.id, { attachment: { name: file.name, dataUrl: reader.result } }, file.name + " attached to " + program.name + " by " + user);
    };
    reader.readAsDataURL(file);
  }
  async function removeAttachment(program) {
    await updateProgram(program.id, { attachment: null }, program.attachment?.name + " removed from " + program.name + " by " + user);
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Programs</h2>
          <p className="section-sub">What materials each program needs, and what's actually been sent.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> New program</button>
      </div>

      {form && (
        <div className="form-card">
          <div className="form-grid">
            <Field label="Program name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Corp Offsite" /></Field>
            <Field label="Client"><input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Optional" /></Field>
            <Field label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Location"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Leela Palace" /></Field>
            <Field label="Participants"><input type="number" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} placeholder="e.g. 40" /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {PROGRAM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setForm(null)}><X size={14} /> Cancel</button>
            <button className="btn btn-primary" onClick={save}><Check size={14} /> Create program</button>
          </div>
        </div>
      )}

      {programs.length === 0 ? (
        <EmptyState text="No programs yet. Create one to start allocating materials." />
      ) : (
        <div className="card-list">
          {programs.map((p) => {
            const isOpen = expandedId === p.id;
            const shipments = transit.filter((t) => t.programId === p.id);
            const pick = matPick[p.id] || { invId: "", qty: "" };
            return (
              <div key={p.id} className="prog-card">
                <div className="prog-head" onClick={() => setExpandedId(isOpen ? null : p.id)}>
                  <div>
                    <div className="prog-name">{p.name}</div>
                    <div className="prog-meta">{p.client ? p.client + " · " : ""}{fmtDate(p.date)}{p.location ? " · " + p.location : ""}{p.participants ? " · " + p.participants + " participants" : ""}</div>
                  </div>
                  <div className="prog-head-right">
                    <Pill text={p.status} color={PROGRAM_STATUS_COLOR[p.status]} />
                    {pendingDelete === p.id ? (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setPendingDelete(null); }}>Cancel</button>
                        <button className="btn btn-primary btn-sm" style={{ background: "var(--warning)" }} onClick={(e) => { e.stopPropagation(); confirmDeleteProgram(p); }}>Delete</button>
                      </>
                    ) : (
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setPendingDelete(p.id); }}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="prog-body">
                    <div className="prog-sub-head">Materials</div>
                    {(p.materials || []).length === 0 ? (
                      <p className="td-muted" style={{ margin: "4px 0 12px" }}>No materials added yet.</p>
                    ) : (
                      <table className="table table-tight">
                        <thead><tr><th>Item</th><th>Required</th><th>Sent</th><th></th></tr></thead>
                        <tbody>
                          {p.materials.map((m, idx) => (
                            <tr key={idx}>
                              <td>{m.name}</td>
                              <td>{m.qtyRequired}</td>
                              <td>{m.qtySent || 0}</td>
                              <td className="td-actions"><button className="icon-btn" onClick={() => removeMaterial(p, idx)}><Trash2 size={13} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <div className="inline-form">
                      <select value={pick.invId} onChange={(e) => setMatPick({ ...matPick, [p.id]: { ...pick, invId: e.target.value } })}>
                        <option value="">Select inventory item…</option>
                        {inventory.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.quantity} in stock)</option>)}
                      </select>
                      <input className="inline-num" type="number" placeholder="Qty" value={pick.qty} onChange={(e) => setMatPick({ ...matPick, [p.id]: { ...pick, qty: e.target.value } })} />
                      <button className="btn btn-ghost btn-sm" onClick={() => addMaterial(p)}><Plus size={13} /> Add</button>
                    </div>

                    <div className="prog-sub-head" style={{ marginTop: 16 }}>Shipments</div>
                    {shipments.length === 0 ? (
                      <p className="td-muted" style={{ margin: "4px 0" }}>No shipments logged for this program yet — add one from the Transit tab.</p>
                    ) : (
                      shipments.map((t) => (
                        <div key={t.id} className="shipment-row">
                          <span>To <strong>{t.facilitator}</strong>, packed by {t.packedBy}</span>
                          <Pill text={transitStatus(t)} color={TRANSIT_STATUS_COLOR[transitStatus(t)]} />
                        </div>
                      ))
                    )}

                    <div className="prog-sub-head" style={{ marginTop: 16 }}>Attachment</div>
                    {p.attachment ? (
                      <div className="attach-row">
                        <a href={p.attachment.dataUrl} download={p.attachment.name}>{p.attachment.name}</a>
                        <button className="icon-btn" onClick={() => removeAttachment(p)}><Trash2 size={13} /></button>
                      </div>
                    ) : (
                      <input type="file" accept=".xlsx,.xls,.csv" className="file-input" onChange={(e) => handleAttach(p, e.target.files[0])} />
                    )}
                    {attachError && <p className="td-muted" style={{ color: "var(--warning)", marginTop: 6 }}>{attachError}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- COMPLETED PROGRAMS ---------- */
function CompletedProgramsTab({ programs }) {
  const completed = programs.filter((p) => p.status === "Completed");
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Completed programs</h2>
          <p className="section-sub">Closed programs — what was sent, and how much.</p>
        </div>
      </div>
      {completed.length === 0 ? (
        <EmptyState text="No programs marked Completed yet. A program closes automatically once every shipment tied to it is returned." />
      ) : (
        <div className="card-list">
          {completed.map((p) => (
            <div key={p.id} className="prog-card">
              <div className="prog-head" style={{ cursor: "default" }}>
                <div>
                  <div className="prog-name">{p.name}</div>
                  <div className="prog-meta">{p.client ? p.client + " · " : ""}{fmtDate(p.date)}{p.location ? " · " + p.location : ""}{p.participants ? " · " + p.participants + " participants" : ""}</div>
                </div>
                <Pill text="Completed" color={PROGRAM_STATUS_COLOR.Completed} />
              </div>
              <div className="prog-body">
                <div className="prog-sub-head">Materials sent</div>
                {(p.materials || []).length === 0 ? (
                  <p className="td-muted">No materials were recorded for this program.</p>
                ) : (
                  <table className="table table-tight">
                    <thead><tr><th>Item</th><th>Required</th><th>Sent</th></tr></thead>
                    <tbody>
                      {p.materials.map((m, idx) => (
                        <tr key={idx}>
                          <td>{m.name}</td>
                          <td>{m.qtyRequired}</td>
                          <td>{m.qtySent || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- TRANSIT ---------- */
function TransitTab({ transit, programs, inventory, persist, persistPrograms, persistInventory, pushLog, user, onViewProgram }) {
  const [form, setForm] = useState(null);
  const [checked, setChecked] = useState({});
  const [sendQty, setSendQty] = useState({});
  const [returningId, setReturningId] = useState(null);
  const [returnQuality, setReturnQuality] = useState({});
  const [expandedShipment, setExpandedShipment] = useState(null);

  function openNew() {
    setForm({ programId: "", facilitator: "", packedBy: user, sentDate: today(), expectedReturnDate: "", actualReturnDate: "", notes: "" });
    setChecked({});
    setSendQty({});
  }
  const selectedProgram = form ? programs.find((p) => p.id === form.programId) : null;

  async function adjustInventory(materials, sign) {
    const next = inventory.map((i) => {
      const m = materials.find((mm) => mm.inventoryId === i.id);
      if (!m) return i;
      return { ...i, quantity: Math.max(0, i.quantity + sign * m.qty) };
    });
    await persistInventory(next);
  }

  async function restoreInventoryWithQuality(materialsWithQuality) {
    const next = inventory.map((i) => {
      const m = materialsWithQuality.find((mm) => mm.inventoryId === i.id);
      if (!m) return i;
      return { ...i, quantity: i.quantity + m.qty, quality: m.returnedQuality || i.quality };
    });
    await persistInventory(next);
  }

  async function save() {
    if (!form.programId || !form.facilitator.trim()) return;
    const materials = (selectedProgram?.materials || [])
      .map((m, idx) => (checked[idx] ? { inventoryId: m.inventoryId, name: m.name, qty: Number(sendQty[idx] ?? m.qtyRequired) || 0 } : null))
      .filter(Boolean);
    const record = { id: genId(), ...form, programName: selectedProgram?.name || "", materials, updatedAt: new Date().toISOString() };
    await persist([record, ...transit]);
    if (materials.length) {
      await adjustInventory(materials, -1);
      const nextPrograms = programs.map((p) => {
        if (p.id !== form.programId) return p;
        const updatedMaterials = (p.materials || []).map((pm) => {
          const sent = materials.find((mm) => mm.inventoryId === pm.inventoryId);
          return sent ? { ...pm, qtySent: (pm.qtySent || 0) + sent.qty } : pm;
        });
        return { ...p, materials: updatedMaterials };
      });
      await persistPrograms(nextPrograms);
    }
    pushLog("Logged shipment", (selectedProgram?.name || "Program") + " sent to " + form.facilitator + " (packed by " + form.packedBy + ") — inventory reduced accordingly");
    setForm(null);
    setSendQty({});
  }

  function startReturn(rec) {
    const q = {};
    (rec.materials || []).forEach((m, idx) => {
      const invItem = inventory.find((i) => i.id === m.inventoryId);
      q[idx] = invItem ? invItem.quality : "Good";
    });
    setReturnQuality(q);
    setReturningId(rec.id);
  }
  function cancelReturn() { setReturningId(null); setReturnQuality({}); }

  async function confirmReturn(rec) {
    const materialsWithQuality = (rec.materials || []).map((m, idx) => ({ ...m, returnedQuality: returnQuality[idx] }));
    const next = transit.map((t) => (t.id === rec.id ? { ...t, actualReturnDate: today(), materials: materialsWithQuality } : t));
    await persist(next);
    if (materialsWithQuality.length) await restoreInventoryWithQuality(materialsWithQuality);

    const summary = materialsWithQuality.map((m) => m.name + " (" + m.returnedQuality + ")").join(", ") || "no materials";
    pushLog("Marked returned", rec.programName + " shipment from " + rec.facilitator + " returned by " + user + " — " + summary);

    if (rec.programId) {
      const stillOut = next.some((t) => t.programId === rec.programId && !t.actualReturnDate);
      if (!stillOut) {
        const program = programs.find((p) => p.id === rec.programId);
        if (program && program.status !== "Completed" && program.status !== "Cancelled") {
          const nextPrograms = programs.map((p) => (p.id === rec.programId ? { ...p, status: "Completed", updatedAt: new Date().toISOString() } : p));
          await persistPrograms(nextPrograms);
          pushLog("Program auto-closed", program.name + " marked Completed — all materials returned");
        }
      }
    }
    setReturningId(null);
    setReturnQuality({});
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Transit</h2>
          <p className="section-sub">What's been sent to facilitators, who packed it, and when it's due back.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} /> Log shipment</button>
      </div>

      {form && (
        <div className="form-card">
          <div className="form-grid">
            <Field label="Program">
              <select value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
                <option value="">Select program…</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Facilitator"><input value={form.facilitator} onChange={(e) => setForm({ ...form, facilitator: e.target.value })} placeholder="Who's receiving it" /></Field>
            <Field label="Packed by"><input value={form.packedBy} onChange={(e) => setForm({ ...form, packedBy: e.target.value })} /></Field>
            <Field label="Sent date"><input type="date" value={form.sentDate} onChange={(e) => setForm({ ...form, sentDate: e.target.value })} /></Field>
            <Field label="Expected return"><input type="date" value={form.expectedReturnDate} onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })} /></Field>
          </div>
          {selectedProgram && (
            <div>
              <div className="prog-sub-head">Materials to send</div>
              {(selectedProgram.materials || []).length === 0 ? (
                <p className="td-muted">This program has no materials allocated yet — add some on the Programs tab first.</p>
              ) : (
                selectedProgram.materials.map((m, idx) => {
                  const invItem = inventory.find((i) => i.id === m.inventoryId);
                  return (
                    <div key={idx} className="check-row" style={{ justifyContent: "space-between" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" checked={!!checked[idx]} onChange={(e) => setChecked({ ...checked, [idx]: e.target.checked })} />
                        {m.name} <span className="td-muted">({invItem ? invItem.quantity : 0} in stock)</span>
                      </label>
                      <input
                        className="inline-num"
                        type="number"
                        placeholder="Qty"
                        value={sendQty[idx] ?? m.qtyRequired}
                        onChange={(e) => setSendQty({ ...sendQty, [idx]: e.target.value })}
                        disabled={!checked[idx]}
                      />
                    </div>
                  );
                })
              )}
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setForm(null)}><X size={14} /> Cancel</button>
            <button className="btn btn-primary" onClick={save}><Check size={14} /> Log shipment</button>
          </div>
        </div>
      )}

      {transit.length === 0 ? (
        <EmptyState text="No shipments logged yet." />
      ) : (
        <table className="table">
          <thead><tr><th>Program</th><th>Facilitator</th><th>Packed by</th><th>Sent</th><th>Expected return</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {transit.map((t) => {
              const status = transitStatus(t);
              const isReturning = returningId === t.id;
              const isExpanded = expandedShipment === t.id;
              return (
                <Fragment key={t.id}>
                  <tr className="clickable-row" onClick={() => setExpandedShipment(isExpanded ? null : t.id)}>
                    <td className="td-strong">{t.programName}</td>
                    <td>{t.facilitator}</td>
                    <td>{t.packedBy}</td>
                    <td>{fmtDate(t.sentDate)}</td>
                    <td>{fmtDate(t.expectedReturnDate)}</td>
                    <td><Pill text={status} color={TRANSIT_STATUS_COLOR[status]} /></td>
                    <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                      {status !== "Returned" && !isReturning && <button className="btn btn-ghost btn-sm" onClick={() => startReturn(t)}>Mark returned</button>}
                      {status !== "Returned" && isReturning && <button className="btn btn-ghost btn-sm" onClick={cancelReturn}>Cancel</button>}
                    </td>
                  </tr>
                  {!isReturning && isExpanded && (
                    <tr>
                      <td colSpan={7} className="return-panel">
                        <div className="return-panel-inner">
                          <div className="prog-sub-head" style={{ marginTop: 0 }}>Materials in this shipment</div>
                          {(t.materials || []).length === 0 ? (
                            <p className="td-muted">No materials were logged on this shipment — it was likely sent before any items were checked off in the form.</p>
                          ) : (
                            t.materials.map((m, idx) => (
                              <div key={idx} className="shipment-row">
                                <span>{m.name}</span>
                                <span className="td-muted">qty {m.qty}{m.returnedQuality ? " · returned " + m.returnedQuality : ""}</span>
                              </div>
                            ))
                          )}
                          <div className="form-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => onViewProgram && onViewProgram(t.programId)}>View program</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isReturning && (
                    <tr>
                      <td colSpan={7} className="return-panel">
                        <div className="return-panel-inner">
                          <div className="prog-sub-head" style={{ marginTop: 0 }}>Condition of returned materials (required)</div>
                          {(t.materials || []).length === 0 ? (
                            <p className="td-muted">No materials were logged on this shipment, so there's nothing to grade — cancel and re-log the shipment with materials checked if this looks wrong.</p>
                          ) : (
                            t.materials.map((m, idx) => (
                              <div key={idx} className="check-row" style={{ justifyContent: "space-between" }}>
                                <span>{m.name} · qty {m.qty}</span>
                                <select
                                  className="return-quality-select"
                                  value={returnQuality[idx] || ""}
                                  onChange={(e) => setReturnQuality({ ...returnQuality, [idx]: e.target.value })}
                                >
                                  <option value="">Select quality…</option>
                                  {QUALITY_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                                </select>
                              </div>
                            ))
                          )}
                          <div className="form-actions">
                            <button className="btn btn-ghost btn-sm" onClick={cancelReturn}>Cancel</button>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={(t.materials || []).some((_, idx) => !returnQuality[idx])}
                              onClick={() => confirmReturn(t)}
                            >
                              Confirm return
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ---------- ACTIVITY LOG ---------- */
function LogTab({ logEntries }) {
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Activity log</h2>
          <p className="section-sub">An automatic record of who logged or changed what, across every tab.</p>
        </div>
      </div>
      {logEntries.length === 0 ? (
        <EmptyState text="Nothing recorded yet." />
      ) : (
        <div className="log-list">
          {logEntries.map((e) => (
            <div key={e.id} className="log-row">
              <div className="log-dot" />
              <div>
                <div className="log-action">{e.action}</div>
                <div className="log-details">{e.details}</div>
                <div className="log-time">{new Date(e.timestamp).toLocaleString("en-IN")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- CALENDAR ---------- */
function CalendarTab({ programs, transit }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const events = useMemo(() => {
    const ev = [];
    programs.forEach((p) => p.date && ev.push({ date: p.date, title: p.name, type: "Program", description: (p.location || ""), attachment: p.attachment }));
    transit.forEach((t) => t.expectedReturnDate && !t.actualReturnDate && ev.push({ date: t.expectedReturnDate, title: t.programName + " — return due", type: "Return", description: "From " + t.facilitator }));
    return ev;
  }, [programs, transit]);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsByDay = (d) => {
    const key = new Date(year, month, d).toISOString().slice(0, 10);
    return events.filter((e) => e.date === key);
  };
  const upcoming = events.filter((e) => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Calendar</h2>
          <p className="section-sub">Program dates and material return deadlines in one view.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => downloadICS(upcoming, "tbgc-ops-calendar.ics")}><Download size={14} /> Export upcoming (.ics)</button>
      </div>

      <div className="cal-layout">
        <div className="cal-card">
          <div className="cal-nav">
            <button className="icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
            <div className="cal-month">{cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
            <button className="icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="cal-grid cal-grid-head">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="cal-cell cal-cell-empty" />;
              const dayEvents = eventsByDay(d);
              const isToday = new Date(year, month, d).toISOString().slice(0, 10) === today();
              return (
                <div key={i} className={"cal-cell" + (isToday ? " cal-cell-today" : "")}>
                  <div className="cal-daynum">{d}</div>
                  {dayEvents.slice(0, 2).map((e, idx) => (
                    <div key={idx} className={"cal-event" + (e.type === "Return" ? " cal-event-return" : "")}>{e.title}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="cal-upcoming">
          <div className="prog-sub-head">Upcoming</div>
          {upcoming.length === 0 ? (
            <p className="td-muted">Nothing on the horizon.</p>
          ) : (
            upcoming.map((e, i) => (
              <div key={i} className="upcoming-row">
                <div>
                  <div className="upcoming-title">{e.title}</div>
                  <div className="td-muted">{fmtDate(e.date)}{e.description ? " · " + e.description : ""}</div>
                </div>
                {e.type === "Return" && <AlertTriangle size={14} color="var(--warning)" />}
                {e.attachment && <a href={e.attachment.dataUrl} download={e.attachment.name} title={"Download " + e.attachment.name} style={{ color: "var(--accent-dark)" }}><Download size={14} /></a>}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap');
      :root {
        --ink: #1B2430;
        --bg: #EEF1EF;
        --card: #FFFFFF;
        --accent: #B9763F;
        --accent-dark: #96602F;
        --success: #3F7D58;
        --warning: #C4522E;
        --text: #1B2430;
        --muted: #6B7280;
        --border: #DCE1DE;
      }
      * { box-sizing: border-box; }
      body, input, select, button { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      h1, h2, .brand-title, .prog-name, .stat-value { font-family: "Space Grotesk", -apple-system, sans-serif; }
      h2 { margin: 0; font-size: 20px; color: var(--text); font-weight: 600; }
      .section-sub { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
      .section-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 12px; }

      .login-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 36px; width: 340px; text-align: left; }
      .login-badge { display: inline-block; background: var(--accent); color: white; font-size: 11px; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 5px; margin-bottom: 14px; }
      .login-title { font-family: "Space Grotesk", sans-serif; font-size: 24px; margin: 0 0 6px; color: var(--text); }
      .login-sub { color: var(--muted); font-size: 13px; margin: 0 0 20px; }
      .login-input { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; margin-bottom: 12px; }
      .login-btn { width: 100%; justify-content: center; }
      .login-loading { color: var(--muted); font-size: 12px; margin-top: 12px; }

      .sidebar { width: 220px; background: var(--ink); color: white; display: flex; flex-direction: column; padding: 20px 14px; flex-shrink: 0; }
      .brand { display: flex; align-items: center; gap: 10px; padding: 0 6px 20px; }
      .brand-mark { width: 34px; height: 34px; border-radius: 8px; background: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; }
      .brand-title { font-size: 14px; font-weight: 600; }
      .brand-sub { font-size: 11px; color: #9CA7B4; }
      .nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; border: none; background: transparent; color: #C7CFD8; font-size: 13.5px; cursor: pointer; text-align: left; }
      .nav-item:hover { background: rgba(255,255,255,0.06); }
      .nav-item-active { background: var(--accent); color: white; }
      .nav-badge { margin-left: auto; background: var(--warning); color: white; font-size: 10px; padding: 1px 6px; border-radius: 10px; }
      .sidebar-foot { padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.1); }
      .user-chip { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
      .link-btn { display: flex; align-items: center; gap: 6px; background: none; border: none; color: #9CA7B4; font-size: 12px; cursor: pointer; padding: 0; }

      .main { flex: 1; padding: 28px 32px; min-width: 0; }
      .statbar { display: flex; gap: 12px; margin-bottom: 24px; }
      .stat { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px 18px; min-width: 140px; }
      .stat-value { font-size: 22px; font-weight: 700; color: var(--text); }
      .stat-label { font-size: 12px; color: var(--muted); margin-top: 2px; }

      .btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 8px 14px; font-size: 13.5px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
      .btn-primary { background: var(--accent); color: white; }
      .btn-primary:hover { background: var(--accent-dark); }
      .btn-ghost { background: transparent; border-color: var(--border); color: var(--text); }
      .btn-ghost:hover { background: #f2f2f2; }
      .btn-sm { padding: 5px 10px; font-size: 12.5px; }
      .icon-btn { background: none; border: none; color: var(--muted); cursor: pointer; padding: 5px; border-radius: 6px; }
      .icon-btn:hover { background: #eee; color: var(--text); }

      .form-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 20px; }
      .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 12px; }
      .field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: var(--muted); }
      .field input, .field select { padding: 8px 10px; border: 1px solid var(--border); border-radius: 7px; font-size: 13.5px; color: var(--text); }
      .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }

      .table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
      .table th { text-align: left; font-size: 11.5px; color: var(--muted); font-weight: 600; padding: 10px 14px; border-bottom: 1px solid var(--border); }
      .table td { padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 13.5px; color: var(--text); }
      .table tr:last-child td { border-bottom: none; }
      .table-tight th, .table-tight td { padding: 6px 10px; font-size: 13px; }
      .td-strong { font-weight: 600; }
      .td-muted { color: var(--muted); font-size: 12.5px; }
      .td-actions { display: flex; gap: 4px; }
      .inline-num { width: 64px; padding: 5px 7px; border: 1px solid var(--border); border-radius: 6px; }

      .pill { font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 20px; display: inline-block; }
      .empty { text-align: center; color: var(--muted); padding: 40px 0; font-size: 13.5px; border: 1px dashed var(--border); border-radius: 12px; }

      .card-list { display: flex; flex-direction: column; gap: 10px; }
      .prog-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
      .prog-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; cursor: pointer; }
      .prog-name { font-weight: 600; font-size: 15px; }
      .prog-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
      .prog-head-right { display: flex; align-items: center; gap: 8px; }
      .prog-body { padding: 0 18px 18px; border-top: 1px solid var(--border); }
      .prog-sub-head { font-size: 12px; font-weight: 600; color: var(--muted); margin: 14px 0 6px; }
      .inline-form { display: flex; gap: 8px; align-items: center; }
      .inline-form select { flex: 1; padding: 7px 9px; border: 1px solid var(--border); border-radius: 7px; }
      .shipment-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
      .shipment-row:last-child { border-bottom: none; }
      .check-row { display: flex; align-items: center; gap: 8px; font-size: 13.5px; padding: 4px 0; }
      .return-panel { background: #FBF8F3; border-bottom: 1px solid var(--border); padding: 0 !important; }
      .return-panel-inner { padding: 14px 18px; }
      .clickable-row { cursor: pointer; }
      .clickable-row:hover { background: #FAF8F4; }
      .return-quality-select { padding: 7px 10px; border: 1.5px solid var(--accent); border-radius: 7px; font-size: 13px; background: white; cursor: pointer; min-width: 160px; color: var(--text); }
      .attach-row { display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 13px; }
      .attach-row a { color: var(--accent-dark); text-decoration: none; font-weight: 600; }
      .file-input { font-size: 12.5px; }

      .log-list { display: flex; flex-direction: column; gap: 2px; }
      .log-row { display: flex; gap: 12px; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin-bottom: 6px; }
      .log-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); margin-top: 6px; flex-shrink: 0; }
      .log-action { font-weight: 600; font-size: 13.5px; }
      .log-details { font-size: 13px; color: var(--muted); margin-top: 1px; }
      .log-time { font-size: 11px; color: #9CA3AF; margin-top: 4px; }

      .cal-layout { display: grid; grid-template-columns: 1fr 260px; gap: 18px; align-items: flex-start; }
      .cal-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
      .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
      .cal-month { font-weight: 600; font-size: 14px; }
      .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
      .cal-grid-head { font-size: 11px; color: var(--muted); text-align: center; margin-bottom: 4px; }
      .cal-cell { min-height: 64px; border: 1px solid var(--border); border-radius: 7px; padding: 4px 5px; font-size: 11px; }
      .cal-cell-empty { border: none; }
      .cal-cell-today { border-color: var(--accent); background: #fbf3ec; }
      .cal-daynum { font-size: 11.5px; color: var(--muted); margin-bottom: 3px; }
      .cal-event { background: #eaf1ee; color: var(--success); border-radius: 4px; padding: 1px 4px; margin-bottom: 2px; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cal-event-return { background: #fbe9e4; color: var(--warning); }
      .cal-upcoming { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
      .upcoming-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); }
      .upcoming-row:last-child { border-bottom: none; }
      .upcoming-title { font-size: 13px; font-weight: 600; }
    `}</style>
  );
}
