window.CF = window.CF || {};

const API_BASE = window.__API_BASE__ || "http://localhost:5000/api";

CF.state = {
  user: null,
  role: "author",
  conferences: [],
  papers: [],
  assignedReviews: [],
  notifications: [],
  activeConf: null,
  activeReviewId: null,
  activeDecisionPaperId: null,
  decisionContext: null,
  timeline: [],
  analytics: null,
  dashTab: "overview",
  filterTag: "all",
  searchQuery: ""
};

CF.persistUser = function() {
  try {
    localStorage.setItem("cf-user", JSON.stringify(CF.state.user || null));
  } catch (_err) {}
};

CF.restoreUser = function() {
  try {
    const raw = localStorage.getItem("cf-user");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid) {
      CF.state.user = parsed;
      CF.state.role = parsed.role || "author";
    }
  } catch (_err) {}
};

CF.navigate = function(page, data) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const current = document.getElementById(`page-${page}`);
  if (!current) return;
  current.classList.add("active");
  if (data) CF.state.activeConf = data;
  if (page === "conferences") CF.loadConferences();
  if (page === "conf-detail") CF.renderConfDetail();
  if (page === "dashboard") CF.renderDashboard();
};

CF.toast = function(msg, type = "info") {
  const t = document.getElementById("cf-toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `cf-toast show cf-toast--${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3000);
};

CF.api = async function(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.msg || `Request failed: ${res.status}`);
  }
  return res.json();
};

CF.getToken = async function() {
  if (!window.__FIREBASE_READY__ || !window.FirebaseServices) return null;
  const user = window.FirebaseServices.AuthService.getCurrentUser();
  if (!user) return null;
  return user.getIdToken();
};

CF.withAuthHeaders = async function(baseHeaders = {}) {
  const token = await CF.getToken();
  if (token) {
    return {
      ...baseHeaders,
      Authorization: `Bearer ${token}`,
      "x-user-role": CF.state.role || "author"
    };
  }
  if (CF.state.user?.uid) {
    return {
      ...baseHeaders,
      "x-demo-user": CF.state.user.uid,
      "x-user-role": CF.state.role || "author"
    };
  }
  return baseHeaders;
};

CF.handleLogin = async function(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail")?.value?.trim();
  const password = document.getElementById("loginPass")?.value;
  if (!window.__FIREBASE_READY__ || !window.FirebaseServices) {
    CF.state.user = { uid: `demo-${Date.now()}`, name: email?.split("@")[0] || "Demo User", role: "author" };
    CF.state.role = "author";
    CF.persistUser();
    CF.toast("Signed in (demo mode)", "success");
    CF.navigate("dashboard");
    return;
  }
  try {
    const fbUser = await window.FirebaseServices.AuthService.login(email, password);
    const profile = await window.FirebaseServices.UserService.getProfile(fbUser.uid).catch(() => null);
    CF.state.user = {
      uid: fbUser.uid,
      name: fbUser.displayName || email.split("@")[0],
      role: profile?.role || "author"
    };
    CF.state.role = CF.state.user.role;
    CF.persistUser();
    CF.toast("Signed in", "success");
    CF.navigate("dashboard");
  } catch (err) {
    CF.toast(err.message || "Login failed", "error");
  }
};

CF.handleRegister = async function(e) {
  e.preventDefault();
  const first = document.getElementById("regFirst")?.value?.trim() || "";
  const last = document.getElementById("regLast")?.value?.trim() || "";
  const email = document.getElementById("regEmail")?.value?.trim();
  const password = document.getElementById("regPass")?.value;
  const role = document.getElementById("regRole")?.value || "author";
  const institution = document.getElementById("regInst")?.value?.trim() || "";
  if (!window.__FIREBASE_READY__ || !window.FirebaseServices) {
    CF.state.user = {
      uid: `demo-${Date.now()}`,
      name: `${first} ${last}`.trim() || "Demo User",
      role
    };
    CF.state.role = role;
    CF.persistUser();
    CF.toast("Account created (demo mode)", "success");
    CF.navigate("dashboard");
    return;
  }
  try {
    const fbUser = await window.FirebaseServices.AuthService.register(
      email,
      password,
      `${first} ${last}`.trim(),
      role,
      institution
    );
    CF.state.user = { uid: fbUser.uid, name: fbUser.displayName || first || "User", role };
    CF.state.role = role;
    CF.persistUser();
    CF.toast("Account created", "success");
    CF.navigate("dashboard");
  } catch (err) {
    CF.toast(err.message || "Registration failed", "error");
  }
};

CF.logout = async function() {
  if (window.__FIREBASE_READY__ && window.FirebaseServices) {
    await window.FirebaseServices.AuthService.logout().catch(() => {});
  }
  CF.state.user = null;
  CF.state.role = "author";
  CF.state.papers = [];
  CF.persistUser();
  CF.navigate("home");
};

CF.selectRole = function(el, role) {
  document.querySelectorAll(".role-card").forEach((card) => card.classList.remove("active"));
  el.classList.add("active");
  const roleInput = document.getElementById("regRole");
  if (roleInput) roleInput.value = role;
};

CF.loginWithGoogle = async function() {
  if (!window.__FIREBASE_READY__ || !window.FirebaseServices) {
    CF.toast("Firebase is not configured", "error");
    return;
  }
  try {
    const fbUser = await window.FirebaseServices.AuthService.loginWithGoogle();
    const profile = await window.FirebaseServices.UserService.getProfile(fbUser.uid).catch(() => null);
    CF.state.user = { uid: fbUser.uid, name: fbUser.displayName || "User", role: profile?.role || "author" };
    CF.state.role = CF.state.user.role;
    CF.persistUser();
    CF.navigate("dashboard");
  } catch (_err) {
    CF.toast("Google sign-in failed", "error");
  }
};

CF.loginWithGithub = async function() {
  if (!window.__FIREBASE_READY__ || !window.FirebaseServices) {
    CF.toast("Firebase is not configured", "error");
    return;
  }
  try {
    const fbUser = await window.FirebaseServices.AuthService.loginWithGithub();
    const profile = await window.FirebaseServices.UserService.getProfile(fbUser.uid).catch(() => null);
    CF.state.user = { uid: fbUser.uid, name: fbUser.displayName || "User", role: profile?.role || "author" };
    CF.state.role = CF.state.user.role;
    CF.persistUser();
    CF.navigate("dashboard");
  } catch (_err) {
    CF.toast("GitHub sign-in failed", "error");
  }
};

CF.loadConferences = async function() {
  try {
    CF.state.conferences = await CF.api("/conferences");
    if (!CF.state.conferences.length) {
      await CF.api("/conferences/seed", { method: "POST" });
      CF.state.conferences = await CF.api("/conferences");
    }
  } catch (_err) {
    CF.state.conferences = [];
  }
  CF.renderConferences();
};

CF.renderConferences = function() {
  const grid = document.getElementById("confGrid");
  if (!grid) return;

  const q = CF.state.searchQuery.toLowerCase();
  const tag = CF.state.filterTag;

  let list = CF.state.conferences.filter((c) => {
    if (tag === "all") return true;
    return (c.domain || "").toLowerCase() === tag.toLowerCase();
  });

  list = list.filter((c) => {
    const title = (c.title || "").toLowerCase();
    const abbr = (c.abbr || "").toLowerCase();
    const domain = (c.domain || "").toLowerCase();
    return title.includes(q) || abbr.includes(q) || domain.includes(q);
  });

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h4>No conferences found</h4></div>`;
    return;
  }

  grid.innerHTML = list
    .map(
      (c) => `
      <article class="conf-card" onclick="CF.openConf('${c._id}')" style="--card-accent:#6366f1">
        <div class="conf-card__accent"></div>
        <div class="conf-card__body">
          <div class="conf-card__top">
            <span class="tag tag--domain">${c.domain || "General"}</span>
            <span class="tag tag--open">Open</span>
          </div>
          <h3 class="conf-card__abbr">${c.abbr || "CONF"}</h3>
          <p class="conf-card__org">${c.org || "-"}</p>
          <p class="conf-card__title">${c.title || "-"}</p>
          <div class="conf-card__meta"><span>${c.location || "TBD"}</span><span>📅 ${c.date || "TBD"}</span></div>
        </div>
      </article>`
    )
    .join("");
};

CF.openConf = function(id) {
  CF.state.activeConf = CF.state.conferences.find((c) => c._id === id) || null;
  CF.navigate("conf-detail");
};

CF.renderConfDetail = function() {
  const container = document.getElementById("confDetailContent");
  const conf = CF.state.activeConf;
  if (!container || !conf) return;
  container.innerHTML = `
    <div class="conf-detail">
      <h1 class="conf-detail__title">${conf.title || "-"}</h1>
      <p class="conf-detail__desc">${conf.org || ""} · ${conf.location || ""} · ${conf.date || ""}</p>
      <div class="section-block">
        <h3 class="section-block__title">Tracks</h3>
        <div class="tracks-grid">
          ${(conf.tracks || []).map((t) => `<div class="track-chip">${t}</div>`).join("") || "<div class='track-chip'>No tracks yet</div>"}
        </div>
      </div>
      <button class="btn btn--primary" onclick="CF.requireAuth('submit')">Submit Paper</button>
    </div>
  `;
};

CF.filterByTag = function(el, tag) {
  document.querySelectorAll(".filter-tag").forEach((b) => b.classList.remove("active"));
  el.classList.add("active");
  CF.state.filterTag = tag;
  CF.renderConferences();
};

CF.filterSearch = function(value) {
  CF.state.searchQuery = value || "";
  CF.renderConferences();
};

CF.requireAuth = function(tab) {
  if (!CF.state.user) return CF.navigate("login");
  CF.state.dashTab = tab;
  CF.navigate("dashboard");
};

CF.switchTab = function(tab) {
  CF.state.dashTab = tab;
  CF.renderDashboard();
};

CF.renderDashboard = async function() {
  if (!CF.state.user) {
    CF.navigate("login");
    return;
  }
  const items = [
    { id: "overview", label: "Overview", icon: "⬡" },
    { id: "papers", label: "My Papers", icon: "◈" },
    { id: "submit", label: "Submit Paper", icon: "⊕" },
    { id: "notifications", label: "Notifications", icon: "◎" }
  ];
  if (CF.state.role === "reviewer") {
    items.push({ id: "assigned-reviews", label: "Assigned Reviews", icon: "◐" });
  }
  if (CF.state.role === "chair") {
    items.push({ id: "create-conf", label: "Create Conference", icon: "◎" });
    items.push({ id: "assign-reviewers", label: "Assign Reviewers", icon: "◉" });
    items.push({ id: "decisions", label: "Decisions", icon: "◈" });
    items.push({ id: "analytics", label: "Analytics", icon: "◑" });
  }
  const nav = document.getElementById("sidebarNav");
  if (nav) {
    nav.innerHTML = items
      .map(
        (i) =>
          `<button class="nav-item ${CF.state.dashTab === i.id ? "active" : ""}" onclick="CF.switchTab('${i.id}')"><span class="nav-item__icon">${i.icon}</span>${i.label}</button>`
      )
      .join("");
  }
  const name = document.getElementById("sidebarName");
  const role = document.getElementById("sidebarRole");
  const avatar = document.getElementById("sidebarAvatar");
  if (name) name.textContent = CF.state.user.name;
  if (role) role.textContent = CF.state.user.role;
  if (avatar) avatar.textContent = CF.state.user.name.slice(0, 2).toUpperCase();

  if (CF.state.dashTab === "papers" || CF.state.dashTab === "overview") {
    await CF.loadPapers();
  }
  if (CF.state.dashTab === "assign-reviewers") {
    await CF.loadAllPapers();
  }
  if (CF.state.dashTab === "decisions") {
    await CF.loadAllPapers();
  }
  if (CF.state.dashTab === "assigned-reviews" || CF.state.dashTab === "review-form") {
    await CF.loadAssignedReviews();
  }
  if (CF.state.dashTab === "notifications") {
    await CF.loadNotifications();
  }
  if (CF.state.dashTab === "analytics") {
    await CF.loadAnalytics();
  }
  if (CF.state.dashTab === "decision-detail" && CF.state.activeDecisionPaperId) {
    await CF.loadDecisionContext(CF.state.activeDecisionPaperId);
  }
  CF.renderTab();
};

CF.loadPapers = async function() {
  const headers = await CF.withAuthHeaders();
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.state.papers = [];
    return;
  }
  try {
    CF.state.papers = await CF.api("/papers/me", { headers });
  } catch (_err) {
    CF.state.papers = [];
  }
};

CF.loadAllPapers = async function() {
  const headers = await CF.withAuthHeaders();
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.state.papers = [];
    return;
  }
  try {
    CF.state.papers = await CF.api("/papers", { headers });
  } catch (_err) {
    CF.state.papers = [];
  }
};

CF.loadAssignedReviews = async function() {
  const headers = await CF.withAuthHeaders();
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.state.assignedReviews = [];
    return;
  }
  try {
    CF.state.assignedReviews = await CF.api("/reviews/assigned/me", { headers });
  } catch (_err) {
    CF.state.assignedReviews = [];
  }
};

CF.loadDecisionContext = async function(paperId) {
  const headers = await CF.withAuthHeaders();
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.state.decisionContext = null;
    return;
  }
  try {
    CF.state.decisionContext = await CF.api(`/papers/${paperId}/decision-context`, { headers });
    const timelineResp = await CF.api(`/papers/${paperId}/timeline`, { headers });
    CF.state.timeline = timelineResp.activities || [];
  } catch (_err) {
    CF.state.decisionContext = null;
    CF.state.timeline = [];
  }
};

CF.loadNotifications = async function() {
  const headers = await CF.withAuthHeaders();
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.state.notifications = [];
    return;
  }
  try {
    CF.state.notifications = await CF.api("/notifications/me", { headers });
  } catch (_err) {
    CF.state.notifications = [];
  }
};

CF.loadAnalytics = async function() {
  const headers = await CF.withAuthHeaders();
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.state.analytics = null;
    return;
  }
  const conferenceId = CF.state.conferences[0]?._id;
  if (!conferenceId) {
    CF.state.analytics = null;
    return;
  }
  try {
    CF.state.analytics = await CF.api(`/conferences/${conferenceId}/analytics`, { headers });
  } catch (_err) {
    CF.state.analytics = null;
  }
};

CF.renderTab = function() {
  const content = document.getElementById("dashContent");
  if (!content) return;
  if (CF.state.dashTab === "submit") {
    content.innerHTML = `
      <div class="dash-header"><h1 class="dash-title">Submit Paper</h1></div>
      <div class="card">
        <form onsubmit="CF.handlePaperSubmit(event)" style="display:flex;flex-direction:column;gap:14px">
          <input class="form-input" id="paperTitle" placeholder="Paper title" required />
          <select class="form-input" id="paperConf" required>
            <option value="">Select conference</option>
            ${CF.state.conferences.map((c) => `<option value="${c._id}">${c.abbr || c.title}</option>`).join("")}
          </select>
          <input class="form-input" id="paperTrack" placeholder="Track" />
          <input class="form-input" id="paperPdfUrl" placeholder="PDF URL (optional)" />
          <button class="btn btn--primary" type="submit">Submit</button>
        </form>
      </div>
    `;
    return;
  }
  if (CF.state.dashTab === "create-conf") {
    content.innerHTML = `
      <div class="dash-header"><h1 class="dash-title">Create Conference</h1></div>
      <div class="card">
        <form onsubmit="CF.handleConferenceCreate(event)" style="display:flex;flex-direction:column;gap:14px">
          <input class="form-input" id="confTitle" placeholder="Conference title" required />
          <input class="form-input" id="confAbbr" placeholder="Abbreviation (e.g. ICML 2027)" />
          <input class="form-input" id="confOrg" placeholder="Organization" />
          <input class="form-input" id="confDomain" placeholder="Domain (AI, Security, HCI...)" />
          <input class="form-input" id="confLocation" placeholder="Location" />
          <input class="form-input" id="confDate" type="date" />
          <input class="form-input" id="confTracks" placeholder="Tracks (comma separated)" />
          <button class="btn btn--primary" type="submit">Create Conference</button>
        </form>
      </div>
    `;
    return;
  }
  if (CF.state.dashTab === "assign-reviewers") {
    content.innerHTML = `
      <div class="dash-header"><h1 class="dash-title">Assign Reviewers</h1></div>
      <div class="card">
        <form onsubmit="CF.handleAssignReviewer(event)" style="display:flex;flex-direction:column;gap:14px">
          <select class="form-input" id="assignPaperId" required>
            <option value="">Select paper</option>
            ${CF.state.papers.map((p) => `<option value="${p._id}">${p.title || p._id}</option>`).join("")}
          </select>
          <input class="form-input" id="assignReviewerId" placeholder="Reviewer user id" required />
          <input class="form-input" id="assignDueDate" type="date" />
          <button class="btn btn--primary" type="submit">Assign Reviewer</button>
        </form>
      </div>
    `;
    return;
  }
  if (CF.state.dashTab === "assigned-reviews") {
    content.innerHTML = `
      <div class="dash-header"><h1 class="dash-title">Assigned Reviews</h1></div>
      <div class="card">
        ${
          CF.state.assignedReviews.length
            ? CF.state.assignedReviews
                .map(
                  (r) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-weight:600">${r.paper?.title || r.paperId}</div>
                  <div style="font-size:12px;color:var(--t2)">Due: ${r.dueDate || "N/A"} · Status: ${r.status}</div>
                </div>
                <button class="btn btn--sm btn--primary" onclick="CF.openReviewForm('${r._id}')">${r.status === "submitted" ? "Update Review" : "Submit Review"}</button>
              </div>
            `
                )
                .join("")
            : "<p>No assigned reviews yet.</p>"
        }
      </div>
    `;
    return;
  }
  if (CF.state.dashTab === "decisions") {
    content.innerHTML = `
      <div class="dash-header"><h1 class="dash-title">Decision Console</h1></div>
      <div class="card">
        ${
          CF.state.papers.length
            ? CF.state.papers
                .map(
                  (p) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-weight:600">${p.title || "-"}</div>
                  <div style="font-size:12px;color:var(--t2)">Status: ${p.status || "submitted"} · Track: ${p.track || "General"}</div>
                </div>
                <button class="btn btn--sm btn--primary" onclick="CF.openDecisionDetail('${p._id}')">Review & Decide</button>
              </div>
            `
                )
                .join("")
            : "<p>No papers available yet.</p>"
        }
      </div>
    `;
    return;
  }
  if (CF.state.dashTab === "decision-detail") {
    const ctx = CF.state.decisionContext;
    if (!ctx?.paper) {
      content.innerHTML = `<div class="card"><p>Decision context unavailable.</p></div>`;
      return;
    }
    const avg = ctx.averages || {};
    content.innerHTML = `
      <div class="dash-header">
        <h1 class="dash-title">Decision Detail</h1>
        <button class="btn btn--ghost btn--sm" onclick="CF.switchTab('decisions')">← Back</button>
      </div>
      <div class="card">
        <h3 style="margin-bottom:8px">${ctx.paper.title}</h3>
        <p style="font-size:13px;color:var(--t2);margin-bottom:14px">Track: ${ctx.paper.track || "General"} · Current status: ${ctx.paper.status}</p>
        <div style="display:flex;gap:14px;margin-bottom:14px;flex-wrap:wrap">
          <span class="chip">Avg Originality: ${avg.originality ?? "N/A"}</span>
          <span class="chip">Avg Quality: ${avg.quality ?? "N/A"}</span>
          <span class="chip">Avg Relevance: ${avg.relevance ?? "N/A"}</span>
        </div>
        <div style="margin-bottom:14px">
          <h4 style="margin-bottom:8px">Submitted Reviews (${ctx.reviews?.length || 0})</h4>
          ${
            ctx.reviews?.length
              ? ctx.reviews
                  .map(
                    (r) => `
                <div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
                  <div style="font-size:12px;color:var(--t2);margin-bottom:6px">Reviewer: ${r.reviewerId}</div>
                  <div style="font-size:12px;color:var(--t2)">Scores — O:${r.scores?.originality ?? "-"} Q:${r.scores?.quality ?? "-"} R:${r.scores?.relevance ?? "-"}</div>
                  <div style="font-size:12px;color:var(--t2)">Recommendation: ${r.recommendation || "-"}</div>
                  <div style="font-size:13px;margin-top:6px">${r.comments || ""}</div>
                </div>
              `
                  )
                  .join("")
              : "<p style='font-size:13px;color:var(--t2)'>No submitted reviews yet.</p>"
          }
        </div>
        <div style="margin-bottom:14px">
          <h4 style="margin-bottom:8px">Timeline / Audit Trail</h4>
          ${
            CF.state.timeline.length
              ? CF.state.timeline
                  .map(
                    (t) => `
                <div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
                  <div style="font-size:12px;color:var(--t2)">${new Date(t.createdAt).toLocaleString()} · ${t.actorRole}</div>
                  <div style="font-weight:600;font-size:13px">${t.summary}</div>
                  <div style="font-size:12px;color:var(--t2)">${t.eventType}</div>
                </div>
              `
                  )
                  .join("")
              : "<p style='font-size:13px;color:var(--t2)'>No timeline events yet.</p>"
          }
        </div>
        <form onsubmit="CF.handleDecisionSubmit(event)" style="display:flex;flex-direction:column;gap:10px">
          <input type="hidden" id="decisionPaperId" value="${ctx.paper._id}" />
          <select class="form-input" id="decisionStatus" required>
            <option value="">Select decision</option>
            <option value="accepted">Accept</option>
            <option value="rejected">Reject</option>
          </select>
          <textarea class="form-input" id="decisionNote" rows="3" placeholder="Decision note (optional)"></textarea>
          <button class="btn btn--primary" type="submit">Submit Decision</button>
        </form>
      </div>
    `;
    return;
  }
  if (CF.state.dashTab === "notifications") {
    content.innerHTML = `
      <div class="dash-header"><h1 class="dash-title">Notifications</h1></div>
      <div class="card">
        ${
          CF.state.notifications.length
            ? CF.state.notifications
                .map(
                  (n) => `
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-weight:600">${n.title}</div>
                  <div style="font-size:12px;color:var(--t2);margin:4px 0">${n.message}</div>
                  <div style="font-size:11px;color:var(--t3)">${n.read ? "Read" : "Unread"}</div>
                </div>
                ${n.read ? "" : `<button class="btn btn--sm btn--ghost" onclick="CF.markNotificationRead('${n._id}')">Mark read</button>`}
              </div>
            `
                )
                .join("")
            : "<p>No notifications yet.</p>"
        }
      </div>
    `;
    return;
  }
  if (CF.state.dashTab === "analytics") {
    const a = CF.state.analytics;
    content.innerHTML = `
      <div class="dash-header"><h1 class="dash-title">Conference Analytics</h1></div>
      <div class="card">
        ${
          a
            ? `
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-card__num">${a.totalPapers}</div><div class="stat-card__label">Total Papers</div></div>
            <div class="stat-card"><div class="stat-card__num">${a.submittedReviews}</div><div class="stat-card__label">Submitted Reviews</div></div>
            <div class="stat-card"><div class="stat-card__num">${a.acceptanceRate}%</div><div class="stat-card__label">Acceptance Rate</div></div>
            <div class="stat-card"><div class="stat-card__num">${a.avgReviewScore ?? "N/A"}</div><div class="stat-card__label">Avg Review Score</div></div>
          </div>
          <p style="font-size:13px;color:var(--t2)">Status Counts — Submitted: ${a.statusCounts.submitted}, Review: ${a.statusCounts.review}, Accepted: ${a.statusCounts.accepted}, Rejected: ${a.statusCounts.rejected}, Camera: ${a.statusCounts.camera}</p>
        `
            : "<p>No analytics available.</p>"
        }
      </div>
    `;
    return;
  }
  if (CF.state.dashTab === "review-form") {
    const selected = CF.state.assignedReviews.find((r) => r._id === CF.state.activeReviewId);
    if (!selected) {
      content.innerHTML = `<div class="card"><p>Review assignment not found.</p></div>`;
      return;
    }
    content.innerHTML = `
      <div class="dash-header"><h1 class="dash-title">Submit Review</h1></div>
      <div class="card">
        <p style="margin-bottom:12px"><strong>Paper:</strong> ${selected.paper?.title || selected.paperId}</p>
        <form onsubmit="CF.handleReviewSubmit(event)" style="display:flex;flex-direction:column;gap:14px">
          <input type="hidden" id="reviewId" value="${selected._id}" />
          <input class="form-input" id="scoreOriginality" type="number" min="1" max="10" placeholder="Originality (1-10)" required />
          <input class="form-input" id="scoreQuality" type="number" min="1" max="10" placeholder="Quality (1-10)" required />
          <input class="form-input" id="scoreRelevance" type="number" min="1" max="10" placeholder="Relevance (1-10)" required />
          <select class="form-input" id="reviewRecommendation" required>
            <option value="">Recommendation</option>
            <option value="accept">Accept</option>
            <option value="weak-accept">Weak Accept</option>
            <option value="weak-reject">Weak Reject</option>
            <option value="reject">Reject</option>
          </select>
          <textarea class="form-input" id="reviewComments" rows="4" placeholder="Reviewer comments"></textarea>
          <button class="btn btn--primary" type="submit">Submit Review</button>
        </form>
      </div>
    `;
    return;
  }
  if (CF.state.dashTab === "papers") {
    content.innerHTML = `
      <div class="dash-header"><h1 class="dash-title">My Papers</h1></div>
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Title</th><th>Conference</th><th>Track</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              ${
                CF.state.papers.length
                  ? CF.state.papers
                      .map(
                        (p) => `
                      <tr>
                        <td>${p.title || "-"}</td>
                        <td>${p.confId || "-"}</td>
                        <td>${p.track || "-"}</td>
                        <td><span class="status-badge status--${p.status || "submitted"}">${p.status || "submitted"}</span></td>
                        <td>${p.status === "accepted" ? `<button class="btn btn--xs btn--primary" onclick="CF.submitCameraReady('${p._id}')">Camera Ready</button>` : "-"}</td>
                      </tr>`
                      )
                      .join("")
                  : "<tr><td colspan='5'>No submissions yet.</td></tr>"
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
    return;
  }
  content.innerHTML = `
    <div class="dash-header"><h1 class="dash-title">Overview</h1></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-card__num">${CF.state.papers.length}</div><div class="stat-card__label">My submissions</div></div>
      <div class="stat-card"><div class="stat-card__num">${CF.state.conferences.length}</div><div class="stat-card__label">Conferences</div></div>
      <div class="stat-card"><div class="stat-card__num">${CF.state.papers.filter((p) => p.status === "accepted").length}</div><div class="stat-card__label">Accepted</div></div>
      <div class="stat-card"><div class="stat-card__num">${CF.state.papers.filter((p) => p.status === "submitted").length}</div><div class="stat-card__label">In review</div></div>
    </div>
  `;
};

CF.handlePaperSubmit = async function(e) {
  e.preventDefault();
  const headers = await CF.withAuthHeaders({ "Content-Type": "application/json" });
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.toast("You need to sign in first", "error");
    return;
  }
  const payload = {
    title: document.getElementById("paperTitle")?.value?.trim(),
    confId: document.getElementById("paperConf")?.value,
    track: document.getElementById("paperTrack")?.value?.trim() || "General",
    pdfUrl: document.getElementById("paperPdfUrl")?.value?.trim() || ""
  };
  try {
    await CF.api("/papers", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    CF.toast("Paper submitted", "success");
    CF.state.dashTab = "papers";
    await CF.renderDashboard();
  } catch (err) {
    CF.toast(err.message || "Submission failed", "error");
  }
};

CF.handleAssignReviewer = async function(e) {
  e.preventDefault();
  if (CF.state.role !== "chair") {
    CF.toast("Only chair users can assign reviewers", "error");
    return;
  }
  const headers = await CF.withAuthHeaders({ "Content-Type": "application/json" });
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.toast("You need to sign in first", "error");
    return;
  }
  const payload = {
    paperId: document.getElementById("assignPaperId")?.value,
    reviewerId: document.getElementById("assignReviewerId")?.value?.trim(),
    dueDate: document.getElementById("assignDueDate")?.value || ""
  };
  try {
    await CF.api("/reviews/assign", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    CF.toast("Reviewer assigned", "success");
  } catch (err) {
    CF.toast(err.message || "Failed to assign reviewer", "error");
  }
};

CF.openReviewForm = function(reviewId) {
  CF.state.activeReviewId = reviewId;
  CF.state.dashTab = "review-form";
  CF.renderDashboard();
};

CF.handleReviewSubmit = async function(e) {
  e.preventDefault();
  const headers = await CF.withAuthHeaders({ "Content-Type": "application/json" });
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.toast("You need to sign in first", "error");
    return;
  }
  const reviewId = document.getElementById("reviewId")?.value;
  const payload = {
    scores: {
      originality: Number(document.getElementById("scoreOriginality")?.value),
      quality: Number(document.getElementById("scoreQuality")?.value),
      relevance: Number(document.getElementById("scoreRelevance")?.value)
    },
    recommendation: document.getElementById("reviewRecommendation")?.value,
    comments: document.getElementById("reviewComments")?.value?.trim() || ""
  };
  try {
    await CF.api(`/reviews/${reviewId}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    CF.toast("Review submitted", "success");
    CF.state.dashTab = "assigned-reviews";
    await CF.renderDashboard();
  } catch (err) {
    CF.toast(err.message || "Failed to submit review", "error");
  }
};

CF.handleConferenceCreate = async function(e) {
  e.preventDefault();
  if (CF.state.role !== "chair") {
    CF.toast("Only chair users can create conferences", "error");
    return;
  }
  const headers = await CF.withAuthHeaders({ "Content-Type": "application/json" });
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.toast("You need to sign in first", "error");
    return;
  }
  const tracksRaw = document.getElementById("confTracks")?.value?.trim() || "";
  const payload = {
    title: document.getElementById("confTitle")?.value?.trim(),
    abbr: document.getElementById("confAbbr")?.value?.trim() || "",
    org: document.getElementById("confOrg")?.value?.trim() || "",
    domain: document.getElementById("confDomain")?.value?.trim() || "General",
    location: document.getElementById("confLocation")?.value?.trim() || "",
    date: document.getElementById("confDate")?.value || "",
    tracks: tracksRaw ? tracksRaw.split(",").map((t) => t.trim()).filter(Boolean) : []
  };
  try {
    await CF.api("/conferences", {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    await CF.loadConferences();
    CF.toast("Conference created", "success");
    CF.state.dashTab = "overview";
    CF.renderDashboard();
  } catch (err) {
    CF.toast(err.message || "Failed to create conference", "error");
  }
};

CF.openDecisionDetail = async function(paperId) {
  CF.state.activeDecisionPaperId = paperId;
  CF.state.dashTab = "decision-detail";
  await CF.renderDashboard();
};

CF.handleDecisionSubmit = async function(e) {
  e.preventDefault();
  if (CF.state.role !== "chair") {
    CF.toast("Only chair users can submit decisions", "error");
    return;
  }
  const headers = await CF.withAuthHeaders({ "Content-Type": "application/json" });
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.toast("You need to sign in first", "error");
    return;
  }
  const paperId = document.getElementById("decisionPaperId")?.value;
  const payload = {
    status: document.getElementById("decisionStatus")?.value,
    decisionNote: document.getElementById("decisionNote")?.value?.trim() || ""
  };
  try {
    await CF.api(`/papers/${paperId}/decision`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    CF.toast("Decision submitted", "success");
    CF.state.dashTab = "decisions";
    await CF.renderDashboard();
  } catch (err) {
    CF.toast(err.message || "Failed to submit decision", "error");
  }
};

CF.submitCameraReady = async function(paperId) {
  const headers = await CF.withAuthHeaders({ "Content-Type": "application/json" });
  if (!headers.Authorization && !headers["x-demo-user"]) {
    CF.toast("You need to sign in first", "error");
    return;
  }
  try {
    await CF.api(`/papers/${paperId}/camera-ready`, {
      method: "POST",
      headers,
      body: JSON.stringify({ pdfUrl: "" })
    });
    CF.toast("Camera-ready submitted", "success");
    await CF.renderDashboard();
  } catch (err) {
    CF.toast(err.message || "Failed camera-ready submission", "error");
  }
};

CF.markNotificationRead = async function(id) {
  const headers = await CF.withAuthHeaders();
  if (!headers.Authorization && !headers["x-demo-user"]) return;
  try {
    await CF.api(`/notifications/${id}/read`, { method: "PATCH", headers });
    await CF.loadNotifications();
    CF.renderTab();
  } catch (_err) {}
};

CF.toggleMobileMenu = function() {
  document.getElementById("mobileMenu")?.classList.toggle("open");
};

document.addEventListener("DOMContentLoaded", () => {
  CF.restoreUser();
  CF.navigate("home");
  CF.loadConferences();
  window.addEventListener("firebase-ready", async (evt) => {
    if (!evt.detail?.ok || !window.FirebaseServices) return;
    window.FirebaseServices.AuthService.onAuthChange(async (fbUser) => {
      if (!fbUser) return;
      const profile = await window.FirebaseServices.UserService.getProfile(fbUser.uid).catch(() => null);
      CF.state.user = { uid: fbUser.uid, name: fbUser.displayName || "User", role: profile?.role || "author" };
      CF.state.role = CF.state.user.role;
    });
  });
});
