(function () {
  let sequence = 0;

  function translateOrigin(origin) {
    return /^https:\/\/translate\.google\./.test(origin || "");
  }

  function diagramHeight(svg) {
    const drawn = svg.getBoundingClientRect().height;
    if (drawn > 24) return drawn;
    const box = svg.viewBox && svg.viewBox.baseVal;
    const height = parseFloat(svg.getAttribute("height"));
    if (height > 24 && String(svg.getAttribute("height")).indexOf("%") === -1) return height;
    if (box && box.height) {
      const width = document.documentElement.clientWidth || box.width || 640;
      return box.height * (width / (box.width || width));
    }
    return 220;
  }

  async function draw(code, dark) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      suppressErrorRendering: true,
      theme: dark ? "dark" : "neutral",
      fontFamily: "Arial, sans-serif",
    });
    sequence += 1;
    const result = await mermaid.render("gttDiagram" + sequence, code);
    const svg = result && result.svg;
    if (!svg || /Syntax error|syntax error|error-icon|error-text/i.test(svg)) throw new Error("diagram");
    const out = document.getElementById("out");
    out.innerHTML = svg;
    const drawn = out.querySelector("svg");
    if (!drawn) throw new Error("diagram");
    drawn.style.maxWidth = "100%";
    drawn.style.height = "auto";
    return drawn;
  }

  window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "gtt-diagram-render") return;
    if (!translateOrigin(event.origin)) return;
    const origin = event.origin;
    const code = String(event.data.code || "");
    const fallback = String(event.data.fallback || "");
    const dark = !!event.data.dark;
    draw(code, dark)
      .catch(function () {
        if (!fallback || fallback === code) throw new Error("diagram");
        return draw(fallback, dark);
      })
      .then(function (svg) {
        requestAnimationFrame(function () {
          const height = Math.ceil(diagramHeight(svg)) + 16;
          window.parent.postMessage({ type: "gtt-diagram-size", height: height }, origin);
        });
      })
      .catch(function () {
        window.parent.postMessage({ type: "gtt-diagram-error" }, origin);
      });
  });

  if (window.parent !== window) window.parent.postMessage({ type: "gtt-diagram-ready" }, "*");
})();
