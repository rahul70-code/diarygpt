// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  token: localStorage.getItem("dg_token"),
  user:  JSON.parse(localStorage.getItem("dg_user") || "null"),
  // chat state survives route changes
  chatSession:  null,   // { id, title }
  chatMessages: [],
  chatStreaming: false,
};

// ─── Voice ────────────────────────────────────────────────────────────────────
const voice = {
  ttsEnabled:  true,
  recognition: null,
  supported:   !!(window.SpeechRecognition || window.webkitSpeechRecognition),
};

/** Speak text aloud using the browser SpeechSynthesis API (free, no backend). */
function speak(text) {
  if (!voice.ttsEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate  = 0.92;
  utter.pitch = 1.0;
  window.speechSynthesis.speak(utter);
}

/**
 * Start speech recognition.
 * onInterim(text) — called continuously while user is speaking
 * onFinal(text)   — called when a final result is committed
 * onEnd()         — called when recognition stops (silence or manual stop)
 */
function startDictation(onInterim, onFinal, onEnd) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert("Voice recognition isn't supported in this browser. Try Chrome or Edge.");
    return null;
  }
  const r = new SR();
  r.continuous      = false;
  r.interimResults  = true;
  r.lang            = "en-US";

  r.onresult = (e) => {
    const results  = Array.from(e.results);
    const interim  = results.filter((r) => !r.isFinal).map((r) => r[0].transcript).join("");
    const final    = results.filter((r) =>  r.isFinal).map((r) => r[0].transcript).join("");
    if (interim) onInterim?.(interim);
    if (final)   onFinal?.(final);
  };

  r.onerror = (e) => { console.warn("[voice]", e.error); onEnd?.(); };
  r.onend   = () => onEnd?.();
  r.start();
  voice.recognition = r;
  return r;
}

function stopDictation() {
  voice.recognition?.stop();
  voice.recognition = null;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

const today = () => new Date().toISOString().slice(0, 10);

const preview = (text, n = 130) => {
  if (!text) return "";
  const flat = text.replace(/\n+/g, " ");
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
};

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(path, { method = "GET", body } = {}) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 401) { doLogout(); return null; }
  return res.json();
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function saveAuth(token, user) {
  state.token = token;
  state.user  = user;
  localStorage.setItem("dg_token", token);
  localStorage.setItem("dg_user", JSON.stringify(user));
}

window.doLogout = function () {
  state.token = null;
  state.user  = null;
  state.chatSession  = null;
  state.chatMessages = [];
  localStorage.removeItem("dg_token");
  localStorage.removeItem("dg_user");
  nav("/login");
};

// ─── Router ───────────────────────────────────────────────────────────────────
const nav = (path) => { window.location.hash = path; };
const route = () => window.location.hash.slice(1) || "/diary";

async function dispatch() {
  const r    = route();
  const $app = document.getElementById("app");

  if (!state.token) {
    if (r !== "/login" && r !== "/register") { nav("/login"); return; }
  } else if (r === "/login" || r === "/register") {
    nav("/diary"); return;
  }

  if (r === "/login")    { renderAuth($app, "login");    return; }
  if (r === "/register") { renderAuth($app, "register"); return; }

  ensureShell($app);
  updateNav(r);
  refreshPrivacyBadge();

  const $main = document.getElementById("main");
  if (r === "/diary" || r === "/")     return renderDiaryList($main);
  if (r === "/diary/new")              return renderEntryForm($main, null);
  if (r.startsWith("/diary/"))         return renderEntryForm($main, r.slice(7));
  if (r === "/chat")                   return renderChat($main);
  if (r === "/therapy")                return renderTherapy($main);
  if (r === "/search")                 return renderSearch($main);
  if (r === "/insights")               return renderInsights($main);
  if (r === "/settings")               return renderSettings($main);
}

window.addEventListener("hashchange", dispatch);
document.addEventListener("DOMContentLoaded", dispatch);

// ─── Shell ────────────────────────────────────────────────────────────────────
function ensureShell($app) {
  if (document.getElementById("sidebar")) return;
  $app.innerHTML = `
    <div class="layout">
      <aside id="sidebar">
        <div class="logo">Dairy<span>GPT</span></div>
        <nav id="sidebar-nav">
          <a href="#/diary"    class="nav-link" data-r="/diary">📓 Diary</a>
          <a href="#/insights" class="nav-link" data-r="/insights">✨ Insights</a>
          <a href="#/chat"     class="nav-link" data-r="/chat">💬 Chat</a>
          <a href="#/therapy"  class="nav-link" data-r="/therapy">🧘 Therapy</a>
          <a href="#/search"   class="nav-link" data-r="/search">🔍 Search</a>
          <a href="#/settings" class="nav-link" data-r="/settings">⚙️ Settings</a>
        </nav>
        <div class="sidebar-footer">
          <div id="privacy-badge" class="privacy-badge"></div>
          <div class="user-email">${esc(state.user?.email)}</div>
          <button class="logout-btn" onclick="doLogout()">Sign out</button>
        </div>
      </aside>
      <main id="main"></main>
    </div>`;
}

function updateNav(r) {
  document.querySelectorAll("#sidebar-nav .nav-link").forEach((a) => {
    a.classList.toggle("active", r.startsWith(a.dataset.r));
  });
}

// ─── Auth views ───────────────────────────────────────────────────────────────
function renderAuth($app, mode) {
  const isLogin = mode === "login";
  $app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo">Dairy<span>GPT</span></div>
        <p class="auth-tagline">${isLogin ? "Welcome back to your journal" : "Start your AI-powered journal"}</p>
        <div id="auth-err" class="alert alert-error" hidden></div>
        <div class="form-group">
          <label class="label">Email</label>
          <input id="auth-email" class="input" type="email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label class="label">Password</label>
          <input id="auth-password" class="input" type="password" placeholder="••••••••"
            autocomplete="${isLogin ? "current" : "new"}-password">
        </div>
        <button class="btn btn-primary btn-full" id="auth-submit">
          ${isLogin ? "Sign in" : "Create account"}
        </button>
        <p class="auth-switch">
          ${isLogin
            ? 'New to DairyGPT? <a href="#/register">Create account</a>'
            : 'Already have an account? <a href="#/login">Sign in</a>'}
        </p>
      </div>
    </div>`;

  const submit = async () => {
    const email    = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const $err     = document.getElementById("auth-err");
    $err.hidden    = true;

    if (!email || !password) { showErr($err, "Email and password are required"); return; }

    const $btn = document.getElementById("auth-submit");
    $btn.disabled    = true;
    $btn.textContent = isLogin ? "Signing in…" : "Creating account…";

    const res = await api(isLogin ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      body: { email, password },
    });

    $btn.disabled    = false;
    $btn.textContent = isLogin ? "Sign in" : "Create account";

    if (!res || res.error) { showErr($err, res?.error || "Something went wrong"); return; }
    saveAuth(res.token, res.user);
    nav("/diary");
  };

  document.getElementById("auth-submit").addEventListener("click", submit);
  ["auth-email", "auth-password"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  });
}

// ─── Diary list ───────────────────────────────────────────────────────────────
async function renderDiaryList($main) {
  $main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">My Journal</h1>
        <p class="page-sub" id="entry-count">Loading…</p>
      </div>
      <a href="#/diary/new" class="btn btn-primary">+ New entry</a>
    </div>
    <div id="entries-list" class="entries-list">
      <div class="loader">Loading entries…</div>
    </div>`;

  const entries = await api("/api/diary");
  if (!entries) return;

  const $list  = document.getElementById("entries-list");
  const $count = document.getElementById("entry-count");
  $count.textContent =
    entries.length === 0 ? "No entries yet" :
    entries.length === 1 ? "1 entry" : `${entries.length} entries`;

  if (entries.length === 0) {
    $list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <h3>Your journal is empty</h3>
        <p>Write your first entry and let AI help you reflect.</p>
        <a href="#/diary/new" class="btn btn-primary" style="margin-top:4px">Write first entry</a>
      </div>`;
    return;
  }

  $list.innerHTML = entries
    .map(
      (e) => `
      <a href="#/diary/${e.id}" class="entry-card">
        <div class="entry-card-row">
          <span class="entry-card-title">${esc(e.title || "Untitled")}</span>
          <span class="entry-card-date">${fmtDate(e.writtenAt)}</span>
        </div>
        <p class="entry-card-preview">${esc(preview(e.body))}</p>
      </a>`
    )
    .join("");
}

// ─── Entry form (new & edit) ──────────────────────────────────────────────────
async function renderEntryForm($main, id) {
  const isNew = id === null;
  let entry   = null;

  if (!isNew) {
    $main.innerHTML = '<div class="loader">Loading…</div>';
    entry = await api(`/api/diary/${id}`);
    if (!entry || entry.error) {
      $main.innerHTML = '<div class="loader">Entry not found.</div>';
      return;
    }
  }

  $main.innerHTML = `
    <div class="page-header">
      <a href="#/diary" class="btn btn-ghost btn-sm">← Back</a>
      <div class="entry-header-actions">
        ${!isNew ? '<button class="btn btn-danger btn-sm" id="delete-btn">Delete</button>' : ""}
        <button class="btn btn-primary btn-sm" id="save-btn">
          ${isNew ? "Save entry" : "Save changes"}
        </button>
      </div>
    </div>
    <div id="entry-err" class="alert alert-error" style="margin:0 32px" hidden></div>
    <div id="entry-ok"  class="alert alert-success" style="margin:0 32px" hidden></div>
    <div class="entry-form">
      <input
        id="entry-title"
        class="entry-title-input"
        type="text"
        placeholder="Entry title…"
        value="${esc(entry?.title || "")}">
      <div class="entry-meta">
        <input
          id="entry-date"
          class="entry-date-input"
          type="date"
          value="${entry ? entry.writtenAt.slice(0, 10) : today()}">
      </div>
      ${isNew ? `
      <div id="prompt-area" style="margin-bottom:14px">
        <button class="btn btn-ghost btn-sm" id="prompt-btn">✨ Suggest a prompt</button>
        <div id="prompt-box" class="prompt-box" hidden></div>
        <div class="prompt-actions" id="prompt-actions" hidden>
          <button class="btn btn-ghost btn-sm" id="use-prompt-btn">Use this prompt</button>
          <button class="btn btn-ghost btn-sm" id="new-prompt-btn">Try another</button>
        </div>
      </div>` : ""}
      <textarea
        id="entry-body"
        class="entry-body"
        placeholder="What's on your mind today…"
      >${esc(entry?.body || "")}</textarea>
      <div class="voice-entry-bar">
        <button class="btn btn-ghost btn-sm" id="dictate-btn">🎤 Dictate</button>
        <span id="dictate-preview" class="dictate-preview" hidden></span>
      </div>
      ${!isNew && entry?.analysis ? `
      <div class="analysis-card">
        <div class="analysis-mood">
          <span class="analysis-label">Mood</span>
          <span class="analysis-mood-value">${esc(entry.analysis.mood)}</span>
          ${entry.analysis.themes?.length ? `<span class="analysis-themes">${entry.analysis.themes.map(t => `<span class="theme-tag">${esc(t)}</span>`).join("")}</span>` : ""}
        </div>
        ${entry.analysis.followUpQuestion ? `
        <div class="analysis-followup">
          <span class="analysis-label">Reflect on this</span>
          <p class="analysis-question">${esc(entry.analysis.followUpQuestion)}</p>
        </div>` : ""}
      </div>` : ""}
      ${!isNew ? `
      <div class="entry-chat" id="entry-chat">
        <button class="btn btn-ghost btn-sm entry-chat-toggle" id="entry-chat-toggle">💬 Chat about this entry</button>
        <div class="entry-chat-body" id="entry-chat-body" hidden>
          <div class="entry-chat-messages" id="entry-chat-messages"></div>
          <div class="entry-chat-input-row">
            <textarea id="entry-chat-input" class="entry-chat-input" rows="1" placeholder="Ask something about this entry…"></textarea>
            <button class="btn btn-primary btn-sm" id="entry-chat-send">Send</button>
          </div>
        </div>
      </div>` : ""}
    </div>`;

  // Auto-grow textarea
  const $ta = document.getElementById("entry-body");
  const grow = () => {
    $ta.style.height = "auto";
    $ta.style.height = Math.max(400, $ta.scrollHeight) + "px";
  };
  grow();
  $ta.addEventListener("input", grow);

  // Dictation button
  let dictating = false;
  const $dictBtn     = document.getElementById("dictate-btn");
  const $dictPreview = document.getElementById("dictate-preview");

  $dictBtn.addEventListener("click", () => {
    if (dictating) {
      stopDictation();
      dictating = false;
      $dictBtn.textContent = "🎤 Dictate";
      $dictBtn.classList.remove("recording");
      $dictPreview.hidden = true;
      return;
    }
    if (!voice.supported) {
      alert("Voice recognition isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    dictating = true;
    $dictBtn.textContent = "⏹ Stop";
    $dictBtn.classList.add("recording");
    $dictPreview.hidden  = false;
    $dictPreview.textContent = "Listening…";

    startDictation(
      (interim) => { $dictPreview.textContent = interim; },
      (final) => {
        const $body = document.getElementById("entry-body");
        if ($body) { $body.value += ($body.value ? " " : "") + final; grow(); }
        $dictPreview.textContent = "";
      },
      () => {
        dictating = false;
        $dictBtn.textContent = "🎤 Dictate";
        $dictBtn.classList.remove("recording");
        $dictPreview.hidden  = true;
      }
    );
  });

  // Prompt suggestion (new entries only)
  if (isNew) {
    let lastPrompt = "";
    const fetchPrompt = async () => {
      const $btn  = document.getElementById("prompt-btn");
      const $box  = document.getElementById("prompt-box");
      const $acts = document.getElementById("prompt-actions");
      $btn.disabled    = true;
      $btn.textContent = "✨ Thinking…";
      const res = await api("/api/insights/prompt");
      $btn.disabled    = false;
      $btn.textContent = "✨ Suggest another";
      if (!res || res.error) return;
      lastPrompt       = res.prompt;
      $box.textContent = res.prompt;
      $box.hidden      = false;
      $acts.hidden     = false;
    };

    document.getElementById("prompt-btn").addEventListener("click", fetchPrompt);

    document.getElementById("use-prompt-btn").addEventListener("click", () => {
      const $ta = document.getElementById("entry-body");
      $ta.value = lastPrompt + "\n\n";
      grow();
      $ta.focus();
      $ta.setSelectionRange($ta.value.length, $ta.value.length);
      document.getElementById("prompt-area").hidden = true;
    });

    document.getElementById("new-prompt-btn").addEventListener("click", fetchPrompt);
  }

  document.getElementById("save-btn").addEventListener("click", async () => {
    const title     = document.getElementById("entry-title").value.trim();
    const body      = document.getElementById("entry-body").value.trim();
    const writtenAt = document.getElementById("entry-date").value;
    const $err      = document.getElementById("entry-err");
    const $ok       = document.getElementById("entry-ok");
    $err.hidden = $ok.hidden = true;

    if (!body) { showErr($err, "Body is required"); return; }

    const $btn = document.getElementById("save-btn");
    $btn.disabled    = true;
    $btn.textContent = "Saving…";

    const res = isNew
      ? await api("/api/diary",         { method: "POST",  body: { title, body, writtenAt } })
      : await api(`/api/diary/${id}`,   { method: "PATCH", body: { title, body, writtenAt } });

    $btn.disabled    = false;
    $btn.textContent = isNew ? "Save entry" : "Save changes";

    if (!res || res.error) { showErr($err, res?.error || "Save failed"); return; }

    if (isNew) {
      nav(`/diary/${res.id}`);
    } else {
      $ok.textContent = "Saved!";
      $ok.hidden = false;
      setTimeout(() => { if ($ok) $ok.hidden = true; }, 2500);
    }
  });

  if (!isNew) {
    document.getElementById("delete-btn").addEventListener("click", async () => {
      if (!confirm("Delete this entry? This cannot be undone.")) return;
      const res = await api(`/api/diary/${id}`, { method: "DELETE" });
      if (res?.success) nav("/diary");
    });

    // ── Entry chat ──────────────────────────────────────────────────────────
    let entryChatSessionId = null;

    document.getElementById("entry-chat-toggle").addEventListener("click", () => {
      const $body = document.getElementById("entry-chat-body");
      $body.hidden = !$body.hidden;
      if (!$body.hidden) document.getElementById("entry-chat-input").focus();
    });

    const sendEntryMessage = async () => {
      const $input = document.getElementById("entry-chat-input");
      const message = $input.value.trim();
      if (!message) return;
      $input.value = "";
      $input.style.height = "auto";

      const $msgs = document.getElementById("entry-chat-messages");
      $msgs.insertAdjacentHTML("beforeend",
        `<div class="echat-msg echat-user">${esc(message)}</div>`);
      const $ai = document.createElement("div");
      $ai.className = "echat-msg echat-ai";
      $ai.textContent = "…";
      $msgs.appendChild($ai);
      $msgs.scrollTop = $msgs.scrollHeight;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
        body: JSON.stringify({ message, entryId: id, sessionId: entryChatSessionId }),
      });

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", fullText = "";
      $ai.textContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.delta) { fullText += evt.delta; $ai.textContent = fullText; }
          if (evt.sessionId) entryChatSessionId = evt.sessionId;
        }
      }
      $msgs.scrollTop = $msgs.scrollHeight;
    };

    document.getElementById("entry-chat-send").addEventListener("click", sendEntryMessage);
    document.getElementById("entry-chat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendEntryMessage(); }
    });
  }
}

// ─── Chat view ────────────────────────────────────────────────────────────────
async function renderChat($main) {
  const sessions = (await api("/api/chat/sessions")) || [];

  $main.innerHTML = `
    <div class="chat-layout">
      <div class="chat-sidebar">
        <div class="chat-sidebar-header">
          <span>Conversations</span>
          <button class="btn btn-ghost btn-sm" id="new-chat-btn">+ New</button>
        </div>
        <div id="session-list" class="session-list">
          ${sessions.length === 0
            ? '<p class="session-empty">No conversations yet</p>'
            : sessions.map(sessionHtml).join("")}
        </div>
      </div>
      <div class="chat-main">
        <div class="chat-header-bar">
          <span id="chat-header">${state.chatSession?.title ?? "Select or start a conversation"}</span>
          <button class="tts-toggle${voice.ttsEnabled ? " on" : ""}" id="tts-toggle"
            title="Toggle voice response">${voice.ttsEnabled ? "🔊 Voice on" : "🔇 Voice off"}</button>
        </div>
        <div class="messages-area" id="messages-area">
          ${renderWelcome()}
        </div>
        <div class="chat-input-area">
          <textarea id="chat-input" class="chat-input" rows="1"
            placeholder="Ask about your journal…"></textarea>
          <button class="btn-mic" id="mic-btn" title="${voice.supported ? "Voice input" : "Voice not supported (use Chrome)"}">🎤</button>
          <button class="btn btn-primary" id="send-btn">Send</button>
        </div>
      </div>
    </div>`;

  // If there's an active session, load its messages
  if (state.chatSession) {
    document.getElementById("chat-header").textContent = state.chatSession.title;
    await loadMessages();
    highlightSession(state.chatSession.id);
  }

  // Session click
  bindSessionClicks();

  // New chat
  document.getElementById("new-chat-btn").addEventListener("click", () => {
    state.chatSession  = null;
    state.chatMessages = [];
    document.getElementById("chat-header").textContent = "New conversation";
    document.getElementById("messages-area").innerHTML = renderWelcome("✨", "Start a new conversation — type a message below.");
    document.querySelectorAll(".session-item").forEach((el) => el.classList.remove("active"));
  });

  // Send
  const send = async () => {
    if (state.chatStreaming) return;
    const $input  = document.getElementById("chat-input");
    const message = $input.value.trim();
    if (!message) return;
    $input.value = "";
    resetInputHeight($input);
    await streamMessage(message);
  };

  document.getElementById("send-btn").addEventListener("click", send);
  document.getElementById("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });

  // Auto-resize chat input
  const $ci = document.getElementById("chat-input");
  $ci.addEventListener("input", () => {
    $ci.style.height = "auto";
    $ci.style.height = Math.min($ci.scrollHeight, 120) + "px";
  });

  // TTS toggle
  document.getElementById("tts-toggle").addEventListener("click", () => {
    voice.ttsEnabled = !voice.ttsEnabled;
    window.speechSynthesis?.cancel();
    const $btn = document.getElementById("tts-toggle");
    if ($btn) {
      $btn.textContent = voice.ttsEnabled ? "🔊 Voice on" : "🔇 Voice off";
      $btn.classList.toggle("on", voice.ttsEnabled);
    }
  });

  // Mic button — listen, then auto-send on silence
  const $mic = document.getElementById("mic-btn");
  if (!voice.supported) {
    $mic.style.opacity = "0.4";
    $mic.style.cursor  = "not-allowed";
  } else {
    let micActive = false;
    $mic.addEventListener("click", () => {
      if (micActive) {
        stopDictation();
        micActive = false;
        $mic.textContent = "🎤";
        $mic.classList.remove("recording");
        return;
      }
      micActive = true;
      $mic.textContent = "⏹";
      $mic.classList.add("recording");

      startDictation(
        (interim) => {
          const $inp = document.getElementById("chat-input");
          if ($inp) { $inp.value = interim; $inp.style.height = "auto"; $inp.style.height = Math.min($inp.scrollHeight, 120) + "px"; }
        },
        null,
        () => {
          micActive = false;
          $mic.textContent = "🎤";
          $mic.classList.remove("recording");
          const val = document.getElementById("chat-input")?.value?.trim();
          if (val) send();
        }
      );
    });
  }
}

function sessionHtml(s) {
  const active = state.chatSession?.id === s.id;
  return `<div class="session-item${active ? " active" : ""}"
    data-id="${s.id}" data-title="${esc(s.title)}">${esc(s.title)}</div>`;
}

function renderWelcome(icon = "💬", sub = "Ask questions about your past entries, explore patterns, or just reflect.") {
  return `<div class="chat-welcome">
    <div style="font-size:2rem;margin-bottom:8px">${icon}</div>
    <h3>Chat with your journal</h3>
    <p>${sub}</p>
  </div>`;
}

async function loadMessages() {
  const $area = document.getElementById("messages-area");
  if (!$area || !state.chatSession) return;
  $area.innerHTML = '<div class="loader">Loading…</div>';
  const msgs = await api(`/api/chat/sessions/${state.chatSession.id}/messages`);
  if (!msgs) return;
  state.chatMessages = msgs;
  paintMessages();
}

function paintMessages() {
  const $area = document.getElementById("messages-area");
  if (!$area) return;
  if (state.chatMessages.length === 0) {
    $area.innerHTML = renderWelcome("💬", "No messages yet — send one to begin.");
    return;
  }
  $area.innerHTML = state.chatMessages
    .map((m) => `<div class="message ${m.role}"><div class="message-content">${esc(m.content).replace(/\n/g, "<br>")}</div></div>`)
    .join("");
  $area.scrollTop = $area.scrollHeight;
}

async function streamMessage(message) {
  const $area = document.getElementById("messages-area");
  const $send = document.getElementById("send-btn");
  if (!$area) return;

  state.chatStreaming = true;
  if ($send) $send.disabled = true;

  // Paint user bubble immediately
  state.chatMessages.push({ role: "user", content: message });
  const assistantMsg = { role: "assistant", content: "" };
  state.chatMessages.push(assistantMsg);
  paintMessages();

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ message, sessionId: state.chatSession?.id }),
    });

    if (!resp.ok) {
      assistantMsg.content = "Error: could not reach AI.";
      paintMessages();
      return;
    }

    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.delta) {
            assistantMsg.content += data.delta;
            paintMessages();
          }
          if (data.done && data.sessionId) {
            const wasNew = !state.chatSession;
            state.chatSession = { id: data.sessionId, title: message.length > 50 ? message.slice(0, 47) + "…" : message };
            if (wasNew) await refreshSessionList();
            highlightSession(data.sessionId);
            document.getElementById("chat-header").textContent = state.chatSession.title;
          }
          if (data.error) assistantMsg.content = `Error: ${data.error}`;
        } catch { /* partial JSON chunk — ignore */ }
      }
    }
  } catch (err) {
    assistantMsg.content = `Error: ${err.message}`;
    paintMessages();
  } finally {
    state.chatStreaming = false;
    if ($send) $send.disabled = false;
    const $a = document.getElementById("messages-area");
    if ($a) $a.scrollTop = $a.scrollHeight;
    if (assistantMsg.content && !assistantMsg.content.startsWith("Error:")) {
      speak(assistantMsg.content);
    }
  }
}

async function refreshSessionList() {
  const sessions = (await api("/api/chat/sessions")) || [];
  const $list = document.getElementById("session-list");
  if (!$list) return;
  $list.innerHTML = sessions.length === 0
    ? '<p class="session-empty">No conversations yet</p>'
    : sessions.map(sessionHtml).join("");
  bindSessionClicks();
}

function highlightSession(id) {
  document.querySelectorAll(".session-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });
}

function bindSessionClicks() {
  document.querySelectorAll(".session-item").forEach((item) => {
    item.addEventListener("click", async () => {
      state.chatSession  = { id: item.dataset.id, title: item.dataset.title };
      state.chatMessages = [];
      document.getElementById("chat-header").textContent = item.dataset.title;
      highlightSession(item.dataset.id);
      await loadMessages();
    });
  });
}

function resetInputHeight($el) {
  $el.style.height = "auto";
}

// ─── Insights view ────────────────────────────────────────────────────────────
const MOOD_COLORS = {
  happy: "#fbbf24", calm: "#34d399", excited: "#fb923c",
  reflective: "#a78bfa", sad: "#60a5fa", anxious: "#f87171",
  angry: "#ef4444", mixed: "#94a3b8",
};

async function renderInsights($main) {
  $main.innerHTML = '<div class="loader">Loading insights…</div>';

  const data = await api("/api/insights/mood?period=30");
  if (!data) return;

  const { moodCounts, streak, memories, totalEntries } = data;
  const hasMoods = Object.keys(moodCounts).length > 0;

  $main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Insights</h1>
        <p class="page-sub">${totalEntries} entr${totalEntries === 1 ? "y" : "ies"} in the last 30 days</p>
      </div>
      ${streak > 0 ? `<div class="streak-badge">🔥 ${streak}-day streak</div>` : ""}
    </div>
    <div class="insights-wrap">
      <div class="insights-grid">

        <!-- Mood distribution -->
        <div class="insight-card">
          <h3>Mood this month</h3>
          ${hasMoods
            ? `<div class="chart-wrap"><canvas id="mood-chart"></canvas></div>
               <div class="mood-legend" id="mood-legend"></div>`
            : `<p class="no-mood-data">No mood data yet — write a few entries and analysis will appear here.</p>`}
        </div>

        <!-- Weekly reflection -->
        <div class="insight-card">
          <h3>Weekly reflection</h3>
          <p class="insight-sub">AI summary of your last 7 days</p>
          <button class="btn btn-primary btn-sm" id="gen-weekly-btn">Generate summary</button>
          <div id="weekly-output" class="weekly-output" hidden></div>
        </div>

        ${memories.length > 0 ? `
        <!-- On this day -->
        <div class="insight-card insight-full">
          <h3>On this day…</h3>
          <div class="memories-list">
            ${memories.map((m) => `
              <a href="#/diary/${m.id}" class="memory-card">
                <div class="memory-meta">
                  <span class="memory-year">${m.yearsAgo} year${m.yearsAgo > 1 ? "s" : ""} ago</span>
                  <span class="memory-title">${esc(m.title)}</span>
                </div>
                <p class="memory-snippet">${esc(m.snippet)}${m.snippet.length === 180 ? "…" : ""}</p>
              </a>`).join("")}
          </div>
        </div>` : ""}

      </div>
    </div>`;

  // Draw doughnut chart
  if (hasMoods) {
    const labels = Object.keys(moodCounts);
    const values = labels.map((l) => moodCounts[l]);
    const colors = labels.map((l) => MOOD_COLORS[l] || "#94a3b8");

    new Chart(document.getElementById("mood-chart"), {
      type: "doughnut",
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }] },
      options: { plugins: { legend: { display: false } }, cutout: "62%", animation: { duration: 500 } },
    });

    document.getElementById("mood-legend").innerHTML = labels
      .map((l, i) => `<div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span>${l} (${values[i]})</span>
      </div>`)
      .join("");
  }

  // Weekly summary button
  document.getElementById("gen-weekly-btn").addEventListener("click", async () => {
    const $btn    = document.getElementById("gen-weekly-btn");
    const $output = document.getElementById("weekly-output");
    $btn.disabled    = true;
    $btn.textContent = "Generating…";
    $output.hidden   = false;
    $output.textContent = "Thinking…";

    const res = await api("/api/insights/weekly", { method: "POST" });
    $btn.disabled    = false;
    $btn.textContent = "Regenerate";

    if (!res || res.error) { $output.textContent = "Failed to generate — try again."; return; }
    $output.textContent = res.summary;
  });
}

// ─── Therapy view ─────────────────────────────────────────────────────────────
const therapy = {
  session:   null,   // { id, title }
  messages:  [],
  streaming: false,
};

async function renderTherapy($main) {
  const sessions = (await api("/api/therapy/sessions")) || [];

  $main.innerHTML = `
    <div class="therapy-disclosure">
      ⚠️ This is an AI companion for emotional support — not a licensed therapist or medical professional.
      In a crisis, call or text <strong>988</strong> (US) or visit <a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a>.
    </div>
    <div class="therapy-layout">
      <div class="therapy-sidebar">
        <div class="therapy-sidebar-header">
          <span>Sessions</span>
          <button class="btn btn-ghost btn-sm" id="new-therapy-btn">+ New</button>
        </div>
        <div class="therapy-session-list" id="therapy-session-list">
          ${sessions.length === 0
            ? '<p class="therapy-session-empty">No sessions yet</p>'
            : sessions.map(therapySessionHtml).join("")}
        </div>
      </div>
      <div class="therapy-main">
        <div class="therapy-header" id="therapy-header">
          ${therapy.session?.title ?? "Start a new session or continue one"}
        </div>
        ${moodCheckinHtml()}
        <div class="messages-area" id="therapy-messages">
          ${therapyWelcomeHtml()}
        </div>
        <div class="therapy-input-area">
          <textarea id="therapy-input" class="chat-input" rows="1"
            placeholder="What's on your mind today…"></textarea>
          <button class="btn-mic" id="therapy-mic" title="Voice input">🎤</button>
          <button class="btn btn-primary therapy-send" id="therapy-send">Send</button>
        </div>
      </div>
    </div>`;

  if (therapy.session) {
    document.getElementById("therapy-header").textContent = therapy.session.title;
    highlightTherapySession(therapy.session.id);
    await loadTherapyMessages();
  }

  bindTherapySessionClicks();

  document.getElementById("new-therapy-btn").addEventListener("click", () => {
    therapy.session  = null;
    therapy.messages = [];
    document.getElementById("therapy-header").textContent = "New session";
    document.getElementById("therapy-messages").innerHTML = therapyWelcomeHtml();
    showMoodCheckin(true);
    document.querySelectorAll(".therapy-session-item").forEach((el) => el.classList.remove("active"));
  });

  // Mood scale buttons
  document.querySelectorAll(".mood-num").forEach(($btn) => {
    $btn.addEventListener("click", async () => {
      document.querySelectorAll(".mood-num").forEach((b) => b.classList.remove("selected"));
      $btn.classList.add("selected");
      const score = parseInt($btn.dataset.score);
      await api("/api/therapy/mood", { method: "POST", body: { score } });
      setTimeout(() => showMoodCheckin(false), 600);
    });
  });

  const sendTherapy = async () => {
    if (therapy.streaming) return;
    const $input = document.getElementById("therapy-input");
    const message = $input.value.trim();
    if (!message) return;
    $input.value = "";
    resetInputHeight($input);
    await streamTherapy(message);
  };

  document.getElementById("therapy-send").addEventListener("click", sendTherapy);
  document.getElementById("therapy-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTherapy(); }
  });

  const $ti = document.getElementById("therapy-input");
  $ti.addEventListener("input", () => {
    $ti.style.height = "auto";
    $ti.style.height = Math.min($ti.scrollHeight, 120) + "px";
  });

  // Mic support in therapy
  const $mic = document.getElementById("therapy-mic");
  if (!voice.supported) {
    $mic.style.opacity = "0.4"; $mic.style.cursor = "not-allowed";
  } else {
    let micActive = false;
    $mic.addEventListener("click", () => {
      if (micActive) { stopDictation(); micActive = false; $mic.textContent = "🎤"; $mic.classList.remove("recording"); return; }
      micActive = true; $mic.textContent = "⏹"; $mic.classList.add("recording");
      startDictation(
        (interim) => { const $i = document.getElementById("therapy-input"); if ($i) $i.value = interim; },
        null,
        () => { micActive = false; $mic.textContent = "🎤"; $mic.classList.remove("recording"); const v = document.getElementById("therapy-input")?.value?.trim(); if (v) sendTherapy(); }
      );
    });
  }
}

function therapySessionHtml(s) {
  const active = therapy.session?.id === s.id;
  return `<div class="therapy-session-item${active ? " active" : ""}" data-id="${s.id}" data-title="${esc(s.title)}">${esc(s.title)}</div>`;
}

function therapyWelcomeHtml() {
  return `<div class="chat-welcome">
    <div style="font-size:2rem;margin-bottom:8px">🧘</div>
    <h3>Your safe space to reflect</h3>
    <p>Share what's on your mind. I'll listen without judgement and help you explore what you're feeling.</p>
  </div>`;
}

function moodCheckinHtml() {
  return `<div class="mood-checkin" id="mood-checkin">
    <h4>How are you feeling right now?</h4>
    <div class="mood-scale">
      ${[1,2,3,4,5,6,7,8,9,10].map((n) => `<button class="mood-num" data-score="${n}">${n}</button>`).join("")}
    </div>
    <p class="mood-scale-labels"><span>Struggling</span><span>Doing great</span></p>
  </div>`;
}

function showMoodCheckin(show) {
  const $c = document.getElementById("mood-checkin");
  if ($c) $c.style.display = show ? "" : "none";
}

async function loadTherapyMessages() {
  const $area = document.getElementById("therapy-messages");
  if (!$area || !therapy.session) return;
  $area.innerHTML = '<div class="loader">Loading…</div>';
  const msgs = await api(`/api/therapy/sessions/${therapy.session.id}/messages`);
  if (!msgs) return;
  therapy.messages = msgs;
  paintTherapyMessages();
  showMoodCheckin(false);
}

function paintTherapyMessages() {
  const $area = document.getElementById("therapy-messages");
  if (!$area) return;
  if (therapy.messages.length === 0) { $area.innerHTML = therapyWelcomeHtml(); return; }
  $area.innerHTML = therapy.messages.map((m) =>
    `<div class="message ${m.role}${m.crisis ? " crisis" : ""}">
      <div class="message-content">${esc(m.content).replace(/\n/g, "<br>")}</div>
    </div>`
  ).join("");
  $area.scrollTop = $area.scrollHeight;
}

async function streamTherapy(message) {
  const $area = document.getElementById("therapy-messages");
  const $send = document.getElementById("therapy-send");
  if (!$area) return;

  therapy.streaming = true;
  if ($send) $send.disabled = true;
  showMoodCheckin(false);

  therapy.messages.push({ role: "user", content: message });
  const assistantMsg = { role: "assistant", content: "" };
  therapy.messages.push(assistantMsg);
  paintTherapyMessages();

  try {
    const resp = await fetch("/api/therapy/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ message, sessionId: therapy.session?.id }),
    });
    if (!resp.ok) { assistantMsg.content = "Could not reach AI. Please try again."; paintTherapyMessages(); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.delta) { assistantMsg.content += data.delta; paintTherapyMessages(); }
          if (data.crisis) assistantMsg.crisis = true;
          if (data.done && data.sessionId) {
            const wasNew = !therapy.session;
            therapy.session = { id: data.sessionId, title: message.length > 50 ? message.slice(0, 47) + "…" : message };
            document.getElementById("therapy-header").textContent = therapy.session.title;
            if (wasNew) await refreshTherapySessions();
            highlightTherapySession(data.sessionId);
          }
          if (data.error) assistantMsg.content = `Error: ${data.error}`;
        } catch { /* partial chunk */ }
      }
    }
  } catch (err) {
    assistantMsg.content = `Error: ${err.message}`;
    paintTherapyMessages();
  } finally {
    therapy.streaming = false;
    if ($send) $send.disabled = false;
    const $a = document.getElementById("therapy-messages");
    if ($a) $a.scrollTop = $a.scrollHeight;
    if (assistantMsg.content && !assistantMsg.content.startsWith("Error:") && !assistantMsg.crisis) {
      speak(assistantMsg.content);
    }
  }
}

async function refreshTherapySessions() {
  const sessions = (await api("/api/therapy/sessions")) || [];
  const $list = document.getElementById("therapy-session-list");
  if (!$list) return;
  $list.innerHTML = sessions.length === 0
    ? '<p class="therapy-session-empty">No sessions yet</p>'
    : sessions.map(therapySessionHtml).join("");
  bindTherapySessionClicks();
}

function highlightTherapySession(id) {
  document.querySelectorAll(".therapy-session-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });
}

function bindTherapySessionClicks() {
  document.querySelectorAll(".therapy-session-item").forEach((item) => {
    item.addEventListener("click", async () => {
      therapy.session  = { id: item.dataset.id, title: item.dataset.title };
      therapy.messages = [];
      document.getElementById("therapy-header").textContent = item.dataset.title;
      highlightTherapySession(item.dataset.id);
      await loadTherapyMessages();
    });
  });
}

// ─── Search view ──────────────────────────────────────────────────────────────
function renderSearch($main) {
  $main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Search</h1>
        <p class="page-sub">Find entries by meaning, not just keywords</p>
      </div>
    </div>
    <div class="search-container">
      <div class="search-input-wrap">
        <input id="search-input" class="search-field" type="text"
          placeholder="e.g. times I felt anxious, moments of joy, work stress…">
        <button class="btn btn-primary" id="search-btn">Search</button>
      </div>
      <div id="search-results"></div>
    </div>`;

  const doSearch = async () => {
    const query    = document.getElementById("search-input").value.trim();
    const $results = document.getElementById("search-results");
    if (!query) return;
    $results.innerHTML = '<div class="loader">Searching…</div>';

    const results = await api("/api/search", { method: "POST", body: { query, k: 8 } });
    if (!results) return;

    if (results.length === 0) {
      $results.innerHTML = '<div class="empty-state"><p>No matching entries found.</p></div>';
      return;
    }

    $results.innerHTML = results
      .map(
        (r) => `
        <a href="#/diary/${r.id}" class="search-result">
          <div class="search-result-header">
            <span class="entry-card-title">${esc(r.title || "Untitled")}</span>
            <span class="search-score">${Math.round(r.score * 100)}% match · ${fmtDate(r.writtenAt)}</span>
          </div>
          <p class="entry-card-preview">${esc(preview(r.body))}</p>
        </a>`
      )
      .join("");
  };

  document.getElementById("search-btn").addEventListener("click", doSearch);
  document.getElementById("search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

// ─── Privacy badge ────────────────────────────────────────────────────────────
async function refreshPrivacyBadge() {
  const $badge = document.getElementById("privacy-badge");
  if (!$badge) return;
  try {
    const cfg = await api("/api/config");
    if (!cfg) return;
    const isLocal = cfg.active.privacy === "local";
    $badge.className = `privacy-badge ${isLocal ? "privacy-local" : "privacy-cloud"}`;
    $badge.textContent = isLocal ? "🟢 Local — fully private" : "🟡 Cloud — " + cfg.active.provider;
  } catch { /* non-fatal */ }
}

// ─── Settings view ────────────────────────────────────────────────────────────
async function renderSettings($main) {
  $main.innerHTML = '<div class="loader">Loading…</div>';

  const cfg = await api("/api/config");
  if (!cfg) return;

  const { active, available, privacyTiers } = cfg;
  const localProviders = Object.entries(privacyTiers).filter(([, t]) => t === "local").map(([p]) => p);
  const cloudProviders = Object.entries(privacyTiers).filter(([, t]) => t === "cloud").map(([p]) => p);

  const modelOptions = (provider) =>
    (available[provider] || []).map((m) => `<option value="${m}" ${m === active.model && provider === active.provider ? "selected" : ""}>${m}</option>`).join("");

  const providerCard = (p, tier) => {
    const isActive = active.provider === p;
    return `
    <label class="provider-card ${isActive ? "provider-card--active" : ""}" data-provider="${p}">
      <input type="radio" name="provider" value="${p}" ${isActive ? "checked" : ""} style="display:none">
      <div class="provider-card-header">
        <span class="provider-name">${p}</span>
        <span class="provider-tier ${tier === "local" ? "tier-local" : "tier-cloud"}">${tier === "local" ? "🟢 Local" : "🟡 Cloud"}</span>
      </div>
      <div class="provider-models" id="models-${p}" style="${isActive ? "" : "display:none"}">
        <select class="input" id="model-select-${p}">${modelOptions(p)}</select>
      </div>
    </label>`;
  };

  $main.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-sub">Choose how DairyGPT thinks — and who sees your data</p>
      </div>
    </div>
    <div style="padding:20px 32px 48px;max-width:860px">

    <div class="settings-section">
      <h2 class="settings-heading">🟢 Local Mode <span class="settings-badge settings-badge--local">Zero data leaves your machine</span></h2>
      <p class="settings-desc">Uses Ollama running locally. No API key needed. Your diary never leaves your device.</p>
      <div class="provider-grid">
        ${localProviders.map((p) => providerCard(p, "local")).join("")}
      </div>
    </div>

    <div class="settings-section">
      <h2 class="settings-heading">🟡 Cloud Mode <span class="settings-badge settings-badge--cloud">Opt-in · Bring your own key</span></h2>
      <p class="settings-desc">Higher reasoning quality. Your diary context is sent to the provider's API during active requests.</p>
      <div class="provider-grid">
        ${cloudProviders.map((p) => providerCard(p, "cloud")).join("")}
      </div>
      <div class="api-key-wrap" id="api-key-wrap" style="${localProviders.includes(active.provider) ? "display:none" : ""}">
        <label class="label">API Key for <span id="api-key-provider">${active.provider}</span></label>
        <input type="password" class="input" id="api-key-input"
          placeholder="${active.hasCustomKey ? "Key saved — enter new to replace" : "Paste your API key here"}"
          autocomplete="off">
        <p class="settings-hint">Stored locally on this server. Never sent to any other service.</p>
      </div>
    </div>

    <div id="settings-status" class="settings-status" hidden></div>
    <button class="btn btn-primary" id="settings-save">Save settings</button>
    </div>`;

  // ── interaction: highlight selected card, show its models ──
  $main.querySelectorAll('input[name="provider"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const selected = radio.value;
      $main.querySelectorAll(".provider-card").forEach((card) => {
        const p = card.dataset.provider;
        card.classList.toggle("provider-card--active", p === selected);
        card.querySelector(".provider-models").style.display = p === selected ? "" : "none";
      });
      const isCloud = !localProviders.includes(selected);
      document.getElementById("api-key-wrap").style.display = isCloud ? "" : "none";
      document.getElementById("api-key-provider").textContent = selected;
    });
  });

  document.getElementById("settings-save").addEventListener("click", async () => {
    const selectedProvider = $main.querySelector('input[name="provider"]:checked')?.value;
    if (!selectedProvider) return;

    const selectedModel = document.getElementById(`model-select-${selectedProvider}`)?.value;
    const apiKeyInput   = document.getElementById("api-key-input")?.value.trim();
    const $status       = document.getElementById("settings-status");

    const body = { provider: selectedProvider, model: selectedModel };
    if (apiKeyInput) body.apiKey = apiKeyInput;

    const result = await api("/api/config", { method: "POST", body });
    $status.hidden = false;
    if (!result) {
      $status.className = "settings-status settings-status--error";
      $status.textContent = "Failed to save settings.";
    } else {
      $status.className = "settings-status settings-status--ok";
      $status.textContent = result.privacy === "local"
        ? "✓ Saved — running fully local. Zero data leaves your machine."
        : `✓ Saved — using ${result.provider} (${result.model}).`;
      refreshPrivacyBadge();
    }
  });
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function showErr($el, msg) {
  $el.textContent = msg;
  $el.hidden = false;
}
