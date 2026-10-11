(function () {
  function pieces(data) {
    const rows = data && data[0];
    if (!Array.isArray(rows)) return "";
    return rows.map(function (row) {
      return row && row[0] ? row[0] : "";
    }).join("");
  }

  function reply(id, text) {
    const payload = { type: "gtt-translate-result", id: id, text: text || "" };
    window.postMessage(payload, "*");
    document.dispatchEvent(new CustomEvent("gtt-translate-result", { detail: payload }));
  }

  function requestOf(event) {
    if (event.data && event.data.type === "gtt-translate-request") return event.data;
    if (event.detail && event.detail.text != null && event.detail.id) return event.detail;
    return null;
  }

  const pending = {};

  function onRequest(event) {
    const payload = requestOf(event);
    if (!payload || typeof payload.id !== "string" || typeof payload.text !== "string" || pending[payload.id]) return;
    pending[payload.id] = true;
    const sl = typeof payload.sl === "string" && payload.sl ? payload.sl : "auto";
    const tl = typeof payload.tl === "string" && payload.tl ? payload.tl : "en";
    const url = "https://translate.google.com/translate_a/single?client=gtx&sl=" + encodeURIComponent(sl) + "&tl=" + encodeURIComponent(tl) + "&dt=t";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: "q=" + encodeURIComponent(payload.text),
    }).then(function (response) {
      return response.json();
    }).then(function (data) {
      reply(payload.id, pieces(data));
    }).catch(function () {
      reply(payload.id, "");
    });
  }

  window.addEventListener("message", onRequest);
  document.addEventListener("gtt-translate-request", onRequest);
})();
