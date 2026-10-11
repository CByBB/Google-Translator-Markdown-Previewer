(function () {
  const PREVIEW_CSS = [
    ":host {",
    "  display: block;",
    "  box-sizing: border-box;",
    "  pointer-events: none;",
    "  color: inherit;",
    "  font: inherit;",
    "  line-height: 1.55;",
    "}",
    ".body {",
    "  height: auto;",
    "  overflow: visible;",
    "  box-sizing: border-box;",
    "  pointer-events: auto;",
    "  word-wrap: break-word;",
    "  overflow-wrap: break-word;",
    "}",
    ".body > :first-child { margin-top: 0; }",
    ".body > :last-child { margin-bottom: 0; }",
    "h1, h2, h3, h4, h5, h6 { font-weight: 600; line-height: 1.3; }",
    "h1 { font-size: 1.5em; margin: 0 0 0.4em; }",
    "h2 { font-size: 1.3em; margin: 0.7em 0 0.35em; }",
    "h3 { font-size: 1.14em; margin: 0.7em 0 0.3em; }",
    "h4, h5, h6 { font-size: 1em; margin: 0.6em 0 0.25em; }",
    "p { margin: 0.4em 0; }",
    "ul, ol { margin: 0.35em 0; padding-left: 1.35em; }",
    "li { margin: 0.15em 0; }",
    "li.task { list-style: none; margin-left: -1.15em; }",
    "li.task input { margin-right: 0.35em; }",
    "blockquote {",
    "  margin: 0.45em 0;",
    "  padding: 0.1em 0 0.1em 0.8em;",
    "  border-left: 3px solid color-mix(in srgb, currentColor 35%, transparent);",
    "}",
    "hr {",
    "  border: 0;",
    "  border-top: 1px solid color-mix(in srgb, currentColor 22%, transparent);",
    "  margin: 0.8em 0;",
    "}",
    "a { color: var(--gtt-link, #1a73e8); text-decoration: none; }",
    "a:hover { text-decoration: underline; }",
    "code {",
    "  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;",
    "  font-size: 0.88em;",
    "  background: color-mix(in srgb, currentColor 10%, transparent);",
    "  border-radius: 4px;",
    "  padding: 0.1em 0.35em;",
    "}",
    "pre {",
    "  margin: 0.5em 0;",
    "  padding: 10px 12px;",
    "  overflow-x: auto;",
    "  overflow-y: hidden;",
    "  border-radius: 8px;",
    "  background: color-mix(in srgb, currentColor 8%, transparent);",
    "}",
    "pre code { background: transparent; padding: 0; font-size: 0.85em; }",
    "table { width: 100%; border-collapse: collapse; margin: 0.5em 0; }",
    "th, td {",
    "  border: 1px solid rgba(128, 128, 128, 0.45);",
    "  padding: 4px 8px;",
    "  vertical-align: top;",
    "  overflow-wrap: anywhere;",
    "}",
    ".diagram { margin: 0.55em 0; }",
    ".diagram iframe {",
    "  display: block;",
    "  width: 100%;",
    "  min-height: 48px;",
    "  border: 0;",
    "  background: transparent;",
    "}",
    "th { font-weight: 600; }",
    "img { max-width: 100%; height: auto; border-radius: 8px; }",
  ].join("\n");

  const state = {
    enabled: true,
    result: null,
    toggle: null,
    timer: 0,
    scanning: false,
    fullSource: "",
    fullTranslation: "",
    translateKey: "",
    assembling: false,
    assembleToken: 0,
    assembleTimer: 0,
    assembleAfter: 0,
    giveUpKey: "",
  };

  function storageGet(callback) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({ mdPreviewEnabled: true }, callback);
        return;
      }
    } catch (error) {
      /* storage is unavailable outside the extension */
    }
    callback({ mdPreviewEnabled: true });
  }

  function storageSet(enabled) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ mdPreviewEnabled: enabled });
      }
    } catch (error) {
      /* ignore */
    }
  }

  function watchStorage() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if (area === "local" && changes.mdPreviewEnabled) {
            state.enabled = changes.mdPreviewEnabled.newValue !== false;
            schedule();
          }
        });
      }
    } catch (error) {
      /* ignore */
    }
  }

  function pageLimit() {
    return GTTMarkdown.pageLimit || 5000;
  }

  function sourceField() {
    const fields = document.querySelectorAll('textarea[jsname="BJE2fc"], textarea.er8xn');
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields[i];
      const rect = field.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) return field;
    }
    return null;
  }

  function resultBox() {
    const boxes = document.querySelectorAll(".lRu31");
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i];
      const rect = box.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40 && box.querySelector(".HwtZe")) return box;
    }
    return null;
  }

  function positionedAncestor(element) {
    let node = element.parentElement;
    while (node && node !== document.body) {
      const position = getComputedStyle(node).position;
      if (position === "relative" || position === "absolute" || position === "fixed" || position === "sticky") {
        return node;
      }
      node = node.parentElement;
    }
    return document.body;
  }

  function linkColor(element) {
    const match = getComputedStyle(element).color.match(/\d+/g);
    if (!match) return "#1a73e8";
    const red = Number(match[0]);
    const green = Number(match[1]);
    const blue = Number(match[2]);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance > 160 ? "#8ab4f8" : "#1a73e8";
  }

  function isDarkPage() {
    const match = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    if (!match) return false;
    const luminance = 0.2126 * Number(match[0]) + 0.7152 * Number(match[1]) + 0.0722 * Number(match[2]);
    return luminance < 80;
  }

  function createHost(className) {
    const host = document.createElement("div");
    host.className = "gtt-md-host " + className;
    host.hidden = true;
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = PREVIEW_CSS;
    const body = document.createElement("div");
    body.className = "body";
    shadow.appendChild(style);
    shadow.appendChild(body);
    return { host: host, shadow: shadow, body: body };
  }

  function place(host, anchor) {
    const root = positionedAncestor(anchor);
    if (host.parentElement !== root) root.appendChild(host);
    const rootRect = root.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    host.style.position = "absolute";
    host.style.margin = "0";
    host.style.zIndex = "4";
    host.style.top = anchorRect.top - rootRect.top + root.scrollTop + "px";
    host.style.left = anchorRect.left - rootRect.left + root.scrollLeft + "px";
    host.style.width = anchorRect.width + "px";
    host.style.height = "auto";
    host.style.minHeight = "0";
    host.style.overflow = "visible";
    host.style.padding = getComputedStyle(anchor).padding;
    host.style.font = getComputedStyle(anchor).font;
    const color = getComputedStyle(anchor).color;
    if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") host.style.color = color;
    host.style.setProperty("--gtt-link", linkColor(anchor));
  }

  function setRawHidden(element, hidden) {
    if (!element) return;
    element.classList.toggle("gtt-md-hide-raw", hidden);
    if (hidden) {
      element.style.setProperty("color", "transparent", "important");
      element.style.setProperty("-webkit-text-fill-color", "transparent", "important");
    } else {
      element.style.removeProperty("color");
      element.style.removeProperty("-webkit-text-fill-color");
    }
  }

  function ensureResult(box) {
    if (state.result && state.result.box === box) return state.result;
    destroyResult();
    const view = createHost("gtt-md-host-result");
    view.host.title = "Markdown preview of the translation";
    state.result = { box: box, host: view.host, body: view.body, listeners: [] };
    return state.result;
  }

  function clearDiagrams(view) {
    (view.listeners || []).forEach(function (listener) {
      window.removeEventListener("message", listener);
    });
    view.listeners = [];
  }

  function destroyResult() {
    if (!state.result) return;
    clearDiagrams(state.result);
    releaseResultBox(state.result.box);
    const raw = state.result.box.querySelector(".HwtZe");
    setRawHidden(raw, false);
    state.result.host.remove();
    state.result = null;
  }

  function sourceCard(textarea) {
    return textarea.closest("c-wiz") || textarea.parentElement;
  }

  function ensureButtons(card) {
    if (!state.toggle || !card.contains(state.toggle)) {
      if (state.toggle) state.toggle.remove();
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "gtt-md-btn gtt-md-toggle";
      toggle.textContent = "Markdown";
      toggle.title = "Render Markdown in the translation";
      toggle.addEventListener("click", function () {
        state.enabled = !state.enabled;
        storageSet(state.enabled);
        schedule();
      });
      card.appendChild(toggle);
      state.toggle = toggle;
    }
    card.classList.toggle("gtt-md-dark", isDarkPage());
  }

  function hideButtons() {
    if (state.toggle) {
      state.toggle.remove();
      state.toggle = null;
    }
  }

  function languages() {
    const params = new URLSearchParams(location.search);
    return {
      sl: params.get("sl") || "auto",
      tl: params.get("tl") || "en",
    };
  }

  function translateKey(full) {
    const lang = languages();
    return lang.sl + ">" + lang.tl + "\n" + full;
  }

  function translateChunk(text, sl, tl) {
    const id = "gtt" + Math.random().toString(36).slice(2);
    return new Promise(function (resolve) {
      let settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        document.removeEventListener("gtt-translate-result", onCustom);
        resolve(value || "");
      }
      function onMessage(event) {
        if (!event.data || event.data.type !== "gtt-translate-result" || event.data.id !== id) return;
        finish(event.data.text);
      }
      function onCustom(event) {
        if (!event.detail || event.detail.id !== id) return;
        finish(event.detail.text);
      }
      window.addEventListener("message", onMessage);
      document.addEventListener("gtt-translate-result", onCustom);
      const detail = { id: id, text: text, sl: sl, tl: tl };
      document.dispatchEvent(new CustomEvent("gtt-translate-request", { detail: detail }));
      window.postMessage({ type: "gtt-translate-request", id: id, text: text, sl: sl, tl: tl }, "*");
      setTimeout(function () { finish(""); }, 20000);
    });
  }

  function pagerButton(jsname) {
    const buttons = document.querySelectorAll('button[jsname="' + jsname + '"]');
    for (let index = 0; index < buttons.length; index += 1) {
      const rect = buttons[index].getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) return buttons[index];
    }
    return buttons[0] || null;
  }

  function buttonVisible(button) {
    if (!button || button.disabled) return false;
    const rect = button.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function googleHasMultiplePages() {
    return buttonVisible(pagerButton("OCpkoe")) || buttonVisible(pagerButton("VfNHU"));
  }

  function sourceValue() {
    const field = sourceField();
    return field ? field.value : "";
  }

  function waitUntil(check, tries) {
    return new Promise(function (resolve) {
      let left = tries || 20;
      function tick() {
        if (check() || left <= 0) {
          resolve(check());
          return;
        }
        left -= 1;
        setTimeout(tick, 50);
      }
      tick();
    });
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function currentResultText() {
    const box = resultBox();
    return readResultText(box && box.querySelector(".HwtZe"));
  }

  async function settledResult(previous) {
    let last = "";
    let stable = 0;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const text = currentResultText();
      if (text && text !== previous) {
        if (text === last) {
          stable += 1;
          if (stable >= 2) return text;
        } else {
          stable = 1;
          last = text;
        }
      }
      await delay(120);
    }
    return last || currentResultText();
  }

  function joinChunks(chunks) {
    return chunks.reduce(function (full, chunk) {
      if (!chunk) return full;
      if (!full) return chunk;
      if (/\n$/.test(full) || /^\n/.test(chunk)) return full + chunk;
      return full + "\n" + chunk;
    }, "");
  }

  async function readGooglePages() {
    const started = sourceValue();
    let guard = 0;
    while (pagerButton("VfNHU") && !pagerButton("VfNHU").disabled && guard < 40) {
      const before = sourceValue();
      pagerButton("VfNHU").click();
      await waitUntil(function () { return sourceValue() !== before; }, 16);
      guard += 1;
    }
    const sources = [];
    const results = [];
    guard = 0;
    let previousResult = "";
    while (guard < 40) {
      sources.push(sourceValue());
      const result = await settledResult(previousResult);
      results.push(result);
      previousResult = result || previousResult;
      const next = pagerButton("OCpkoe");
      if (!next || next.disabled || next.getBoundingClientRect().width < 1) break;
      const source = sourceValue();
      next.click();
      const moved = await waitUntil(function () { return sourceValue() !== source; }, 20);
      if (!moved) break;
      guard += 1;
    }
    guard = 0;
    while (sourceValue() !== started && pagerButton("VfNHU") && !pagerButton("VfNHU").disabled && guard < 40) {
      const before = sourceValue();
      pagerButton("VfNHU").click();
      await waitUntil(function () { return sourceValue() !== before; }, 16);
      guard += 1;
    }
    return { sources: sources, results: results };
  }

  function cachedFull(value) {
    return state.fullSource && state.fullTranslation && value && state.fullSource.indexOf(value) !== -1 && state.translateKey === translateKey(state.fullSource);
  }

  function scheduleAssemble() {
    if (state.assembling || !googleHasMultiplePages() || Date.now() < state.assembleAfter) return;
    const value = sourceValue();
    if (cachedFull(value)) return;
    if (state.giveUpKey && state.fullSource && value && state.fullSource.indexOf(value) !== -1 && state.giveUpKey === translateKey(state.fullSource)) return;
    clearTimeout(state.assembleTimer);
    state.assembleTimer = setTimeout(function () {
      const token = state.assembleToken + 1;
      state.assembleToken = token;
      assembleDocument(token);
    }, 400);
  }

  async function assembleDocument(token) {
    if (state.assembling) return;
    state.assembling = true;
    try {
      const collected = await readGooglePages();
      if (token !== state.assembleToken) return;
      const full = collected.sources.join("");
      const seen = joinChunks(collected.results);
      if (collected.sources.length < 2 || !seen.trim()) {
        state.assembleAfter = Date.now() + 3000;
        return;
      }
      const key = translateKey(full);
      state.fullSource = full;
      state.fullTranslation = seen;
      state.translateKey = key;
      state.giveUpKey = "";
      schedule();
      const chunks = GTTMarkdown.splitPages(full, pageLimit());
      const lang = languages();
      const translated = [];
      for (let index = 0; index < chunks.length; index += 1) {
        const text = await translateChunk(chunks[index], lang.sl, lang.tl);
        if (token !== state.assembleToken) return;
        if (!text.trim()) return;
        const trailing = (chunks[index].match(/\n+$/) || [""])[0];
        translated.push(trailing && text.slice(-trailing.length) !== trailing ? text.replace(/\s*$/, "") + trailing : text);
      }
      const upgraded = translated.join("");
      if (upgraded.trim().length < seen.trim().length * 0.6) return;
      state.fullTranslation = upgraded;
      state.translateKey = key;
    } finally {
      state.assembling = false;
      if (token !== state.assembleToken) assembleDocument(state.assembleToken);
      else schedule();
    }
  }

  function readResultText(raw) {
    if (!raw) return "";
    const visible = raw.innerText || "";
    if (visible.trim()) return visible;
    const sentences = raw.querySelectorAll(".jCAhz, .ryNqvb");
    if (sentences.length) {
      return Array.prototype.map
        .call(sentences, function (sentence) {
          return sentence.textContent || "";
        })
        .join("");
    }
    return raw.textContent || "";
  }

  function rendererUrl() {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL("src/mermaid-frame.html");
      }
    } catch (error) {
      return "";
    }
    return "";
  }

  function showDiagramCode(slot, code) {
    const pre = document.createElement("pre");
    const inline = document.createElement("code");
    inline.textContent = code || "";
    pre.appendChild(inline);
    slot.appendChild(pre);
  }

  function mountDiagrams(view, diagrams) {
    const url = rendererUrl();
    const slots = view.body.querySelectorAll(".diagram");
    const dark = isDarkPage();
    Array.prototype.forEach.call(slots, function (slot, slotIndex) {
      const diagram = diagrams[Number(slot.getAttribute("data-index"))] || diagrams[slotIndex];
      if (!diagram) return;
      if (!url) {
        showDiagramCode(slot, diagram.fallback || diagram.code);
        return;
      }
      const frame = document.createElement("iframe");
      frame.title = "Diagram";
      frame.setAttribute("scrolling", "no");
      frame.style.width = "100%";
      let drew = false;
      function payload() {
        return {
          type: "gtt-diagram-render",
          code: diagram.code,
          fallback: diagram.fallback || "",
          dark: dark,
        };
      }
      function send() {
        if (!frame.contentWindow) return;
        frame.contentWindow.postMessage(payload(), "*");
      }
      function onMessage(event) {
        if (event.source !== frame.contentWindow || !event.data) return;
        if (event.data.type === "gtt-diagram-ready") send();
        if (event.data.type === "gtt-diagram-size" && event.data.height) {
          drew = true;
          frame.style.height = Math.max(80, Number(event.data.height)) + "px";
          if (view.box) fitResult(view.host, view.box);
        }
        if (event.data.type === "gtt-diagram-error") {
          frame.remove();
          showDiagramCode(slot, diagram.code || diagram.fallback);
          window.removeEventListener("message", onMessage);
        }
      }
      view.listeners.push(onMessage);
      window.addEventListener("message", onMessage);
      frame.addEventListener("load", function () {
        send();
        setTimeout(function () {
          if (!drew && frame.isConnected) send();
        }, 350);
      });
      frame.src = url;
      slot.appendChild(frame);
    });
  }

  function releaseResultBox(box) {
    if (!box) return;
    box.style.minHeight = "";
    box.style.removeProperty("max-height");
    box.style.removeProperty("overflow");
  }

  function fitResult(host, anchor) {
    const needed = Math.ceil(host.getBoundingClientRect().height);
    if (needed < 1) return;
    if (needed > anchor.getBoundingClientRect().height + 2) {
      anchor.style.setProperty("max-height", "none", "important");
      anchor.style.setProperty("overflow", "visible", "important");
    }
    const written = parseFloat(anchor.style.minHeight);
    if (!written || Math.abs(written - needed) > 2) anchor.style.minHeight = needed + "px";
  }

  function showPreview(view, text, anchor, fallbackText) {
    if (view.lastText !== text) {
      try {
        const rendered = GTTMarkdown.renderResult(text, fallbackText || "");
        const fragment = GTTMarkdown.htmlToFragment(document, rendered.html);
        clearDiagrams(view);
        while (view.body.firstChild) view.body.removeChild(view.body.firstChild);
        view.body.appendChild(fragment);
        mountDiagrams(view, rendered.diagrams);
        view.lastText = text;
      } catch (error) {
        view.host.hidden = true;
        return false;
      }
    }
    view.host.dir = anchor.getAttribute("dir") || "auto";
    view.host.lang = anchor.getAttribute("lang") || "";
    view.host.hidden = false;
    place(view.host, anchor);
    fitResult(view.host, anchor);
    return true;
  }

  function update() {
    const textarea = sourceField();
    const box = resultBox();
    const rawResult = box ? box.querySelector(".HwtZe") : null;
    const resultText = readResultText(rawResult);
    const whole = textarea && cachedFull(textarea.value);
    const previewText = whole ? state.fullTranslation : resultText;
    const previewSource = whole ? state.fullSource : (textarea ? textarea.value : "");
    const markdown =
      GTTMarkdown.looksLikeMarkdown(previewText) ||
      GTTMarkdown.looksLikeMarkdown(previewSource) ||
      GTTMarkdown.looksLikeMarkdown(resultText) ||
      GTTMarkdown.looksLikeMarkdown(textarea ? textarea.value : "");

    if (!textarea || !markdown) {
      if (state.result) {
        state.result.host.hidden = true;
        releaseResultBox(state.result.box);
        setRawHidden(rawResult, false);
      }
      hideButtons();
      return;
    }

    const card = sourceCard(textarea);
    ensureButtons(card);
    state.toggle.setAttribute("aria-pressed", state.enabled ? "true" : "false");

    if (!state.enabled) {
      if (state.result) {
        state.result.host.hidden = true;
        releaseResultBox(state.result.box);
        setRawHidden(rawResult, false);
      }
      return;
    }

    scheduleAssemble();

    if (state.assembling && !whole) return;

    if (box && previewText.trim()) {
      const result = ensureResult(box);
      const shown = showPreview(result, previewText, box, previewSource);
      setRawHidden(rawResult, shown);
    } else if (state.result) {
      state.result.host.hidden = true;
      releaseResultBox(state.result.box);
      setRawHidden(rawResult, false);
    }
  }

  function schedule() {
    clearTimeout(state.timer);
    state.timer = setTimeout(function () {
      if (state.scanning) return;
      state.scanning = true;
      try {
        update();
      } finally {
        state.scanning = false;
      }
    }, 40);
  }

  function start() {
    const observer = new MutationObserver(function (mutations) {
      const relevant = mutations.some(function (mutation) {
        const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
        return !(target && target.closest && target.closest(".gtt-md-host, .gtt-md-btn"));
      });
      if (relevant) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const themeObserver = new MutationObserver(schedule);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
    document.addEventListener("scroll", function () { schedule(); }, true);
    window.addEventListener("resize", schedule);
    schedule();
  }

  storageGet(function (cfg) {
    state.enabled = cfg.mdPreviewEnabled !== false;
    watchStorage();
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  });
})();
