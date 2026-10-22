/**
 * Renders the subset of Jira wiki markup that the drafts use into HTML, so the
 * dashboard can show a description the way Jira displays it.
 * Everything is HTML-escaped first; only the markup below becomes tags.
 */

import { icon } from './views/icons.js';

const escapeHtml = (text) =>
  String(text ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ]),
  );

// placeholders keep escaped characters (\[ \| …) from being read as markup
const ESCAPES = /\\([[\]{}|*_!])/g;
const restoreEscapes = (html) =>
  html.replace(/\u0000(\d+)\u0000/g, (_, code) =>
    String.fromCharCode(Number(code)),
  );

/**
 * @param {string} markup
 * @param {{ attachmentUrl?: (name: string) => string | undefined }} options
 */
export function renderWiki(markup, { attachmentUrl = () => undefined } = {}) {
  const inline = (text) =>
    restoreEscapes(
      escapeHtml(
        text.replace(ESCAPES, (_, c) => `\u0000${c.charCodeAt(0)}\u0000`),
      )
        // embedded image: !file.png|width=640!
        .replace(/!([^!|\s][^!|]*?)(?:\|([^!]*))?!/g, (match, name, opts) => {
          const url = attachmentUrl(name);
          if (!url) return match;
          const width = /width=(\d+)/.exec(opts || '')?.[1];
          return `<img class="wiki-img" src="${url}" alt="${name}"${
            width ? ` style="max-width:min(100%,${width}px)"` : ''
          }>`;
        })
        // attachment link: [^file.html]
        .replace(/\[\^([^\]]+)\]/g, (_, name) => {
          const url = attachmentUrl(name);
          return url
            ? `<a class="wiki-attachment" href="${url}" target="_blank">${icon(
                'paperclip',
                { size: 14 },
              )} ${name}</a>`
            : `<span class="wiki-attachment">${icon('paperclip', {
                size: 14,
              })} ${name}</span>`;
        })
        // web link: [https://…] or [text|https://…]
        .replace(
          /\[(?:([^\]|]+)\|)?(https?:\/\/[^\]\s]+)\]/g,
          (_, text, url) =>
            `<a href="${url}" target="_blank" rel="noopener">${
              text || url
            }</a>`,
        )
        .replace(
          /(^|[\s(>])\*(\S(?:[^*]*?\S)?)\*(?=$|[\s).,:;<])/g,
          '$1<strong>$2</strong>',
        )
        .replace(
          /(^|[\s(>])_(\S(?:[^_]*?\S)?)_(?=$|[\s).,:;<])/g,
          '$1<em>$2</em>',
        ),
    );

  const lines = String(markup ?? '').split('\n');
  const html = [];
  let list = null; // 'ol' | 'ul'
  let itemOpen = false;
  let table = null;

  const closeBlocks = () => {
    if (itemOpen) html.push('</li>');
    itemOpen = false;
    if (list) html.push(`</${list}>`);
    if (table) html.push('</table>');
    list = null;
    table = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // {noformat}…{noformat} and {quote}…{quote}, single- or multi-line
    const block = /^\{(noformat|quote|code)(?::[^}]*)?\}(.*)$/.exec(line);
    if (block) {
      const [, kind, rest] = block;
      const body = [];
      let current = rest;
      let end = current.indexOf(`{${kind}}`);
      while (end === -1 && i < lines.length - 1) {
        body.push(current);
        current = lines[++i];
        end = current.indexOf(`{${kind}}`);
      }
      body.push(end === -1 ? current : current.slice(0, end));
      const text = body.join('\n').replace(/^\n|\n$/g, '');
      if (list && kind !== 'quote') {
        // a code block right after a list item belongs to that item
        html.push(`<pre class="wiki-pre">${escapeHtml(text)}</pre>`);
      } else {
        closeBlocks();
        html.push(
          kind === 'quote'
            ? `<blockquote class="wiki-quote">${inline(text).replace(
                /\n/g,
                '<br>',
              )}</blockquote>`
            : `<pre class="wiki-pre">${escapeHtml(text)}</pre>`,
        );
      }
      continue;
    }

    const heading = /^h([1-6])\.\s+(.*)$/.exec(line);
    if (heading) {
      closeBlocks();
      html.push(
        `<h${heading[1]} class="wiki-h">${inline(heading[2])}</h${heading[1]}>`,
      );
      continue;
    }

    const item = /^([#*])\s+(.*)$/.exec(line);
    if (item) {
      const kind = item[1] === '#' ? 'ol' : 'ul';
      if (list !== kind) {
        closeBlocks();
        html.push(`<${kind} class="wiki-list">`);
        list = kind;
      }
      if (itemOpen) html.push('</li>');
      html.push(`<li>${inline(item[2])}`);
      itemOpen = true;
      continue;
    }

    if (/^\|\|.*\|\|$/.test(line) || /^\|.*\|$/.test(line)) {
      if (!table) {
        closeBlocks();
        html.push('<table class="wiki-table">');
        table = true;
      }
      const header = line.startsWith('||');
      const cells = line
        .replace(/\\\|/g, '\u0001')
        .slice(header ? 2 : 1, header ? -2 : -1)
        .split(header ? '||' : '|')
        .map((c) => inline(c.replace(/\u0001/g, '\\|')));
      const tag = header ? 'th' : 'td';
      html.push(
        `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`,
      );
      continue;
    }

    closeBlocks();
    if (line.trim()) html.push(`<p>${inline(line)}</p>`);
  }
  closeBlocks();
  return html.join('\n');
}
