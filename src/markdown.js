(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.GTTMarkdown = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char];
    });
  }

  function decodeEntities(value) {
    return String(value)
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function looksLikeMarkdown(text) {
    if (!text || !String(text).trim()) return false;
    const source = String(text).replace(/\u00a0/g, " ");
    return (
      /(^|\n)\s{0,3}[#＃]{1,6}(?![#＃])\s*\S/.test(source) ||
      /(^|\n)\s{0,3}&gt;\s*\S/.test(source) ||
      /(^|\n)\s{0,3}>\s*\S/.test(source) ||
      /(^|\n)\s{0,3}(?:[-*+・]|\d+\.)\s+\S/.test(source) ||
      /(^|\n)\s{0,3}(?:---|\*\*\*|___)\s*$/.test(source) ||
      /```/.test(source) ||
      /`[^`\n]+`/.test(source) ||
      /\*\*[^*\n]+\*\*/.test(source) ||
      /~~[^~\n]+~~/.test(source) ||
      /\[[^\]\n]+\]\([^)\s]+\)/.test(source) ||
      /!\[[^\]]*\]\([^)\s]+\)/.test(source) ||
      /(^|\n)\s*\|?.+\|.+\|?\s*\n\s*\|?\s*:?-+/.test(source) ||
      /```[ \t]*(?:mermaid|人魚)\b/i.test(source) ||
      /「\s*人魚\s*」/.test(source) ||
      /(^|\n)\s*(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|journey|gitGraph)\b/.test(source) ||
      /(^|\n)\s*(?:グラフ|フローチャート)\s*(?:TB|TD|BT|RL|LR)\b/.test(source)
    );
  }

  function safeUrl(raw) {
    const decoded = decodeEntities(raw).trim();
    if (!/^(https?:\/\/|mailto:)/i.test(decoded)) return "";
    if (/[\s<>]/.test(decoded)) return "";
    return escapeHtml(decoded);
  }

  function renderInline(escaped) {
    const codes = [];
    let text = escaped.replace(/`([^`\n]+)`/g, function (_, code) {
      const index = codes.length;
      codes.push("<code>" + code + "</code>");
      return "\u0001" + index + "\u0001";
    });

    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, url) {
      const href = safeUrl(url);
      if (!href) return alt;
      return (
        '<img alt="' +
        alt +
        '" src="' +
        href +
        '" referrerpolicy="no-referrer">'
      );
    });

    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, url) {
      const href = safeUrl(url);
      if (!href) return label;
      return (
        '<a href="' +
        href +
        '" target="_blank" rel="noopener noreferrer">' +
        label +
        "</a>"
      );
    });

    text = text.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, function (_, url) {
      const href = safeUrl(url);
      if (!href) return "&lt;" + url + "&gt;";
      return (
        '<a href="' +
        href +
        '" target="_blank" rel="noopener noreferrer">' +
        href +
        "</a>"
      );
    });

    text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    text = text.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    text = text.replace(
      /(^|[^A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/g,
      "$1<em>$2</em>"
    );

    return text.replace(/\u0001(\d+)\u0001/g, function (_, index) {
      return codes[Number(index)] || "";
    });
  }

  function splitRow(line) {
    let value = line.trim();
    if (value.startsWith("|")) value = value.slice(1);
    if (value.endsWith("|")) value = value.slice(0, -1);
    return value.split("|").map(function (cell) {
      return cell.trim();
    });
  }

  function isDashCell(cell) {
    return /^:?-+:?$/.test(String(cell).replace(/\s/g, ""));
  }

  function isSeparator(line) {
    if (line.indexOf("|") === -1) return false;
    const meaningful = splitRow(line).filter(function (cell) {
      return cell.trim();
    });
    return meaningful.length > 0 && meaningful.every(isDashCell);
  }

  function isPipeRow(line) {
    if (!line || line.indexOf("|") === -1 || /-->|<--|==>|-\.->/.test(line)) return false;
    const trimmed = line.trim();
    const wrapped = trimmed.charAt(0) === "|" && trimmed.charAt(trimmed.length - 1) === "|";
    const cells = splitRow(line).filter(function (cell) {
      return cell.trim();
    });
    return cells.length >= 2 || (wrapped && cells.length >= 1);
  }

  function canStartTable(lines, index) {
    const line = lines[index];
    if (!line || line.indexOf("|") === -1 || isSeparator(line) || index + 1 >= lines.length) return false;
    const next = lines[index + 1];
    if (isSeparator(next)) return true;
    if (isRule(next) && index + 2 < lines.length && isPipeRow(lines[index + 2])) return true;
    if (!isPipeRow(line) || !isPipeRow(next) || isSeparator(next)) return false;
    const columns = splitRow(line).length;
    return columns >= 2 && Math.abs(columns - splitRow(next).length) <= 1;
  }

  function columnAlign(cell) {
    const value = cell.trim();
    const left = value.startsWith(":");
    const right = value.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  }

  function isFenceLine(line) {
    return /^\u0000F\d+\u0000$/.test(line.trim());
  }

  function isHeading(line) {
    return /^(#{1,6})(?!#)\s*\S/.test(line);
  }

  function isRule(line) {
    return /^(?:---|\*\*\*|___)\s*$/.test(line.trim());
  }

  function isQuote(line) {
    return /^&gt;(\s|\S|$)/.test(line);
  }

  function isList(line) {
    return /^(\s*)(?:[-*+・]|\d+\.)\s+\S/.test(line);
  }

  function renderBlocks(text, fences) {
    const lines = text.split("\n");
    const html = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      const diagram = line.trim().match(/^\u0000D(\d+)\u0000$/);
      if (diagram) {
        html.push('<div class="diagram" data-index="' + diagram[1] + '"></div>');
        index += 1;
        continue;
      }

      const fence = line.trim().match(/^\u0000F(\d+)\u0000$/);
      if (fence) {
        html.push(fences[Number(fence[1])] || "");
        index += 1;
        continue;
      }

      if (isHeading(line)) {
        const match = line.match(/^(#{1,6})(?!#)\s*(.*?)\s*#*\s*$/);
        const level = match[1].length;
        html.push("<h" + level + ">" + renderInline(match[2]) + "</h" + level + ">");
        index += 1;
        continue;
      }

      if (isRule(line)) {
        html.push("<hr>");
        index += 1;
        continue;
      }

      if (isQuote(line)) {
        const quoted = [];
        while (index < lines.length && (isQuote(lines[index]) || !lines[index].trim())) {
          if (!lines[index].trim()) {
            quoted.push("");
          } else {
            quoted.push(lines[index].replace(/^&gt;\s?/, ""));
          }
          index += 1;
        }
        html.push("<blockquote>" + renderBlocks(quoted.join("\n"), fences) + "</blockquote>");
        continue;
      }

      if (canStartTable(lines, index)) {
        const header = splitRow(line);
        let cursor = index + 1;
        let aligns = header.map(function () {
          return "left";
        });
        if (isSeparator(lines[cursor])) {
          aligns = splitRow(lines[cursor]).map(columnAlign);
          cursor += 1;
        } else if (isRule(lines[cursor])) {
          cursor += 1;
        }
        const body = [];
        while (cursor < lines.length && lines[cursor].trim() && isPipeRow(lines[cursor]) && !isSeparator(lines[cursor])) {
          body.push(splitRow(lines[cursor]));
          cursor += 1;
        }
        index = cursor;
        const headHtml = header
          .map(function (cell, cellIndex) {
            return '<th style="text-align:' + (aligns[cellIndex] || "left") + '">' + renderInline(cell) + "</th>";
          })
          .join("");
        const bodyHtml = body
          .map(function (row) {
            return (
              "<tr>" +
              row
                .map(function (cell, cellIndex) {
                  return '<td style="text-align:' + (aligns[cellIndex] || "left") + '">' + renderInline(cell) + "</td>";
                })
                .join("") +
              "</tr>"
            );
          })
          .join("");
        html.push("<table><thead><tr>" + headHtml + "</tr></thead><tbody>" + bodyHtml + "</tbody></table>");
        continue;
      }

      if (isList(line)) {
        const ordered = /^\s*\d+\.\s+/.test(line);
        const items = [];
        while (index < lines.length) {
          const match = lines[index].match(/^(\s*)(?:[-*+・]|\d+\.)\s+(.*)$/);
          if (!match) {
            if (items.length && /^\s+\S/.test(lines[index])) {
              items[items.length - 1].body.push(lines[index].trim());
              index += 1;
              continue;
            }
            break;
          }
          items.push({ body: [match[2]] });
          index += 1;
        }
        const itemHtml = items
          .map(function (item) {
            const task = item.body[0].match(/^\[([ xX])\]\s+(.*)$/);
            if (task) {
              const checked = task[1].toLowerCase() === "x" ? " checked" : "";
              const rest = [task[2]].concat(item.body.slice(1)).map(renderInline).join("<br>");
              return '<li class="task"><input type="checkbox" disabled' + checked + "> " + rest + "</li>";
            }
            return "<li>" + item.body.map(renderInline).join("<br>") + "</li>";
          })
          .join("");
        html.push(ordered ? "<ol>" + itemHtml + "</ol>" : "<ul>" + itemHtml + "</ul>");
        continue;
      }

      const paragraph = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !isFenceLine(lines[index]) &&
        !isHeading(lines[index]) &&
        !isRule(lines[index]) &&
        !isQuote(lines[index]) &&
        !isList(lines[index]) &&
        !/^\u0000D\d+\u0000$/.test(lines[index].trim()) &&
        !canStartTable(lines, index)
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      if (paragraph.length) {
        html.push("<p>" + paragraph.map(renderInline).join("<br>") + "</p>");
      }
    }

    return html.join("");
  }

  function normalizeDashes(line) {
    return line.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE63\uFF0D]/g, "-");
  }

  function isDashOnlyLine(line) {
    const cells = line.indexOf("|") === -1 ? [line] : splitRow(line);
    const filled = cells.filter(function (cell) { return cell.trim(); });
    return filled.length > 0 && filled.every(function (cell) {
      return /^[:\s\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE63\uFF0D-]+$/.test(cell);
    });
  }

  function normalize(source) {
    return String(source == null ? "" : source)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\u3000/g, " ")
      .replace(/\uFF5C/g, "|")
      .split("\n")
      .map(function (line) {
        return isDashOnlyLine(line) ? normalizeDashes(line) : line;
      })
      .join("\n");
  }

  function isBareDiagramStart(line) {
    return /^\s*(?:graph\s+(?:TB|TD|BT|RL|LR)|flowchart\s+(?:TB|TD|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|mindmap|timeline|journey|gitGraph|C4Context|block-beta|グラフ(?:\s*(?:TB|TD|BT|RL|LR|上から下|トップダウン|左から右))?|フローチャート(?:\s*(?:TB|TD|BT|RL|LR))?)\b/i.test(line);
  }

  function isWrappedTableLine(line) {
    const trimmed = String(line || "").trim();
    if (!(trimmed.charAt(0) === "|" && trimmed.charAt(trimmed.length - 1) === "|")) return false;
    return splitRow(trimmed).filter(function (cell) { return cell.trim(); }).length >= 2;
  }

  function looksLikeDiagramLine(line) {
    if (isPipeRow(line) || isSeparator(line) || isWrappedTableLine(line)) return false;
    return /-->|<--|==>|→|←|グラフ|フローチャート|subgraph|sequenceDiagram|classDiagram|participant\b|^\s*graph\b|^\s*flowchart\b|^\s*[A-Za-z0-9_]+[\[{（［{]/.test(line);
  }

  function looksLikeDiagramBody(code) {
    const lines = String(code).split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
    if (!lines.length) return false;
    if (isBareDiagramStart(lines[0])) return true;
    const arrows = lines.filter(function (line) { return /-->|<--|==>|→|←/.test(line); }).length;
    return arrows >= 2 || (arrows >= 1 && /グラフ|graph|flowchart|subgraph|participant|sequenceDiagram/i.test(code));
  }

  function isDiagramLanguage(lang, code) {
    const name = String(lang || "").trim().toLowerCase();
    if (/^(?:js|javascript|ts|typescript|json|html|css|py|python|sh|bash|sql|text|txt|xml|yaml|yml)$/.test(name)) {
      return false;
    }
    if (/^(?:mermaid|人魚|マーメイド|人魚図)$/i.test(name)) return true;
    return isBareDiagramStart(code) || looksLikeDiagramBody(code);
  }

  function repairDiagram(code) {
    const lines = String(code).replace(/^\n+|\n+$/g, "").split("\n");
    if (!lines.length) return "";
    lines[0] = lines[0]
      .replace(/^\s*グラフ\s*(?:上から下|トップダウン)\b/i, "graph TD")
      .replace(/^\s*グラフ\s*左から右\b/i, "graph LR")
      .replace(/^\s*グラフ\s*(TB|TD|BT|RL|LR)\b/i, "graph $1")
      .replace(/^\s*グラフ\s*$/i, "graph TD")
      .replace(/^\s*フローチャート\s*(TB|TD|BT|RL|LR)\b/i, "flowchart $1")
      .replace(/^\s*フローチャート\s*$/i, "flowchart TD")
      .replace(/^\s*シーケンス図\b/, "sequenceDiagram")
      .replace(/^\s*クラス図\b/, "classDiagram")
      .replace(/^\s*状態図(?:-v2)?\b/, "stateDiagram-v2")
      .replace(/^\s*(?:ER図|エル図)\b/i, "erDiagram")
      .replace(/^\s*ガント図?\b/, "gantt")
      .replace(/^\s*円グラフ\b/, "pie")
      .replace(/^\s*マインドマップ\b/, "mindmap")
      .replace(/^\s*タイムライン\b/, "timeline")
      .replace(/^\s*(?:ユーザージャーニー|ジャーニー)\b/, "journey")
      .replace(/^\s*gitグラフ\b/i, "gitGraph");
    return lines
      .join("\n")
      .replace(/→/g, "-->")
      .replace(/←/g, "<--")
      .replace(/－>/g, "-->")
      .replace(/-\s+>/g, "-->")
      .replace(/<\s+-/g, "<--")
      .replace(/［/g, "[")
      .replace(/］/g, "]")
      .replace(/｛/g, "{")
      .replace(/｝/g, "}")
      .trim();
  }

  function isDiagramOpen(line) {
    const trimmed = line.trim();
    return /^```[ \t]*(?:mermaid|人魚|マーメイド|人魚図)\b/i.test(trimmed) ||
      /^「[ \t]*(?:人魚|マーメイド|人魚図|mermaid)[ \t]*」/i.test(trimmed) ||
      /^(?:人魚|マーメイド|人魚図)$/i.test(trimmed);
  }

  function isDiagramClose(line) {
    const trimmed = line.trim();
    return trimmed === "```" || /^「[ \t]*」$/.test(trimmed);
  }

  function collectDiagram(lines, start) {
    const body = [];
    let index = start + 1;
    while (index < lines.length) {
      if (isDiagramClose(lines[index]) || /^```/.test(lines[index].trim())) {
        index += 1;
        break;
      }
      const trimmed = lines[index].trim();
      if (!trimmed) {
        if (index + 1 < lines.length && (looksLikeDiagramLine(lines[index + 1]) || isBareDiagramStart(lines[index + 1]))) {
          body.push(lines[index]);
          index += 1;
          continue;
        }
        break;
      }
      if (!looksLikeDiagramLine(trimmed) && !isBareDiagramStart(trimmed)) break;
      body.push(lines[index]);
      index += 1;
    }
    return { body: body, next: index };
  }

  function absorbDiagrams(text) {
    let source = text.replace(/```[ \t]*(?:人魚|マーメイド|人魚図)[ \t]*\n/gi, "```mermaid\n");
    const lines = source.split("\n");
    const out = [];
    let index = 0;
    let fenced = false;
    while (index < lines.length) {
      const trimmed = lines[index].trim();
      if (/^```/.test(trimmed)) {
        fenced = !fenced;
        out.push(lines[index]);
        index += 1;
        continue;
      }
      if (!fenced && (isDiagramOpen(lines[index]) || isBareDiagramStart(lines[index]))) {
        const found = collectDiagram(lines, index);
        if (found.body.length || isBareDiagramStart(lines[index])) {
          const body = isDiagramOpen(lines[index]) && !isBareDiagramStart(lines[index]) ? found.body : [lines[index]].concat(found.body);
          if (body.join("\n").trim()) {
            out.push("```mermaid");
            out.push(body.join("\n"));
            out.push("```");
            index = found.next;
            continue;
          }
        }
      }
      if (!fenced && looksLikeDiagramLine(lines[index])) {
        const body = [lines[index]];
        let cursor = index + 1;
        while (cursor < lines.length && lines[cursor].trim() && looksLikeDiagramLine(lines[cursor])) {
          body.push(lines[cursor]);
          cursor += 1;
        }
        if (body.length >= 2 || isBareDiagramStart(lines[index])) {
          out.push("```mermaid");
          out.push(body.join("\n"));
          out.push("```");
          index = cursor;
          continue;
        }
      }
      out.push(lines[index]);
      index += 1;
    }
    return out.join("\n");
  }

  function takeDiagrams(text, originals) {
    const diagrams = [];
    function claim(full, lang, code) {
      if (!isDiagramLanguage(lang, code)) return full;
      const index = diagrams.length;
      const translated = repairDiagram(code);
      const original = originals[index] || "";
      diagrams.push({
        code: original || translated,
        fallback: original ? translated : "",
      });
      return "\n\u0000D" + index + "\u0000\n";
    }
    const closed = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, claim);
    return { text: closed.replace(/```([^\n`]*)\n([\s\S]*)$/g, claim), diagrams: diagrams };
  }

  function stashCodeFences(text) {
    const fences = [];
    let source = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, function (_, lang, code) {
      const index = fences.length;
      const language = /^[\w.+-]+$/.test(lang.trim()) ? ' data-lang="' + lang.trim() + '"' : "";
      fences.push("<pre><code" + language + ">" + code.replace(/\n$/, "") + "</code></pre>");
      return "\n\u0000F" + index + "\u0000\n";
    });
    source = source.replace(/```([^\n`]*)\n([\s\S]*)$/g, function (_, lang, code) {
      const index = fences.length;
      const language = /^[\w.+-]+$/.test(lang.trim()) ? ' data-lang="' + lang.trim() + '"' : "";
      fences.push("<pre><code" + language + ">" + code.replace(/\n$/, "") + "</code></pre>");
      return "\n\u0000F" + index + "\u0000\n";
    });
    return { text: source, fences: fences };
  }

  function normalizeFenceLine(line) {
    const trimmed = line.trim().replace(/｀/g, "`");
    const match = trimmed.match(/^(`{3,})\s*([^`]*)\s*$/);
    if (!match) return line;
    const lang = match[2].trim();
    return lang ? "```" + lang : "```";
  }

  function repairLine(line) {
    let value = line.replace(/^(\s*)(＃{1,6})(?!＃)/, function (_, space, hashes) {
      return space + hashes.replace(/＃/g, "#");
    });
    value = value.replace(/^(\s{0,3})＞/, "$1>");
    value = value.replace(/^(\s{0,3})>(?=\S)/, "$1> ");
    value = value.replace(/^(\s*)(\d+)\s*[.．。]\s*/, "$1$2. ");
    if (!/^\s*([-*_])\1{2,}\s*$/.test(value)) {
      value = value.replace(/^(\s*)([-+・])(?=\S)/, "$1$2 ");
    }
    value = value.replace(/^(\s*(?:[-+・*]|\d+\.)\s*)\[\s*([xX×✓✔ｘＸ])\s*\]/, "$1[x]");
    value = value.replace(/^(\s*(?:[-+・*]|\d+\.)\s*)\[\s*\]/, "$1[ ]");
    value = value.replace(/^(\s*(?:[-+・*]|\d+\.)\s*)【\s*([xX×✓✔ｘＸ\s])\s*】/, function (_, prefix, mark) {
      return prefix + (/\S/.test(mark) && mark.trim() !== "" ? "[x]" : "[ ]");
    });
    return value;
  }

  function repairInline(text) {
    let value = text.replace(/｀/g, "`").replace(/＊/g, "*").replace(/＿/g, "_");
    value = value.replace(/[～〜]{2}/g, "~~");
    value = value.replace(/\*\s+\*\s*([^*\n]*?\S)\s*\*\s+\*/g, "**$1**");
    value = value.replace(/\*\s+\*\s*([^*\n]*?\S)\s*\*\*/g, "**$1**");
    value = value.replace(/\*\*\s*([^*\n]*?\S)\s*\*\s+\*/g, "**$1**");
    value = value.replace(/\*\*\s*([^*\n]*?\S)\s*\*\*/g, "**$1**");
    value = value.replace(/(^|[^*\n])\*\s*([^*\n]*?\S)\s*\*(?!\*)/g, "$1*$2*");
    value = value.replace(/__\s*([^_\n]*?\S)\s*__/g, "__$1__");
    value = value.replace(/~~\s*([^~\n]*?\S)\s*~~/g, "~~$1~~");
    value = value.replace(/`\s*([^`\n]*?\S)\s*`/g, "`$1`");
    value = value.replace(/\]\s+\(/g, "](");
    value = value.replace(/https?\s*：\s*\/\//gi, function (url) {
      return url.replace(/\s/g, "").replace("：", ":");
    });
    value = value.replace(/［([^］\n]+)］\s*[（(]\s*(https?:\/\/[^）)\s]+)\s*[）)]/g, "[$1]($2)");
    return value;
  }

  function repairSyntax(text) {
    const masked = [];
    const fenced = text
      .split("\n")
      .map(function (line) {
        if (/^[ \t]*[｀`][ \t｀`]{2,}[ \t]*[^`｀]*$/.test(line)) return normalizeFenceLine(line);
        return line;
      })
      .join("\n")
      .replace(/```[^\n]*\n[\s\S]*?```/g, function (block) {
        const index = masked.length;
        masked.push(block);
        return "\u0000C" + index + "\u0000";
      });
    const repaired = repairInline(
      fenced
        .split("\n")
        .map(function (line) {
          if (/^\u0000C\d+\u0000$/.test(line.trim())) return line;
          return repairLine(line);
        })
        .join("\n")
    );
    return repaired.replace(/\u0000C(\d+)\u0000/g, function (_, index) {
      return masked[Number(index)] || "";
    });
  }

  function splitBlocks(text) {
    const lines = String(text || "").split("\n");
    const blocks = [];
    let current = [];
    let fenced = false;
    function flush() {
      if (!current.length) return;
      blocks.push(current.join("\n").replace(/^\n+|\n+$/g, ""));
      current = [];
    }
    for (let index = 0; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      if (/^```/.test(trimmed)) {
        if (!fenced) {
          flush();
          fenced = true;
          current.push(lines[index]);
        } else {
          current.push(lines[index]);
          fenced = false;
          flush();
        }
        continue;
      }
      if (fenced) {
        current.push(lines[index]);
        continue;
      }
      if (!trimmed) {
        flush();
        continue;
      }
      current.push(lines[index]);
    }
    flush();
    return blocks;
  }

  function blockKind(block) {
    const lines = block.split("\n");
    const first = lines[0].trim();
    if (/^```/.test(first)) return "fence";
    if (/^#{1,6}(?!#)\s*\S/.test(first) && lines.length === 1) return "heading";
    if (lines.every(function (line) { return !line.trim() || /^>/.test(line.trim()); })) return "quote";
    if (lines.filter(function (line) { return line.indexOf("|") !== -1; }).length >= 2 && lines.some(function (line) { return isPipeRow(line) || isSeparator(line); })) {
      return "table";
    }
    if (lines.every(function (line) { return !line.trim() || isList(line) || /^\s+\S/.test(line); })) return "list";
    return "paragraph";
  }

  function tableColumns(block) {
    const lines = block.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
    const header = lines.filter(function (line) { return line.indexOf("|") !== -1 && !isSeparator(line); })[0] || lines[0] || "";
    const cells = splitRow(header).filter(function (cell) { return cell.trim(); });
    return cells.length || 0;
  }

  function ensureTable(source, result) {
    const content = result.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
    if (content.length >= 2 && content[0].indexOf("|") !== -1 && isSeparator(content[1])) return result.trim();
    const columns = tableColumns(source);
    if (columns < 2) return result;
    const separator = "| " + new Array(columns).fill("---").join(" | ") + " |";
    if (content.length >= 2 && content.every(function (line) { return line.indexOf("|") !== -1; }) && !content.some(isSeparator)) {
      return [content[0], separator].concat(content.slice(1)).join("\n");
    }
    if (content.some(function (line) { return line.indexOf("|") !== -1; })) return result;
    if (content.length < columns || content.length % columns !== 0) return result;
    const rows = [];
    for (let index = 0; index < content.length; index += columns) {
      rows.push("| " + content.slice(index, index + columns).join(" | ") + " |");
    }
    return [rows[0], separator].concat(rows.slice(1)).join("\n");
  }

  function reshapeList(source, result) {
    const sourceLines = source.split("\n");
    const resultLines = result.split("\n");
    if (sourceLines.length === resultLines.length) {
      return sourceLines.map(function (src, index) {
        const line = resultLines[index];
        if (!src.trim() || isList(line)) return line;
        const marker = src.match(/^(\s*)(\d+\.|[-*+・])\s+/);
        if (!marker) return line;
        const bullet = marker[2] === "・" ? "-" : marker[2];
        return marker[1] + bullet + " " + line.trim();
      }).join("\n");
    }
    const ordered = /^\s*\d+\./.test(source);
    let number = 1;
    return resultLines.map(function (line) {
      if (!line.trim() || isList(line)) return line;
      if (ordered) {
        number += 1;
        return (number - 1) + ". " + line.trim();
      }
      return "- " + line.trim();
    }).join("\n");
  }

  function reshapeBlock(source, result) {
    const kind = blockKind(source);
    if (kind === "heading") {
      if (/^#{1,6}(?!#)/.test(result.trim())) return result.trim();
      const level = source.match(/^\s*(#{1,6})/);
      return (level ? level[1] : "#") + " " + result.trim();
    }
    if (kind === "quote") {
      return result.split("\n").map(function (line) {
        if (!line.trim() || /^>/.test(line.trim())) return line;
        return "> " + line.trim();
      }).join("\n");
    }
    if (kind === "list") return reshapeList(source, result);
    if (kind === "table") return ensureTable(source, result);
    if (kind === "fence") {
      if (/^```/.test(result.trim()) || /^「\s*(?:人魚|マーメイド|人魚図|mermaid)\s*」/i.test(result.trim())) return result.trim();
      const lang = (source.match(/^```[ \t]*(\S*)/) || ["", ""])[1];
      const diagram = /^mermaid$/i.test(lang);
      if (diagram && !looksLikeDiagramBody(result) && !isDiagramOpen(result.trim().split("\n")[0] || "")) return result;
      return "```" + lang + "\n" + result.trim() + "\n```";
    }
    return result;
  }

  function repairTranslatedMarkdown(translated, original) {
    const syntax = repairSyntax(translated);
    if (!original || !String(original).trim()) return syntax;
    const sourceBlocks = splitBlocks(original);
    const resultBlocks = splitBlocks(syntax);
    if (!sourceBlocks.length || sourceBlocks.length !== resultBlocks.length) return syntax;
    return sourceBlocks.map(function (block, index) {
      return reshapeBlock(block, resultBlocks[index]);
    }).join("\n\n");
  }

  function renderResult(source, fallbackSource) {
    const original = normalize(fallbackSource || "");
    const originals = takeDiagrams(absorbDiagrams(original), []).diagrams.map(function (diagram) {
      return diagram.code;
    });
    const prepared = absorbDiagrams(repairTranslatedMarkdown(normalize(source), original));
    const taken = takeDiagrams(prepared, originals);
    originals.forEach(function (code, index) {
      if (!code) return;
      if (index < taken.diagrams.length) {
        taken.diagrams[index].fallback = taken.diagrams[index].code === code ? "" : taken.diagrams[index].code;
        taken.diagrams[index].code = code;
        return;
      }
      taken.diagrams.push({ code: code, fallback: "" });
      taken.text += "\n\u0000D" + index + "\u0000\n";
    });
    const stashed = stashCodeFences(escapeHtml(taken.text));
    return {
      html: renderBlocks(stashed.text, stashed.fences),
      diagrams: taken.diagrams,
    };
  }

  var PAGE_LIMIT = 5000;

  function isFenceOpen(line) {
    return /^[ \t]{0,3}(?:```+|~~~+)/.test(line);
  }

  function isFenceClose(line) {
    return /^[ \t]{0,3}(?:```+|~~~+)\s*$/.test(line);
  }

  function lineStarts(source) {
    const lines = source.split("\n");
    const starts = new Array(lines.length + 1);
    starts[0] = 0;
    for (let index = 0; index < lines.length; index += 1) {
      starts[index + 1] = starts[index] + lines[index].length + (index + 1 < lines.length ? 1 : 0);
    }
    return { lines: lines, starts: starts };
  }

  function sliceBlocks(source) {
    const mapped = lineStarts(source);
    const lines = mapped.lines;
    const blocks = [];
    let index = 0;
    while (index < lines.length) {
      const start = index;
      let kind = "text";
      if (isFenceOpen(lines[index])) {
        kind = "fence";
        index += 1;
        while (index < lines.length && !isFenceClose(lines[index])) index += 1;
        if (index < lines.length) index += 1;
      } else if (canStartTable(lines, index)) {
        kind = "table";
        index += 1;
        while (index < lines.length && (isPipeRow(lines[index]) || isSeparator(lines[index]))) index += 1;
      } else if (!lines[index].trim()) {
        kind = "blank";
        while (index < lines.length && !lines[index].trim()) index += 1;
      } else {
        while (
          index < lines.length &&
          lines[index].trim() &&
          !isFenceOpen(lines[index]) &&
          !canStartTable(lines, index)
        ) {
          index += 1;
        }
      }
      if (kind !== "blank") {
        while (index < lines.length && !lines[index].trim()) index += 1;
      }
      blocks.push({
        kind: kind,
        text: source.slice(mapped.starts[start], index >= lines.length ? source.length : mapped.starts[index]),
      });
    }
    return blocks;
  }

  function safeCut(text, index) {
    if (index <= 0 || index >= text.length) return index;
    const code = text.charCodeAt(index - 1);
    if (code >= 0xd800 && code <= 0xdbff) return index - 1;
    return index;
  }

  function lastSentenceCut(window) {
    const pattern = /(?:(?<!\d)[.!?](?!\d)|[。！？．])["'”’)\]]*(?:\s+|$)/g;
    let match = pattern.exec(window);
    let end = -1;
    while (match) {
      end = match.index + match[0].length;
      match = pattern.exec(window);
    }
    return end;
  }

  function chooseCut(window) {
    const min = Math.floor(window.length * 0.5);
    const sentence = lastSentenceCut(window);
    if (sentence >= min) return sentence;
    const newline = window.lastIndexOf("\n");
    if (newline + 1 >= min) return newline + 1;
    const space = Math.max(window.lastIndexOf(" "), window.lastIndexOf("\t"), window.lastIndexOf("\u3000"));
    if (space > 0) return space + 1;
    if (sentence > 0) return sentence;
    if (newline >= 0) return newline + 1;
    return window.length;
  }

  function splitPlain(text, limit) {
    const parts = [];
    let rest = text;
    while (rest.length > limit) {
      let cut = safeCut(rest, chooseCut(rest.slice(0, limit)));
      if (cut < 1 || cut > limit) cut = safeCut(rest, limit);
      if (cut < 1) cut = 1;
      parts.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    if (rest) parts.push(rest);
    return parts;
  }

  function splitTableBlock(text, limit) {
    const trailing = (text.match(/\n*$/) || [""])[0];
    const lines = text.replace(/\n+$/, "").split("\n");
    const header = lines.length >= 2 && isSeparator(lines[1]) ? [lines[0], lines[1]] : [];
    const pages = [];
    let current = header.slice();
    function push(rows) {
      if (rows.length && rows.length !== header.length) pages.push(rows.join("\n"));
    }
    for (let index = header.length; index < lines.length; index += 1) {
      const row = lines[index];
      if (current.concat([row]).join("\n").length > limit) {
        push(current);
        current = header.slice();
        if (current.concat([row]).join("\n").length > limit) {
          splitPlain(row, limit).forEach(function (part) { pages.push(part); });
          current = header.slice();
          continue;
        }
      }
      current.push(row);
    }
    push(current);
    if (!pages.length) return splitPlain(text, limit);
    const room = limit - pages[pages.length - 1].length;
    if (room > 0) pages[pages.length - 1] += trailing.slice(0, room);
    return pages;
  }

  function splitFenceBlock(text, limit) {
    const trailing = (text.match(/\n*$/) || [""])[0];
    const lines = text.replace(/\n+$/, "").split("\n");
    const open = lines[0];
    const closed = lines.length > 1 && isFenceClose(lines[lines.length - 1]);
    const close = closed ? lines[lines.length - 1] : "```";
    const body = lines.slice(1, closed ? lines.length - 1 : lines.length);
    if (open.length + close.length + 2 >= limit) return splitPlain(text, limit);
    const budget = limit - (open.length + 1 + close.length + 1);
    const pages = [];
    let current = [];
    function flush() {
      pages.push(open + "\n" + current.join("\n") + "\n" + close);
      current = [];
    }
    body.forEach(function (line) {
      if (line.length > budget) {
        if (current.length) flush();
        splitPlain(line, budget).forEach(function (part) {
          pages.push(open + "\n" + part + "\n" + close);
        });
        return;
      }
      if (current.length && current.concat([line]).join("\n").length > budget) flush();
      current.push(line);
    });
    if (current.length || !pages.length) flush();
    const room = limit - pages[pages.length - 1].length;
    if (room > 0) pages[pages.length - 1] += trailing.slice(0, room);
    return pages;
  }

  function splitOversized(block, limit) {
    if (block.kind === "table") return splitTableBlock(block.text, limit);
    if (block.kind === "fence") return splitFenceBlock(block.text, limit);
    return splitPlain(block.text, limit);
  }

  function peelHeading(page) {
    const match = page.match(/(^|\n)([ \t]{0,3}#{1,6}(?!#)[^\n]*\n*)$/);
    if (!match) return null;
    const heading = match[2];
    const rest = page.slice(0, page.length - heading.length);
    if (!rest.trim()) return null;
    return { rest: rest, heading: heading };
  }

  function splitPages(text, limit) {
    const max = Math.max(1, limit || PAGE_LIMIT);
    const source = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!source) return [];
    if (source.length <= max) return [source];
    const pages = [];
    let current = "";
    sliceBlocks(source).forEach(function (block) {
      const parts = block.text.length > max ? splitOversized(block, max) : [block.text];
      parts.forEach(function (part) {
        if (!part) return;
        if (current && current.length + part.length > max) {
          const peeled = peelHeading(current);
          if (peeled && peeled.heading.length + part.length <= max) {
            pages.push(peeled.rest);
            current = peeled.heading + part;
          } else {
            pages.push(current);
            current = part;
          }
        } else {
          current += part;
        }
      });
    });
    if (current) pages.push(current);
    return pages;
  }

  function render(source) {
    return renderResult(source).html;
  }

  const ALLOWED_TAGS = {
    a: true,
    blockquote: true,
    br: true,
    code: true,
    del: true,
    em: true,
    h1: true,
    h2: true,
    h3: true,
    h4: true,
    h5: true,
    h6: true,
    div: true,
    hr: true,
    img: true,
    input: true,
    li: true,
    ol: true,
    p: true,
    pre: true,
    strong: true,
    table: true,
    tbody: true,
    td: true,
    th: true,
    thead: true,
    tr: true,
    ul: true,
  };

  function decodeHtml(value) {
    return String(value)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function applyAttribute(element, name, value) {
    if (name === "href" || name === "src") {
      if (/^(https?:\/\/|mailto:)/i.test(value)) element.setAttribute(name, value);
      return;
    }
    if (name === "alt" || name === "rel" || name === "referrerpolicy") {
      element.setAttribute(name, value);
      return;
    }
    if (name === "target" && value === "_blank") {
      element.setAttribute(name, value);
      return;
    }
    if (name === "class" && (value === "task" || value === "diagram")) {
      element.setAttribute(name, value);
      return;
    }
    if (name === "data-index" && /^\d+$/.test(value)) {
      element.setAttribute(name, value);
      return;
    }
    if (name === "data-lang" && /^[\w.+-]+$/.test(value)) {
      element.setAttribute(name, value);
      return;
    }
    if (name === "type" && value === "checkbox") {
      element.setAttribute(name, value);
      return;
    }
    if (name === "style") {
      const align = value.match(/text-align\s*:\s*(left|right|center)/i);
      if (align) element.setAttribute("style", "text-align:" + align[1].toLowerCase());
      return;
    }
    if ((name === "disabled" || name === "checked") && element.tagName.toLowerCase() === "input") {
      element.setAttribute(name, "");
    }
  }

  function htmlToFragment(doc, html) {
    const fragment = doc.createDocumentFragment();
    const stack = [fragment];
    const pattern = /<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g;
    let match = pattern.exec(html);

    while (match) {
      if (match[5] != null) {
        const text = decodeHtml(match[5]);
        if (text) stack[stack.length - 1].appendChild(doc.createTextNode(text));
      } else {
        const tag = match[2].toLowerCase();
        if (ALLOWED_TAGS[tag]) {
          if (match[1] === "/") {
            for (let index = stack.length - 1; index > 0; index -= 1) {
              if (stack[index].tagName && stack[index].tagName.toLowerCase() === tag) {
                stack.length = index;
                break;
              }
            }
          } else {
            const element = doc.createElement(tag);
            const attrs = match[3] || "";
            const attrPattern = /([a-zA-Z:-]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g;
            let attr = attrPattern.exec(attrs);
            while (attr) {
              applyAttribute(element, attr[1].toLowerCase(), decodeHtml(attr[2] != null ? attr[2] : attr[3] || ""));
              attr = attrPattern.exec(attrs);
            }
            stack[stack.length - 1].appendChild(element);
            const voidTag = tag === "br" || tag === "hr" || tag === "img" || tag === "input" || match[4] === "/";
            if (!voidTag) stack.push(element);
          }
        }
      }
      match = pattern.exec(html);
    }

    return fragment;
  }

  return {
    looksLikeMarkdown: looksLikeMarkdown,
    render: render,
    renderResult: renderResult,
    htmlToFragment: htmlToFragment,
    pageLimit: PAGE_LIMIT,
    splitPages: splitPages,
  };
});
