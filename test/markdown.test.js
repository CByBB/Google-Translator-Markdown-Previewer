const test = require("node:test");
const assert = require("node:assert/strict");
const md = require("../src/markdown.js");

test("renders common markdown", function () {
  const html = md.render("# Hello\n\nThis is **bold** and *italic*.\n\n- one\n- two\n\n`code`");
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<li>one<\/li>/);
  assert.match(html, /<li>two<\/li>/);
  assert.match(html, /<code>code<\/code>/);
});

test("treats a heading without a space as a heading", function () {
  const html = md.render("#こんにちは\n\nこれは**太字**および*斜体*です。\n\n- 1つ\n- 2つ");
  assert.match(html, /<h1>こんにちは<\/h1>/);
  assert.match(html, /<strong>太字<\/strong>/);
  assert.match(html, /<em>斜体<\/em>/);
  assert.match(html, /<li>1つ<\/li>/);
});

test("escapes html and rejects unsafe links", function () {
  const html = md.render('<script>alert(1)</script>\n\n[click](javascript:alert(1))\n\n[ok](https://example.com)');
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(html.includes("javascript:"), false);
  assert.match(html, /href="https:\/\/example\.com"/);
});

test("renders fenced code, quotes, tasks, and tables", function () {
  const html = md.render(
    "> quoted **bold**\n\n- [x] done\n- [ ] todo\n\n```js\nconst n = 1;\n```\n\n| A | B |\n| --- | ---: |\n| 1 | 2 |"
  );
  assert.match(html, /<blockquote>[\s\S]*<strong>bold<\/strong>/);
  assert.match(html, /<input type="checkbox" disabled checked>/);
  assert.match(html, /<pre><code data-lang="js">const n = 1;<\/code><\/pre>/);
  assert.match(html, /<td style="text-align:right">2<\/td>/);
});

test("builds preview nodes without assigning HTML", function () {
  const html = md.render("# Hello\n\nThis is **bold** and *italic*.\n\n- one\n\n[ok](https://example.com)");
  const fragment = md.htmlToFragment(fakeDocument(), html);
  const serialized = serialize(fragment);
  assert.match(serialized, /<h1>Hello<\/h1>/);
  assert.match(serialized, /<strong>bold<\/strong>/);
  assert.match(serialized, /<em>italic<\/em>/);
  assert.match(serialized, /<li>one<\/li>/);
  assert.match(serialized, /href="https:\/\/example.com"/);
  assert.equal(serialized.includes("<script>"), false);
});

function fakeDocument() {
  function Element(tag) {
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.attrs = {};
  }
  Element.prototype.appendChild = function (child) {
    this.childNodes.push(child);
    return child;
  };
  Element.prototype.setAttribute = function (name, value) {
    this.attrs[name] = value;
  };
  return {
    createDocumentFragment: function () {
      return new Element("#document-fragment");
    },
    createElement: function (tag) {
      return new Element(tag);
    },
    createTextNode: function (text) {
      const node = new Element("#text");
      node.textContent = text;
      return node;
    },
  };
}

function serialize(node) {
  if (node.tagName === "#TEXT") return node.textContent;
  if (node.tagName === "#DOCUMENT-FRAGMENT") return node.childNodes.map(serialize).join("");
  const attrs = Object.keys(node.attrs)
    .map(function (name) {
      return node.attrs[name] === "" ? " " + name : ' ' + name + '="' + node.attrs[name] + '"';
    })
    .join("");
  const tag = node.tagName.toLowerCase();
  const inner = node.childNodes.map(serialize).join("");
  if (tag === "br" || tag === "hr" || tag === "img" || tag === "input") return "<" + tag + attrs + ">";
  return "<" + tag + attrs + ">" + inner + "</" + tag + ">";
}

test("renders translated tables and mermaid blocks", function () {
  const source = [
    "| Fruit | Color |",
    "| --- | --- |",
    "| Apple | Red |",
    "",
    "```mermaid",
    "graph TD",
    "  A[Start] --> B{Ready?}",
    "  B -->|Yes| C[Done]",
    "```",
  ].join("\n");
  const translated = [
    "|フルーツ |色 |",
    "| --- | --- |",
    "|アップル |赤 |",
    "",
    "「人魚」",
    "グラフTD",
    " A[開始] --> B{準備はできましたか?}",
    " B -->|はい| C[完了]",
    "「」",
  ].join("\n");
  const loose = "|名前 |役割 |\n| - | - |\n| Ada | 開発 |";
  const missingRule = "|名前 |役割 |\n| Ada | 開発 |";
  const wide = "｜名前｜役割｜\n｜―――｜―――｜\n｜Ada｜開発｜";

  assert.match(md.render(loose), /<td[^>]*>Ada<\/td>/);
  assert.match(md.render(missingRule), /<th[^>]*>名前<\/th>/);
  assert.match(md.render(wide), /<td[^>]*>開発<\/td>/);

  const rendered = md.renderResult(translated, source);
  assert.match(rendered.html, /<th[^>]*>フルーツ<\/th>/);
  assert.match(rendered.html, /<td[^>]*>赤<\/td>/);
  assert.match(rendered.html, /<div class="diagram" data-index="0"><\/div>/);
  assert.match(rendered.diagrams[0].code, /A\[Start\]/);
  assert.equal(rendered.html.includes("グラフTD"), false);
});

test("still draws a chart when translation drops the mermaid fence", function () {
  const source = "Hello\n\n```mermaid\ngraph TD\n  A[Start] --> B[End]\n```";
  const dropped = "こんにちは";
  const unclosed = "「マーメイド」\nグラフ\n A --> B\n\n残りの文";
  const missing = md.renderResult(dropped, source);
  const partial = md.renderResult(unclosed, source);
  assert.match(missing.diagrams[0].code, /A\[Start\] --> B\[End\]/);
  assert.match(missing.html, /data-index="0"/);
  assert.match(partial.diagrams[0].code, /A\[Start\]/);
  assert.match(partial.html, /残りの文/);
  assert.equal(partial.html.includes("グラフ"), false);
});

test("repairs markdown that translation broke", function () {
  const spaced = md.render("＃見出し\n\nこれは** 太字 **および* 斜体 *です。\n\n-項目\n1．二つ\n\n＞引用\n\n` コード `\n\n- [ x ] 完了\n\n［例］（https://example.com）");
  assert.match(spaced, /<h1>見出し<\/h1>/);
  assert.match(spaced, /<strong>太字<\/strong>/);
  assert.match(spaced, /<em>斜体<\/em>/);
  assert.match(spaced, /<li>項目<\/li>/);
  assert.match(spaced, /<li>二つ<\/li>/);
  assert.match(spaced, /<blockquote>[\s\S]*引用/);
  assert.match(spaced, /<code>コード<\/code>/);
  assert.match(spaced, /<input type="checkbox" disabled checked>/);
  assert.match(spaced, /href="https:\/\/example.com"/);

  const source = "# Title\n\n- one\n- two\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst n = 1;\n```";
  const broken = "タイトル\n\nいち\nに\n\nA\nB\n1\n2\n\nconst n = 1;";
  const repaired = md.renderResult(broken, source);
  assert.match(repaired.html, /<h1>タイトル<\/h1>/);
  assert.match(repaired.html, /<li>いち<\/li>/);
  assert.match(repaired.html, /<li>に<\/li>/);
  assert.match(repaired.html, /<th[^>]*>A<\/th>/);
  assert.match(repaired.html, /<td[^>]*>2<\/td>/);
  assert.match(repaired.html, /<pre><code data-lang="js">const n = 1;<\/code><\/pre>/);
});

test("detects markdown and ignores plain prose", function () {
  assert.equal(md.looksLikeMarkdown("Hello there.\nThis is a sentence."), false);
  assert.equal(md.looksLikeMarkdown("# Title"), true);
  assert.equal(md.looksLikeMarkdown("**bold**"), true);
  assert.equal(md.looksLikeMarkdown("- item"), true);
  assert.equal(md.looksLikeMarkdown(""), false);
});

test("splits long text on paragraphs and sentences", function () {
  const paragraph = "This sentence stays whole. This sentence also stays whole.\n\n";
  let text = "# Notes\n\n";
  while (text.length < 180) text += paragraph;
  text += "Closing line.\n";
  const pages = md.splitPages(text, 80);
  assert.ok(pages.length > 1);
  assert.ok(pages.every(function (page) { return page.length <= 80; }));
  assert.equal(pages.join(""), text);
  pages.slice(1).forEach(function (page) {
    assert.equal(/^[a-z]/.test(page), false);
  });
});

test("keeps a fenced diagram together until it needs its own page", function () {
  const intro = "Intro paragraph before the diagram.\n\n";
  const fence = "```mermaid\ngraph TD\n  A[Start] --> B[Next]\n```\n\n";
  const after = "After the diagram.\n";
  const pages = md.splitPages(intro + fence + after, fence.length);
  assert.equal(pages.join(""), intro + fence + after);
  assert.ok(pages.some(function (page) { return page.startsWith("```mermaid"); }));
  assert.equal(pages.some(function (page) { return page.includes("A[Start]") && !page.includes("```"); }), false);
});

test("wraps an oversized fence and repeats a split table header", function () {
  const fence = "```js\n" + "const value = 1;\n".repeat(6) + "```\n";
  const fencePages = md.splitPages(fence, 36);
  assert.ok(fencePages.length > 1);
  assert.ok(fencePages.every(function (page) { return page.length <= 36; }));
  fencePages.forEach(function (page) {
    assert.match(page.trim(), /^```js/);
    assert.match(page.trim(), /```$/);
  });

  const table = "| Fruit | Color |\n| --- | --- |\n| Apple | Red |\n| Banana | Yellow |\n| Cherry | Pink |\n";
  const tablePages = md.splitPages(table, 52);
  assert.ok(tablePages.length > 1);
  assert.ok(tablePages.every(function (page) { return page.length <= 52; }));
  tablePages.slice(1).forEach(function (page) {
    assert.match(page, /^\| Fruit \| Color \|/);
  });
});

test("keeps arrow table rows out of mermaid diagrams", function () {
  const fs = require("fs");
  const text = fs.readFileSync(require("path").join(__dirname, "stack-sample.md"), "utf8");
  const rendered = md.renderResult(text, text);
  assert.equal(rendered.diagrams.length, 2);
  rendered.diagrams.forEach(function (diagram) {
    assert.match(diagram.code, /^flowchart LR/);
  });
  assert.match(rendered.html, /<h1>STACK — TypeScript/);
  assert.match(rendered.html, /<td[^>]*>OpenAI-compatible client/);
  assert.match(rendered.html, /zod-to-json-schema/);
  assert.equal((rendered.html.match(/<table/g) || []).length, 9);
  const pages = md.splitPages(text);
  assert.ok(pages.length > 1);
  assert.equal(pages.join(""), text.replace(/\r\n/g, "\n"));
  assert.ok(pages.every(function (page) { return page.length <= md.pageLimit; }));
  assert.match(pages[1], /^### /);
});

test("moves a heading onto the following page", function () {
  const filler = "A".repeat(30) + "\n\n";
  const heading = "# Title\n\n";
  const body = "Body stays with the heading.\n";
  const text = filler + heading + body;
  const limit = 50;
  const pages = md.splitPages(text, limit);
  assert.equal(pages[0], filler);
  assert.ok(pages[1].startsWith("# Title"));
  assert.ok(pages[1].includes("Body stays with the heading"));
  assert.ok(pages.every(function (page) { return page.length <= limit; }));
});
