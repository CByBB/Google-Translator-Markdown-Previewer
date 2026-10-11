# Markdown Preview for Google Translate

Chrome / Edge (Manifest V3) extension that renders Markdown in the Google Translate **result** so long documents with headings, tables, and Mermaid diagrams stay readable after translation.

The source box stays plain text. Only the translation preview is formatted.

## Features

- Markdown in the translation result: headings, bold/italic, lists, quotes, links, images, code, tables, task lists
- Mermaid diagrams drawn in an isolated extension iframe (uses original source diagram when translation breaks syntax)
- Repair for common Google Translate damage (fullwidth markers, spaced bold, broken fences, mangled tables)
- Long documents: result pages are joined so you see the full translation; split points prefer paragraphs and sentences
- Toggle under the source box or in the extension popup
- Works on translate.google.com and several country hosts

## Install (unpacked)

1. Clone or download this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this project folder (the one that contains `manifest.json`).
5. Open [Google Translate](https://translate.google.com/), paste Markdown, and translate.

After you change extension files, click **Reload** on the extension card, then refresh the Translate tab.

## Usage

1. Paste Markdown into the source box and translate as usual.
2. When the text looks like Markdown, the extension overlays a formatted preview on the result.
3. Use the **Markdown** control under the source box (or the popup checkbox) to turn the preview on or off.
4. For text longer than one Translate page, wait a moment while pages are collected; the preview shows the full joined translation.

## Development

```bash
node --check src/content.js src/markdown.js src/translate-page.js src/mermaid-frame.js src/popup.js
node --test test/markdown.test.js
```

### Layout

| Path | Role |
| --- | --- |
| `manifest.json` | MV3 manifest, host matches, content scripts |
| `src/markdown.js` | Parse, repair, render Markdown; page splitting |
| `src/content.js` | Overlay preview, long-text assembly, Mermaid mounts |
| `src/translate-page.js` | Page-world helper for translate API requests |
| `src/mermaid-frame.html` / `src/mermaid-frame.js` | Mermaid render iframe |
| `vendor/mermaid.min.js` | Vendored Mermaid 11 |
| `src/popup.*` | Enable/disable UI |
| `test/` | Unit tests and sample documents |

## Privacy

- Runs only on Google Translate pages listed in the manifest.
- Uses `storage` for the Markdown preview on/off preference.
- Does not send your text to any third-party server beyond Google Translate itself.

## License

Use and modify for your own projects. Mermaid is included under its own license in `vendor/`.
