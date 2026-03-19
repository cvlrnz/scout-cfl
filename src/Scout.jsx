import { useState, useEffect, useRef } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const CLAUDE  = "/api/claude";
const CO = "/api/co-search";
const MODEL   = "claude-sonnet-4-20250514";
const GMAIL   = "https://gmail.mcp.claude.com/mcp";

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  bg:      "#06070C",
  surface: "#0E1118",
  surf2:   "#151B26",
  surf3:   "#1B2231",
  border:  "#1A2033",
  borderB: "#252E42",
  accent:  "#E8A030",
  aDim:    "rgba(232,160,48,0.11)",
  aGlow:   "rgba(232,160,48,0.06)",
  text:    "#E2E8F5",
  text2:   "#7280A0",
  text3:   "#3D4860",
  green:   "#38BD74",
  red:     "#D55050",
  sidebar: "#090B12",
};

const F = {
  display: "'Syne', sans-serif",
  sans:    "'Plus Jakarta Sans', sans-serif",
  mono:    "'IBM Plex Mono', monospace",
};

function useGlobalStyles() {
  useEffect(() => {
    if (document.getElementById("scout-styles")) return;
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.id = "scout-styles";
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: ${C.bg}; }
      @keyframes fadeUp    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      @keyframes slideIn   { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
      @keyframes pulse     { 0%,100%{opacity:.3;transform:scale(.7)} 50%{opacity:1;transform:scale(1)} }
      @keyframes spin      { to { transform:rotate(360deg); } }
      ::-webkit-scrollbar { width:3px; }
      ::-webkit-scrollbar-track { background:transparent; }
      ::-webkit-scrollbar-thumb { background:${C.border}; border-radius:4px; }
      input::placeholder, textarea::placeholder { color:${C.text3}; }
      input, textarea, button { font-family: inherit; }
      a { color:inherit; }
    `;
    document.head.appendChild(style);
  }, []);
}

async function aiCall({ messages, system = "", tools = [], mcps = [] }) {
  const body = { model: MODEL, max_tokens: 1000, messages };
  if (system)      body.system      = system;
  if (tools.length) body.tools      = tools;
  if (mcps.length)  body.mcp_servers = mcps;
  const r = await fetch(CLAUDE, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`Claude ${r.status}: ${t}`); }
  return r.json();
}

async function contactOutSearch(token, payload) {
  const r = await fetch(`${CO}/people/search`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", token },
    body:    JSON.stringify({ ...payload, page: 1, reveal_info: true }),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`ContactOut ${r.status}: ${t.slice(0,200)}`); }
  return r.json();
}

const PARSE_TOOL = {
  name: "parse_search",
  description: "Extract structured B2B contact search parameters from user's natural language request",
  input_schema: {
    type: "object",
    properties: {
      job_title:    { type: "array", items: { type: "string" }, description: "Job titles to search" },
      location:     { type: "array", items: { type: "string" }, description: "Countries or cities" },
      industry:     { type: "array", items: { type: "string" }, description: "Industries" },
      seniority:    { type: "array", items: { type: "string", enum: ["founder","c_suite","vice_president","head","owner","director","manager","partner"] } },
      company_size: { type: "array", items: { type: "string", enum: ["1_10","11_50","51_200","201_500","501_1000","1001_5000","5001_10000","10001+"] } },
      summary:      { type: "string" },
      question:     { type: "string" },
    },
    required: ["summary"],
  },
};

const iS = {
  display: "block", width: "100%", padding: "10px 14px",
  background: C.surf2, border: `1px solid ${C.border}`, borderRadius: 8,
  color: C.text, fontFamily: F.mono, fontSize: 13, outline: "none",
};

const lS = {
  display: "block", fontSize: 10, fontWeight: 600, color: C.text2,
  marginBottom: 7, letterSpacing: "0.08em", textTransform: "uppercase",
};

function Btn({ children, onClick, disabled, variant = "primary", style: extra = {} }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: "9px 20px", borderRadius: 8, border: "none",
    fontFamily: F.sans, fontSize: 13, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1, ...extra,
  };
  const themed =
    variant === "primary" ? { background: C.accent, color: "#000" } :
    variant === "ghost"   ? { background: C.surf3, border: `1px solid ${C.border}`, color: C.text2 } :
    variant === "danger"  ? { background: "rgba(213,80,80,.15)", border: `1px solid ${C.red}40`, color: C.red } :
                           { background: "transparent", border: `1px solid ${C.borderB}`, color: C.text2 };
  return <button onClick={!disabled ? onClick : undefined} style={{ ...base, ...themed }}>{children}</button>;
}

function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 0.18, 0.36].map((d, i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: C.text3, display: "inline-block", animation: `pulse .9s ${d}s ease-in-out infinite` }} />
      ))}
    </span>
  );
}

async function sGet(key)      { try { const r = await window.storage.get(key); return r?.value ?? null; } catch { return null; } }
async function sSet(key, val) { try { await window.storage.set(key, val); } catch {} }

export default function Scout() {
  useGlobalStyles();
  const [screen,  setScreen]  = useState("setup");
  const [cfg,     setCfg]     = useState({ key: "", service: "" });
  const [leads,   setLeads]   = useState([]);
  const [msgs,    setMsgs]    = useState([]);
  const [summary, setSummary] = useState("");
  const [busy,    setBusy]    = useState(false);
  const [panel,   setPanel]   = useState(null);
  const chatEnd = useRef(null);

  useEffect(() => {
    (async () => {
      const c = await sGet("scout_cfg");
      if (c) { const parsed = JSON.parse(c); setCfg(parsed); if (parsed.key) { setScreen("chat"); bootMsgs(); } }
      const l = await sGet("scout_leads"); if (l) setLeads(JSON.parse(l));
      const s = await sGet("scout_summary"); if (s) setSummary(s);
    })();
  }, []);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  function bootMsgs() {
    setMsgs([{ r: "a", t: "Hey — I'm Scout. Tell me who you're looking for. Industry, job title, location, company size — whatever you have." }]);
  }

  async function handleSetup(key, service) {
    const c = { key: key.trim(), service: service.trim() };
    setCfg(c); await sSet("scout_cfg", JSON.stringify(c)); bootMsgs(); setScreen("chat");
  }

  async function handleSend(input) {
    if (!input.trim() || busy) return;
    const next = [...msgs, { r: "u", t: input }];
    setMsgs(next); setBusy(true);
    try {
      const aiMsgs = next.map(m => ({ role: m.r === "a" ? "assistant" : "user", content: m.t }));
      const data = await aiCall({ messages: aiMsgs, system: "You are Scout, a B2B prospecting assistant. Parse the user's request using parse_search. Make reasonable inferences. Always set summary.", tools: [PARSE_TOOL] });
      const tu = data.content?.find(b => b.type === "tool_use");
      const tx = data.content?.find(b => b.type === "text");
      if (tu?.input?.question) { setMsgs(m => [...m, { r: "a", t: tu.input.question }]); setBusy(false); return; }
      if (tu?.input) {
        const p = tu.input; const smry = p.summary || "your search";
        setSummary(smry); setMsgs(m => [...m, { r: "a", t: `Searching for ${smry}…` }]); await sSet("scout_summary", smry);
        const body = {};
        if (p.job_title?.length)    body.job_title    = p.job_title;
        if (p.location?.length)     body.location     = p.location;
        if (p.industry?.length)     body.industry     = p.industry;
        if (p.seniority?.length)    body.seniority    = p.seniority;
        if (p.company_size?.length) body.company_size = p.company_size;
        try {
          const res = await contactOutSearch(cfg.key, body);
          const raw = res.profiles || res.data || res.results || [];
          const norm = raw.map((x, i) => ({
            id: `${i}_${Date.now()}`, name: x.name || x.full_name || "Unknown",
            title: x.title || x.job_title || "—", company: x.company_name || x.company?.name || "—",
            email: x.email || x.work_email || x.emails?.[0] || "",
            linkedin: x.linkedin_url || "", location: x.locality || x.location || "",
            industry: x.company?.industry || x.industry || "", size: x.company?.size || x.company_size || "",
          }));
          setLeads(norm); await sSet("scout_leads", JSON.stringify(norm));
          const msg = norm.length === 0 ? "Didn't find anything. Try broadening your search." : `Found ${norm.length} contact${norm.length !== 1 ? "s" : ""}. Heading to your dashboard…`;
          setMsgs(m => [...m, { r: "a", t: msg }]);
          if (norm.length > 0) setTimeout(() => setScreen("leads"), 1300);
        } catch (err) {
          const cors = err.message.toLowerCase().includes("fetch") || err.message.includes("NetworkError");
          setMsgs(m => [...m, { r: "a", t: cors ? "⚠️ CORS restriction: ContactOut can't be reached directly from the browser. Your dev team needs a backend proxy (15-min setup)." : `ContactOut error: ${err.message}` }]);
        }
      } else if (tx) { setMsgs(m => [...m, { r: "a", t: tx.text }]); }
    } catch (err) { setMsgs(m => [...m, { r: "a", t: `Something went wrong: ${err.message}` }]); }
    setBusy(false);
  }

  async function generateEmail(lead) {
    setPanel(p => ({ ...p, aiLoading: true, status: "" }));
    try {
      const data = await aiCall({
        messages: [{ role: "user", content: `Write a cold B2B outreach email:\n- Name: ${lead.name}\n- Title: ${lead.title}\n- Company: ${lead.company}\n- Industry: ${lead.industry}\n- Location: ${lead.location}\n\nOffer: ${cfg.service || "AI and automation solutions"}\n\nRules: under 150 words, no generic openers, personalized, clear value prop, soft CTA.\n\nReturn ONLY JSON: {"subject":"...","body":"..."}` }],
        system: "Return ONLY a JSON object with 'subject' and 'body'. No markdown.",
      });
      const t = data.content?.find(b => b.type === "text")?.text || "{}";
      const { subject = "", body = "" } = JSON.parse(t.replace(/```json|```/g, "").trim());
      setPanel(p => ({ ...p, subject, body, aiLoading: false }));
    } catch {
      const name = lead.name.split(" ")[0];
      setPanel(p => ({ ...p, aiLoading: false, status: "AI gen failed — fallback inserted.", body: `Hi ${name},\n\nI came across ${lead.company} and wanted to reach out about ${cfg.service || "what we're building"}.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,` }));
    }
  }

  async function gmailOp(action) {
    const { lead, subject, body } = panel;
    if (!lead.email) { setPanel(p => ({ ...p, status: "No email address for this contact." })); return; }
    if (!body.trim()) { setPanel(p => ({ ...p, status: "Write an email body first." })); return; }
    setPanel(p => ({ ...p, gmailLoading: true, status: action === "draft" ? "Saving to Gmail drafts…" : "Sending via Gmail…" }));
    try {
      await aiCall({ messages: [{ role: "user", content: `${action === "draft" ? "Create a Gmail draft" : "Send an email via Gmail"}:\nTo: ${lead.email}\nSubject: ${subject || "(no subject)"}\nBody:\n${body}\n\n${action === "draft" ? "Create the draft and confirm." : "Send it now and confirm."}` }], mcps: [{ type: "url", url: GMAIL, name: "gmail" }] });
      setPanel(p => ({ ...p, gmailLoading: false, status: action === "draft" ? "✓ Draft saved in Gmail" : "✓ Sent via Gmail" }));
    } catch (err) { setPanel(p => ({ ...p, gmailLoading: false, status: `Error: ${err.message.slice(0, 80)}` })); }
  }

  if (screen === "setup") return <SetupScreen onSubmit={handleSetup} />;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: F.sans, color: C.text, background: C.bg, overflow: "hidden" }}>
      <Sidebar screen={screen} leadCount={leads.length} onNav={s => setScreen(s)} onNew={() => { bootMsgs(); setScreen("chat"); }} />
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {screen === "chat"     && <ChatView msgs={msgs} busy={busy} onSend={handleSend} chatEnd={chatEnd} />}
        {screen === "leads"    && <LeadsView leads={leads} summary={summary} onEmail={l => setPanel({ lead: l, subject: "", body: "", aiLoading: false, gmailLoading: false, status: "" })} onSearch={() => { bootMsgs(); setScreen("chat"); }} />}
        {screen === "settings" && <SettingsView cfg={cfg} setCfg={setCfg} onSave={async c => { setCfg(c); await sSet("scout_cfg", JSON.stringify(c)); }} />}
      </main>
      {panel && (<EmailPanel panel={panel} setPanel={setPanel} onGen={() => generateEmail(panel.lead)} onDraft={() => gmailOp("draft")} onSend={() => gmailOp("send")} onClose={() => setPanel(null)} />)}
    </div>
  );
}

function SetupScreen({ onSubmit }) {
  useGlobalStyles();
  const [key, setKey] = useState("");
  const [service, setService] = useState("");
  const valid = key.trim().length > 8;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg, fontFamily: F.sans, padding: 24 }}>
      <div style={{ position: "fixed", width: 700, height: 700, borderRadius: "50%", background: `radial-gradient(circle, ${C.aGlow} 0%, transparent 70%)`, top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 460, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "44px 44px 40px", position: "relative" }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: F.display, fontSize: 32, fontWeight: 800, letterSpacing: "-1px", color: C.text }}>SCOUT</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: "0.12em", background: C.aDim, padding: "2px 7px", borderRadius: 4, border: `1px solid ${C.accent}25` }}>by CFL</span>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.text3, letterSpacing: "0.07em" }}>PROSPECT · CONNECT · CLOSE</div>
        </div>
        <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.65, marginBottom: 32 }}>Your B2B outreach engine. Enter your API key to get started.</div>
        <label style={lS}>ContactOut API Key</label>
        <input type="password" placeholder="Your ContactOut API token" value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === "Enter" && valid && onSubmit(key, service)} style={{ ...iS, marginBottom: 22 }} />
        <label style={lS}>What are you selling? <span style={{ textTransform: "none", letterSpacing: "normal", color: C.text3, fontWeight: 400, marginLeft: 6 }}>(powers AI email generation)</span></label>
        <textarea placeholder="e.g. AI-powered customer service chatbot for e-commerce brands." value={service} onChange={e => setService(e.target.value)} rows={3} style={{ ...iS, resize: "none", fontFamily: F.sans, fontSize: 13, lineHeight: 1.55, marginBottom: 28 }} />
        <Btn onClick={() => onSubmit(key, service)} disabled={!valid} style={{ width: "100%", padding: "12px 0", fontSize: 14 }}>Start Prospecting →</Btn>
        <div style={{ marginTop: 20, textAlign: "center", fontFamily: F.mono, fontSize: 10, color: C.text3 }}>Keys stored locally in your browser · Never transmitted externally</div>
      </div>
    </div>
  );
}

function Sidebar({ screen, leadCount, onNav, onNew }) {
  const nav = [
    { id: "chat", icon: "◎", label: "Search" },
    { id: "leads", icon: "⊞", label: leadCount ? `Leads (${leadCount})` : "Leads" },
    { id: "settings", icon: "◇", label: "Settings" },
  ];
  return (
    <aside style={{ width: 196, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 800, letterSpacing: "-0.5px" }}>SCOUT</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.text3, letterSpacing: "0.1em", marginTop: 3 }}>CONTROLFLOW LABS</div>
      </div>
      <nav style={{ padding: "14px 10px", flex: 1 }}>
        {nav.map(n => {
          const active = screen === n.id;
          return (<button key={n.id} onClick={() => onNav(n.id)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", fontFamily: F.sans, fontSize: 13, fontWeight: active ? 600 : 500, background: active ? C.aDim : "transparent", color: active ? C.accent : C.text2, marginBottom: 2 }}>
            <span style={{ fontFamily: F.mono, fontSize: 14, lineHeight: 1, opacity: active ? 1 : 0.7 }}>{n.icon}</span>{n.label}
          </button>);
        })}
      </nav>
      <div style={{ padding: "12px 12px 16px", borderTop: `1px solid ${C.border}` }}>
        <button onClick={onNew} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${C.accent}20`, background: C.aDim, color: C.accent, fontFamily: F.sans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ New Search</button>
      </div>
    </aside>
  );
}

function ChatView({ msgs, busy, onSend, chatEnd }) {
  const [inp, setInp] = useState("");
  const send = () => { if (!inp.trim()) return; onSend(inp); setInp(""); };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <header style={{ padding: "18px 28px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700 }}>Prospect Search</div>
        <div style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>Describe your target in plain English</div>
      </header>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.r === "u" ? "flex-end" : "flex-start" }}>
            {m.r === "a" && (<div style={{ width: 28, height: 28, borderRadius: "50%", background: C.aDim, border: `1px solid ${C.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: 11, fontWeight: 500, color: C.accent, flexShrink: 0, marginRight: 10, marginTop: 2 }}>S</div>)}
            <div style={{ maxWidth: "68%", padding: "11px 15px", borderRadius: m.r === "u" ? "14px 14px 4px 14px" : "4px 14px 14px 14px", background: m.r === "u" ? C.accent : C.surface, color: m.r === "u" ? "#000" : C.text, fontSize: 14, lineHeight: 1.6, fontWeight: m.r === "u" ? 600 : 400, border: m.r === "u" ? "none" : `1px solid ${C.border}` }}>{m.t}</div>
          </div>
        ))}
        {busy && (<div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: C.aDim, border: `1px solid ${C.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: 11, color: C.accent }}>S</div><div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "4px 14px 14px 14px", padding: "11px 16px" }}><Dots /></div></div>)}
        <div ref={chatEnd} />
      </div>
      <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10, flexShrink: 0 }}>
        <textarea value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="e.g. Sales managers at skincare clinics in Singapore, 10–200 employees…" rows={2} style={{ ...iS, flex: 1, resize: "none", fontFamily: F.sans, fontSize: 13, lineHeight: 1.5 }} />
        <button onClick={send} disabled={!inp.trim() || busy} style={{ padding: "0 20px", background: C.accent, border: "none", borderRadius: 8, color: "#000", fontSize: 18, fontWeight: 700, cursor: !inp.trim() || busy ? "not-allowed" : "pointer", opacity: !inp.trim() || busy ? 0.4 : 1, alignSelf: "stretch" }}>→</button>
      </div>
    </div>
  );
}

function LeadsView({ leads, summary, onEmail, onSearch }) {
  const [q, setQ] = useState("");
  const filtered = q ? leads.filter(l => `${l.name} ${l.company} ${l.title} ${l.industry} ${l.location}`.toLowerCase().includes(q.toLowerCase())) : leads;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <header style={{ padding: "18px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <div style={{ flex: 1 }}><div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700 }}>{leads.length} Lead{leads.length !== 1 ? "s" : ""}{summary && <span style={{ fontFamily: F.sans, fontWeight: 400, fontSize: 13, color: C.text2, marginLeft: 10 }}>— {summary}</span>}</div></div>
        <input placeholder="Filter leads…" value={q} onChange={e => setQ(e.target.value)} style={{ ...iS, width: 190, padding: "8px 12px" }} />
        <Btn onClick={onSearch} style={{ padding: "8px 16px", whiteSpace: "nowrap" }}>+ New Search</Btn>
      </header>
      {leads.length === 0 ? (<div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: C.text3 }}><div style={{ fontSize: 48, opacity: 0.4, fontFamily: F.mono }}>⊞</div><div style={{ fontSize: 14 }}>No leads yet — run a search to get started.</div><Btn onClick={onSearch}>Start Searching</Btn></div>) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {filtered.length === 0 ? (<div style={{ textAlign: "center", color: C.text3, padding: 60, fontFamily: F.mono, fontSize: 12 }}>No matches for "{q}"</div>) : (<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>{filtered.map(l => <LeadCard key={l.id} lead={l} onEmail={onEmail} />)}</div>)}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, onEmail }) {
  const [hov, setHov] = useState(false);
  const ini = lead.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ background: C.surface, border: `1px solid ${hov ? C.accent + "45" : C.border}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12, transition: "border-color .15s, box-shadow .15s", boxShadow: hov ? `0 0 0 1px ${C.accent}12, 0 4px 20px rgba(0,0,0,.3)` : "none" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: C.aDim, border: `1px solid ${C.accent}28`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.display, fontSize: 14, fontWeight: 700, color: C.accent }}>{ini}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.name}</div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.title}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lead.company  && <DR label="Co."  val={lead.company} />}
        {lead.industry && <DR label="Ind." val={lead.industry} mono />}
        {lead.location && <DR label="Loc." val={lead.location} mono />}
        {lead.size     && <DR label="Size" val={`${lead.size} employees`} mono />}
        <DR label="Email" val={lead.email || "Not revealed"} mono accent={!!lead.email} muted={!lead.email} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <button onClick={() => onEmail(lead)} style={{ flex: 1, padding: "8px 0", background: C.accent, border: "none", borderRadius: 8, color: "#000", fontFamily: F.sans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✉ Email</button>
        {lead.linkedin && (<a href={lead.linkedin} target="_blank" rel="noreferrer" style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, color: C.text2, fontFamily: F.mono, fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", background: "transparent" }}>in</a>)}
      </div>
    </div>
  );
}

function DR({ label, val, mono, accent, muted }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
      <span style={{ fontFamily: F.mono, fontSize: 9, color: C.text3, letterSpacing: "0.05em", textTransform: "uppercase", width: 32, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: mono ? F.mono : F.sans, fontSize: 12, color: accent ? C.accent : muted ? C.text3 : C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</span>
    </div>
  );
}

function EmailPanel({ panel, setPanel, onGen, onDraft, onSend, onClose }) {
  const { lead, subject, body, aiLoading, gmailLoading, status } = panel;
  const upd = (k, v) => setPanel(p => ({ ...p, [k]: v }));
  const ini = lead.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const busy = aiLoading || gmailLoading;
  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 500, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", boxShadow: "-16px 0 60px rgba(0,0,0,.55)", zIndex: 200, animation: "slideIn .22s ease" }}>
      <div style={{ padding: "18px 20px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: C.aDim, border: `1px solid ${C.accent}28`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.display, fontWeight: 700, color: C.accent, fontSize: 14, flexShrink: 0 }}>{ini}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{lead.name}</div><div style={{ fontSize: 12, color: C.text2, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.title} · {lead.company}</div></div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
      </div>
      <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", width: 30, flexShrink: 0 }}>To</span>
        <span style={{ fontFamily: F.mono, fontSize: 12, color: lead.email ? C.text : C.text3 }}>{lead.email || "No email available for this contact"}</span>
      </div>
      <div style={{ padding: "0 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", width: 30, flexShrink: 0 }}>Sub</span>
        <input value={subject} onChange={e => upd("subject", e.target.value)} placeholder="Subject line…" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: F.sans, fontSize: 13, padding: "11px 0" }} />
      </div>
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        {aiLoading && (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${C.surface}cc`, zIndex: 2, flexDirection: "column", gap: 12 }}><div style={{ width: 28, height: 28, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin .7s linear infinite" }} /><div style={{ fontFamily: F.mono, fontSize: 12, color: C.text2 }}>Generating…</div></div>)}
        <textarea value={body} onChange={e => upd("body", e.target.value)} placeholder="Write your email, or click ✦ AI Generate…" style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontFamily: F.sans, fontSize: 13, lineHeight: 1.7, padding: "16px 20px", resize: "none" }} />
      </div>
      <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
        {status && (<div style={{ fontFamily: F.mono, fontSize: 11, textAlign: "center", padding: "6px 12px", borderRadius: 6, background: status.startsWith("✓") ? "rgba(56,189,116,.1)" : status.startsWith("Error") ? "rgba(213,80,80,.1)" : C.surf3, color: status.startsWith("✓") ? C.green : status.startsWith("Error") ? C.red : C.text2 }}>{status}</div>)}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onGen} disabled={busy} style={{ flex: 1, padding: "9px 0", background: C.surf3, border: `1px solid ${C.border}`, borderRadius: 8, color: busy ? C.text3 : C.text, fontFamily: F.sans, fontSize: 12, fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1 }}>✦ AI Generate</button>
          <button onClick={onDraft} disabled={busy || !body.trim()} style={{ flex: 1, padding: "9px 0", background: C.surf3, border: `1px solid ${C.border}`, borderRadius: 8, color: busy || !body.trim() ? C.text3 : C.text, fontFamily: F.sans, fontSize: 12, fontWeight: 500, cursor: busy || !body.trim() ? "not-allowed" : "pointer", opacity: busy || !body.trim() ? 0.5 : 1 }}>{gmailLoading && !aiLoading ? "…" : "↓ Save Draft"}</button>
          <button onClick={onSend} disabled={busy || !body.trim() || !lead.email} style={{ flex: 1, padding: "9px 0", background: C.accent, border: "none", borderRadius: 8, color: "#000", fontFamily: F.sans, fontSize: 12, fontWeight: 700, cursor: busy || !body.trim() || !lead.email ? "not-allowed" : "pointer", opacity: busy || !body.trim() || !lead.email ? 0.45 : 1 }}>{gmailLoading && !aiLoading ? "…" : "↗ Send"}</button>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ cfg, setCfg, onSave }) {
  const [local, setLocal] = useState(cfg);
  const [saved, setSaved] = useState(false);
  async function save() { await onSave(local); setSaved(true); setTimeout(() => setSaved(false), 2500); }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <header style={{ padding: "18px 28px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700 }}>Settings</div>
        <div style={{ fontSize: 12, color: C.text2, marginTop: 3 }}>API keys and service configuration</div>
      </header>
      <div style={{ padding: "36px 36px", maxWidth: 560 }}>
        <label style={lS}>ContactOut API Key</label>
        <input type="password" value={local.key} onChange={e => setLocal(l => ({ ...l, key: e.target.value }))} style={{ ...iS, marginBottom: 28 }} />
        <label style={lS}>Service Description <span style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 400, color: C.text3, marginLeft: 6 }}>(used for AI email generation)</span></label>
        <textarea value={local.service} onChange={e => setLocal(l => ({ ...l, service: e.target.value }))} placeholder="What does your company do?" rows={4} style={{ ...iS, resize: "none", fontFamily: F.sans, fontSize: 13, lineHeight: 1.55, marginBottom: 28 }} />
        <Btn onClick={save} style={{ padding: "10px 28px", fontSize: 14 }}>{saved ? "✓ Saved" : "Save Changes"}</Btn>
        <div style={{ marginTop: 40, padding: 20, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.accent, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>About SCOUT</div>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7 }}>Scout uses the <strong style={{ color: C.text, fontWeight: 600 }}>ContactOut API</strong> to find contacts, <strong style={{ color: C.text, fontWeight: 600 }}>Claude AI</strong> to parse search intent and generate personalized emails, and your connected <strong style={{ color: C.text, fontWeight: 600 }}>Gmail</strong> account to create drafts and send.</div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: C.surf2, borderRadius: 8, fontFamily: F.mono, fontSize: 11, color: C.text3 }}>⚠️ ContactOut requires a backend proxy for browser-based apps (CORS). Contact your dev team if searches fail.</div>
        </div>
      </div>
    </div>
  );
}
