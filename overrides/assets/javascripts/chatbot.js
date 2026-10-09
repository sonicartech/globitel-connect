/* Globitel Connect documentation assistant widget.
 * Talks to the Cloudflare Worker in /chatbot-worker. Configured by
 * window.GC_CHATBOT = { endpoint, lang, siteRoot, suggestions } (see overrides/main.html). */
(function () {
  "use strict";

  var config = window.GC_CHATBOT;
  if (!config || !config.endpoint || document.getElementById("gc-chat")) return;

  var lang = config.lang === "ar" ? "ar" : "en";
  var STRINGS = {
    en: {
      open: "Ask the AI assistant",
      close: "Close assistant",
      reset: "Start a new conversation",
      title: "Globitel Assistant",
      subtitle: "Answers from this documentation",
      welcome: "Hi! I can answer questions about Globitel Connect using this documentation. What would you like to know?",
      placeholder: "Ask a question…",
      send: "Send",
      stop: "Stop",
      sources: "Sources",
      disclaimer: "AI answers can be wrong. Check the source pages.",
      thinking: "Thinking…",
      errors: {
        rate_limited: "You're sending questions too quickly. Please wait a minute and try again.",
        quota_exceeded: "The assistant has reached today's limit. Please try again tomorrow.",
        network: "Couldn't reach the assistant. Check your connection and try again.",
        generic: "Something went wrong. Please try again.",
      },
    },
    ar: {
      open: "اسأل المساعد الذكي",
      close: "إغلاق المساعد",
      reset: "بدء محادثة جديدة",
      title: "مساعد جلوبيتل",
      subtitle: "إجابات من هذا الدليل",
      welcome: "مرحبًا! يمكنني الإجابة عن أسئلتك حول جلوبيتل كونكت باستخدام هذا الدليل. كيف يمكنني مساعدتك؟",
      placeholder: "اكتب سؤالك…",
      send: "إرسال",
      stop: "إيقاف",
      sources: "المصادر",
      disclaimer: "قد تحتوي إجابات الذكاء الاصطناعي على أخطاء. راجع صفحات المصادر.",
      thinking: "جارٍ التفكير…",
      errors: {
        rate_limited: "أرسلت أسئلة كثيرة بسرعة. يرجى الانتظار دقيقة ثم المحاولة مجددًا.",
        quota_exceeded: "وصل المساعد إلى الحد اليومي. يرجى المحاولة غدًا.",
        network: "تعذر الاتصال بالمساعد. تحقق من اتصالك وحاول مجددًا.",
        generic: "حدث خطأ ما. يرجى المحاولة مجددًا.",
      },
    },
  };
  var t = STRINGS[lang];
  var STORE_KEY = "gc-chat:" + lang;
  var MAX_HISTORY = 10;

  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.1 1 4 2.7 5.4L4 21l4.4-2.3c1.1.3 2.3.5 3.6.5 5.5 0 10-3.6 10-8s-4.5-8.2-10-8.2Zm-4 9.2a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2Zm6.5 11 1 2.9 2.9 1-2.9 1-1 2.9-1-2.9-2.9-1 2.9-1 1-2.9Z"/></svg>',
  };

  // ---------- state ----------
  var state = load() || { open: false, messages: [] };
  var controller = null;

  function load() {
    try { return JSON.parse(sessionStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  // ---------- helpers ----------
  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    for (var key in attrs || {}) node.setAttribute(key, attrs[key]);
    if (html != null) node.innerHTML = html;
    return node;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inline(s) {
    return escapeHtml(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  }
  // Minimal, safe Markdown: paragraphs, headings, ordered/unordered lists.
  function markdown(text) {
    var html = "", list = null;
    function closeList() { if (list) { html += "</" + list + ">"; list = null; } }
    text.split(/\n/).forEach(function (line) {
      var m;
      if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
        if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; }
        html += "<li>" + inline(m[2]) + "</li>";
      } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
        if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; }
        html += "<li>" + inline(m[1]) + "</li>";
      } else if ((m = line.match(/^#{1,6}\s+(.*)$/))) {
        closeList(); html += "<p><strong>" + inline(m[1]) + "</strong></p>";
      } else if (line.trim()) {
        closeList(); html += "<p>" + inline(line) + "</p>";
      }
    });
    closeList();
    return html;
  }
  function pageUrl(location) {
    try { return new URL(location, new URL(config.siteRoot, window.location.href)).href; }
    catch (e) { return location; }
  }

  // ---------- DOM ----------
  var root = el("div", { id: "gc-chat", class: "gc-chat", dir: lang === "ar" ? "rtl" : "ltr", lang: lang });
  var launcher = el("button", {
    type: "button", class: "gc-chat__launcher", "aria-label": t.open, title: t.open,
    "aria-controls": "gc-chat-panel", "aria-expanded": "false",
  }, ICONS.chat);
  var panel = el("section", {
    id: "gc-chat-panel", class: "gc-chat__panel", role: "dialog",
    "aria-labelledby": "gc-chat-title", hidden: "",
  });
  panel.innerHTML =
    '<header class="gc-chat__header">' +
      '<span class="gc-chat__avatar">' + ICONS.spark + "</span>" +
      '<div class="gc-chat__heading"><h2 id="gc-chat-title">' + escapeHtml(t.title) + "</h2>" +
      "<p>" + escapeHtml(t.subtitle) + "</p></div>" +
      '<button type="button" class="gc-chat__icon-btn" data-action="reset" aria-label="' + escapeHtml(t.reset) + '" title="' + escapeHtml(t.reset) + '">' + ICONS.reset + "</button>" +
      '<button type="button" class="gc-chat__icon-btn" data-action="close" aria-label="' + escapeHtml(t.close) + '" title="' + escapeHtml(t.close) + '">' + ICONS.close + "</button>" +
    "</header>" +
    '<div class="gc-chat__log" role="log" aria-live="polite"></div>' +
    '<form class="gc-chat__form">' +
      '<label class="gc-chat__sr" for="gc-chat-input">' + escapeHtml(t.placeholder) + "</label>" +
      '<textarea id="gc-chat-input" rows="1" maxlength="1000" placeholder="' + escapeHtml(t.placeholder) + '"></textarea>' +
      '<button type="submit" class="gc-chat__send" aria-label="' + escapeHtml(t.send) + '" title="' + escapeHtml(t.send) + '">' + ICONS.send + "</button>" +
    "</form>" +
    '<p class="gc-chat__disclaimer">' + escapeHtml(t.disclaimer) + "</p>";

  root.appendChild(panel);
  root.appendChild(launcher);
  document.body.appendChild(root);

  var log = panel.querySelector(".gc-chat__log");
  var form = panel.querySelector(".gc-chat__form");
  var input = panel.querySelector("textarea");
  var sendBtn = panel.querySelector(".gc-chat__send");

  function renderMessage(msg) {
    var bubble = el("div", { class: "gc-chat__msg gc-chat__msg--" + (msg.role === "user" ? "user" : "bot") + (msg.error ? " gc-chat__msg--error" : "") });
    var body = el("div", { class: "gc-chat__bubble" });
    if (msg.role === "user") body.textContent = msg.content;
    else body.innerHTML = msg.content ? markdown(msg.content) : '<span class="gc-chat__typing" aria-label="' + escapeHtml(t.thinking) + '"><i></i><i></i><i></i></span>';
    bubble.appendChild(body);
    if (msg.sources && msg.sources.length && msg.content) {
      var src = el("div", { class: "gc-chat__sources" });
      src.appendChild(el("span", { class: "gc-chat__sources-label" }, escapeHtml(t.sources)));
      msg.sources.forEach(function (s) {
        var a = el("a", { href: pageUrl(s.url) });
        a.textContent = s.title;
        src.appendChild(a);
      });
      bubble.appendChild(src);
    }
    return bubble;
  }

  function renderSuggestions() {
    var list = config.suggestions || [];
    if (!list.length) return null;
    var wrap = el("div", { class: "gc-chat__suggestions" });
    list.forEach(function (q) {
      var b = el("button", { type: "button", class: "gc-chat__chip" });
      b.textContent = q;
      b.addEventListener("click", function () { ask(q); });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function render() {
    log.innerHTML = "";
    log.appendChild(renderMessage({ role: "assistant", content: t.welcome }));
    if (!state.messages.length) {
      var chips = renderSuggestions();
      if (chips) log.appendChild(chips);
    }
    state.messages.forEach(function (m) { log.appendChild(renderMessage(m)); });
    log.scrollTop = log.scrollHeight;
  }

  function updateLast() {
    var last = log.lastElementChild;
    var fresh = renderMessage(state.messages[state.messages.length - 1]);
    if (last && last.classList.contains("gc-chat__msg")) log.replaceChild(fresh, last);
    else log.appendChild(fresh);
    var nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
    if (nearBottom) log.scrollTop = log.scrollHeight;
  }

  function setBusy(busy) {
    sendBtn.innerHTML = busy ? ICONS.stop : ICONS.send;
    sendBtn.setAttribute("aria-label", busy ? t.stop : t.send);
    sendBtn.title = busy ? t.stop : t.send;
    sendBtn.classList.toggle("is-busy", busy);
  }

  function setOpen(open) {
    state.open = open;
    save();
    panel.hidden = !open;
    root.classList.toggle("is-open", open);
    launcher.setAttribute("aria-expanded", String(open));
    if (open) {
      render();
      setTimeout(function () { input.focus(); }, 50);
    }
  }

  // ---------- network ----------
  function ask(question) {
    question = question.trim();
    if (!question || controller) return;
    var history = state.messages
      .filter(function (m) { return !m.error && m.content; })
      .map(function (m) { return { role: m.role, content: m.content }; });
    history.push({ role: "user", content: question });
    history = history.slice(-MAX_HISTORY);

    state.messages.push({ role: "user", content: question });
    var answer = { role: "assistant", content: "", sources: [] };
    state.messages.push(answer);
    render();
    input.value = "";
    autosize();
    setBusy(true);

    controller = new AbortController();
    fetch(config.endpoint.replace(/\/$/, "") + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: lang, messages: history }),
      signal: controller.signal,
    })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            throw new Error(data.error || (res.status === 429 ? "rate_limited" : "generic"));
          });
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            buffer += decoder.decode(r.value, { stream: true });
            var events = buffer.split("\n\n");
            buffer = events.pop();
            events.forEach(function (evt) {
              var data = evt.replace(/^data:\s?/, "").trim();
              if (!data || data === "[DONE]") return;
              var payload;
              try { payload = JSON.parse(data); } catch (e) { return; }
              if (payload.sources) answer.sources = payload.sources;
              if (payload.t) answer.content += payload.t;
              if (payload.error) throw new Error(payload.error);
            });
            if (state.messages.indexOf(answer) === -1) return reader.cancel();
            updateLast();
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) {
        if (err.name === "AbortError") return;
        var key = err && err.message;
        answer.error = true;
        answer.sources = [];
        answer.content = t.errors[key] || (err instanceof TypeError ? t.errors.network : t.errors.generic);
      })
      .then(function () {
        controller = null;
        setBusy(false);
        var index = state.messages.indexOf(answer);
        if (index === -1) return; // conversation was reset meanwhile
        if (!answer.content) state.messages.splice(index, 1);
        save();
        render();
      });
  }

  // ---------- events ----------
  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
    input.style.overflowY = input.scrollHeight > 140 ? "auto" : "hidden";
  }

  launcher.addEventListener("click", function () { setOpen(!state.open); });
  panel.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "close") { setOpen(false); launcher.focus(); }
    if (btn.dataset.action === "reset") {
      if (controller) controller.abort();
      state.messages = [];
      save();
      render();
      input.focus();
    }
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (controller) { controller.abort(); return; }
    ask(input.value);
  });
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && state.open) { setOpen(false); launcher.focus(); }
  });

  // Any element with data-gc-chat-open (e.g. the FAQ help box) opens the assistant.
  document.documentElement.classList.add("gc-chat-ready");
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-gc-chat-open]");
    if (!trigger) return;
    e.preventDefault();
    if (!state.open) setOpen(true);
    else input.focus();
  });

  // An answer that was streaming when the page changed can't resume.
  state.messages = state.messages.filter(function (m) { return m.content; });
  setOpen(!!state.open);
})();
