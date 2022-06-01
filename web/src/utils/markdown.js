// Very small "markdown" for review texts:
//   **fett**, *kursiv*, [Link](https://...), lines starting with "- " become a list,
//   empty line = new paragraph.
// No library on purpose, marked + sanitizer would be 40 kB more for three features.

export function renderMarkdown(text) {
  if (!text) return '';
  const src = String(text)
    .replace(/\r\n/g, '\n')
    // keine Scripts in Rezensionen
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  const blocks = src.split(/\n{2,}/);
  return blocks.map(function (block) {
    const lines = block.split('\n');
    if (lines.every(l => /^\s*- /.test(l))) {
      return '<ul>' + lines.map(l => '<li>' + inline(l.replace(/^\s*- /, '')) + '</li>').join('') + '</ul>';
    }
    return '<p>' + lines.map(inline).join('<br>') + '</p>';
  }).join('');
}

function inline(line) {
  return line
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

// for the list preview: markdown characters removed, cut to n chars
export function plainText(text, n) {
  const s = String(text || '').replace(/\*\*|\*|\[|\]\([^)]*\)/g, '');
  return n && s.length > n ? s.slice(0, n) + '...' : s;
}
