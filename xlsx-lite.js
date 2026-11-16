// A small reader for .xlsx files (Excel, Numbers and Google Sheets exports). It runs on the device: the file is
// never sent anywhere. It reads cell text and numbers from every sheet; formulas give their last saved result.
// The old .xls format is not supported.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined") module.exports = api;
  else root.GlowaXlsx = api;
})(typeof self !== "undefined" ? self : this, function () {
  const MAX_FILE = 20 * 1024 * 1024;
  const MAX_ENTRY = 40 * 1024 * 1024;

  async function inflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    if (out.length > MAX_ENTRY) throw new Error("This file is too large to read.");
    return out;
  }

  // An .xlsx file is a zip of XML files. This reads the zip's index, then unpacks only the files asked for.
  function zipIndex(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error("This does not look like an Excel file.");
    const total = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    const files = new Map();
    const text = new TextDecoder();
    for (let n = 0; n < total; n++) {
      if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new Error("This Excel file is damaged.");
      const method = view.getUint16(at + 10, true);
      const size = view.getUint32(at + 20, true);
      const nameLen = view.getUint16(at + 28, true), extraLen = view.getUint16(at + 30, true), commentLen = view.getUint16(at + 32, true);
      const local = view.getUint32(at + 42, true);
      files.set(text.decode(bytes.subarray(at + 46, at + 46 + nameLen)), { method, size, local });
      at += 46 + nameLen + extraLen + commentLen;
    }
    return {
      has: (name) => files.has(name),
      async read(name) {
        const f = files.get(name);
        if (!f) return null;
        if (view.getUint32(f.local, true) !== 0x04034b50) throw new Error("This Excel file is damaged.");
        const start = f.local + 30 + view.getUint16(f.local + 26, true) + view.getUint16(f.local + 28, true);
        const data = bytes.subarray(start, start + f.size);
        if (f.method === 0) return text.decode(data);
        if (f.method === 8) return text.decode(await inflate(data));
        throw new Error("This Excel file uses a kind of compression that cannot be read here.");
      },
    };
  }

  const unescape = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (m, e) => {
    if (e[0] === "#") { const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ""; }
    return { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }[e];
  });
  const attr = (tag, name) => { const m = new RegExp("(?:^|\\s)" + name + '="([^"]*)"').exec(tag); return m ? unescape(m[1]) : null; };
  // All the text inside a string item, without the phonetic guides some languages add.
  const textOf = (xml) => {
    const plain = xml.replace(/<rPh[\s\S]*?<\/rPh>/g, "");
    let out = "", m;
    const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    while ((m = re.exec(plain))) out += unescape(m[1]);
    return out;
  };
  // "A" is column 0, "B" is 1, "AA" is 26.
  const column = (ref) => { let n = 0; for (const ch of ref.replace(/[^A-Z]/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

  function sheetRows(xml, strings, maxRows) {
    const rows = [];
    const rowRe = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
    let r;
    while ((r = rowRe.exec(xml)) && rows.length < maxRows) {
      const row = [];
      const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let c, next = 0;
      while ((c = cellRe.exec(r[1] || ""))) {
        const ref = attr(c[1], "r");
        const col = ref ? column(ref) : next;
        if (col < 0 || col > 200) continue;
        next = col + 1;
        const type = attr(c[1], "t");
        const body = c[2] || "";
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);
        let value = "";
        if (type === "s") value = v ? (strings[parseInt(v[1], 10)] || "") : "";
        else if (type === "inlineStr") value = textOf(body);
        else if (type === "b") value = v && v[1] === "1" ? "TRUE" : "FALSE";
        else if (v) value = unescape(v[1]);
        while (row.length < col) row.push("");
        row[col] = value;
      }
      rows.push(row);
    }
    return rows.filter((row) => row.some((cell) => String(cell).trim() !== ""));
  }

  // Reads a workbook. Returns { sheets: [{ name, rows }] }, with empty sheets left out.
  async function readXlsx(buffer, maxRows) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.length > MAX_FILE) throw new Error("This file is larger than 20 MB.");
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open Excel files. Save the list as CSV and try again.");
    const zip = zipIndex(bytes);
    const book = await zip.read("xl/workbook.xml");
    if (!book) throw new Error("This does not look like an Excel file.");
    const rels = (await zip.read("xl/_rels/workbook.xml.rels")) || "";
    const target = new Map();
    for (const m of rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)) target.set(attr(m[1], "Id"), attr(m[1], "Target"));
    const strings = [];
    const shared = await zip.read("xl/sharedStrings.xml");
    if (shared) for (const m of shared.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) strings.push(textOf(m[1] || ""));
    const sheets = [];
    let n = 0;
    for (const m of book.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
      n++;
      const name = attr(m[1], "name") || "Sheet " + n;
      let path = target.get(attr(m[1], "r:id")) || "worksheets/sheet" + n + ".xml";
      path = path.startsWith("/") ? path.slice(1) : "xl/" + path.replace(/^\.\//, "");
      const xml = await zip.read(path);
      if (!xml) continue;
      const rows = sheetRows(xml, strings, maxRows || 5001);
      if (rows.length) sheets.push({ name, rows });
    }
    if (!sheets.length) throw new Error("This Excel file has no rows to read.");
    return { sheets };
  }

  return { readXlsx };
});
