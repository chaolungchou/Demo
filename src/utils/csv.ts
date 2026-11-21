import { GroupItem, Student } from '../types';

export const SAMPLE_STUDENT_NAMES: string[] = [
  '陳宇軒',
  '林品妤',
  '黃柏翰',
  '張芷晴',
  '李承恩',
  '王語彤',
  '吳宥辰',
  '劉采妮',
  '蔡定謙',
  '楊詠晴',
  '許睿哲',
  '鄭羽希',
  '謝柏宇',
  '郭苡安',
  '洪子軒',
  '邱若涵',
  '曾彥廷',
  '廖芸熙',
  '賴品睿',
  '徐宥希',
  '周子洋',
  '葉沛宸',
  '蘇樂恩',
  '莊芯語',
];

export function createStudentsFromNames(names: string[]): Student[] {
  return names
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((name, idx) => ({
      id: `stu-${idx + 1}-${Math.random().toString(36).slice(2, 8)}`,
      seatNo: idx + 1,
      name,
    }));
}

/**
 * Decodes an uploaded CSV/TXT file buffer with UTF-8 first,
 * falling back to Big5 if invalid UTF-8 sequences are detected (common in Taiwan Excel CSVs).
 */
export async function decodeTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  const utf8Text = utf8Decoder.decode(buffer);

  // Check if UTF-8 decoding produced replacement characters (indicating Big5 or non-UTF8 encoding)
  if (utf8Text.includes('\uFFFD')) {
    try {
      const big5Decoder = new TextDecoder('big5');
      return big5Decoder.decode(buffer).replace(/^\uFEFF/, '');
    } catch {
      return utf8Text.replace(/^\uFEFF/, '');
    }
  }

  return utf8Text.replace(/^\uFEFF/, '');
}

/**
 * Parses a single CSV line handling double-quoted fields and escaped quotes.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cells.push(current.trim());
  return cells;
}

export interface ParsedCsvTable {
  rows: string[][];
  delimiter: string;
  hasLikelyHeader: boolean;
  suggestedNameColumn: number;
}

const NAME_HEADER_KEYWORDS = ['姓名', '名字', '學生姓名', '學生', 'name', 'student', 'student name'];
const COMMON_HEADER_KEYWORDS = [
  ...NAME_HEADER_KEYWORDS,
  '座號',
  '編號',
  '學號',
  '班級',
  '性別',
  '備註',
  'id',
  'no',
  'number',
  'class',
  'gender',
  'email',
];

export function parseCsvContent(rawText: string): ParsedCsvTable {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      delimiter: ',',
      hasLikelyHeader: false,
      suggestedNameColumn: 0,
    };
  }

  // Detect delimiter from first 5 lines
  const sampleLines = lines.slice(0, 5);
  const candidates = [',', '\t', ';'];
  let bestDelimiter = ',';
  let bestScore = 0;

  for (const delim of candidates) {
    const counts = sampleLines.map((l) => parseCsvLine(l, delim).length);
    const minCols = Math.min(...counts);
    const maxCols = Math.max(...counts);
    if (minCols > 1 && maxCols - minCols <= 1 && minCols > bestScore) {
      bestScore = minCols;
      bestDelimiter = delim;
    }
  }

  const rows = lines.map((line) => parseCsvLine(line, bestDelimiter));
  const maxCols = Math.max(...rows.map((r) => r.length));
  const normalizedRows = rows.map((r) => {
    const padded = [...r];
    while (padded.length < maxCols) padded.push('');
    return padded;
  });

  const firstRow = normalizedRows[0];
  const hasLikelyHeader = firstRow.some((cell) => {
    const lower = cell.toLowerCase();
    return COMMON_HEADER_KEYWORDS.some((kw) => lower === kw || lower.includes(kw));
  });

  let suggestedNameColumn = 0;
  if (hasLikelyHeader) {
    const nameColIdx = firstRow.findIndex((cell) => {
      const lower = cell.toLowerCase();
      return NAME_HEADER_KEYWORDS.some((kw) => lower === kw || lower.includes(kw));
    });
    if (nameColIdx >= 0) {
      suggestedNameColumn = nameColIdx;
    } else if (maxCols > 1) {
      // Often column 0 is seat number, column 1 is name
      suggestedNameColumn = 1;
    }
  } else if (maxCols > 1) {
    // If column 0 looks numeric (seat numbers), pick column 1
    const col0NumericRatio =
      normalizedRows.filter((r) => /^\d+$/.test(r[0])).length / normalizedRows.length;
    if (col0NumericRatio > 0.6) {
      suggestedNameColumn = 1;
    }
  }

  return {
    rows: normalizedRows,
    delimiter: bestDelimiter,
    hasLikelyHeader,
    suggestedNameColumn,
  };
}

/**
 * Parses pasted text separated by newlines, commas, Chinese commas, semicolons, or tabs.
 * Also strips leading numbering like "1. 王小明", "01 王小明", "1、王小明".
 */
export function parsePastedNames(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const tokens = normalized.split(/[\n,，、;\t]+/);
  return tokens
    .map((item) =>
      item
        .trim()
        .replace(/^\d+[\.\、\)\-\s]+/, '')
        .trim()
    )
    .filter((item) => item.length > 0 && !NAME_HEADER_KEYWORDS.includes(item.toLowerCase()));
}

export function downloadSampleCsv() {
  const header = '座號,姓名\n';
  const body = SAMPLE_STUDENT_NAMES.map((name, idx) => `${idx + 1},${name}`).join('\n');
  const csvContent = '\uFEFF' + header + body;
  triggerFileDownload(csvContent, '班級學生名單範例.csv', 'text/csv;charset=utf-8;');
}

export function exportGroupsToCsv(groups: GroupItem[]) {
  const header = '組別,組內序號,座號,學生姓名,職務\n';
  const lines: string[] = [];

  groups.forEach((group) => {
    group.members.forEach((member, idx) => {
      const role = group.leaderId === member.id ? '組長' : '組員';
      const safeTitle = `"${group.title.replace(/"/g, '""')}"`;
      const safeName = `"${member.name.replace(/"/g, '""')}"`;
      lines.push(`${safeTitle},${idx + 1},${member.seatNo},${safeName},${role}`);
    });
  });

  const csvContent = '\uFEFF' + header + lines.join('\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerFileDownload(csvContent, `課堂分組結果_${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

export function formatGroupsAsText(groups: GroupItem[]): string {
  return groups
    .map((group) => {
      const memberStr = group.members
        .map((m) => (group.leaderId === m.id ? `${m.name}（組長）` : m.name))
        .join('、');
      return `${group.title}（${group.members.length}人）：${memberStr}`;
    })
    .join('\n');
}

function triggerFileDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
