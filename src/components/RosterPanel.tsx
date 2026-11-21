import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  ClipboardPaste,
  Download,
  Plus,
  X,
  Search,
  RotateCcw,
  Trash2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { ActiveView, Student } from '../types';
import {
  decodeTextFile,
  downloadSampleCsv,
  parseCsvContent,
  ParsedCsvTable,
  parsePastedNames,
  SAMPLE_STUDENT_NAMES,
} from '../utils/csv';

interface RosterPanelProps {
  students: Student[];
  isUsingSample: boolean;
  onReplaceStudents: (names: string[], isSample?: boolean) => void;
  onAppendStudents: (names: string[]) => void;
  onRemoveStudent: (id: string) => void;
  onAddSingleStudent: (name: string) => void;
  onDeduplicateStudents: () => void;
  onNavigate: (view: ActiveView) => void;
  onNotify: (text: string, tone?: 'info' | 'success' | 'warning') => void;
  fileInputTriggerRef?: React.RefObject<HTMLInputElement | null>;
}

type ImportMode = 'csv' | 'paste';

export function RosterPanel({
  students,
  isUsingSample,
  onReplaceStudents,
  onAppendStudents,
  onRemoveStudent,
  onAddSingleStudent,
  onDeduplicateStudents,
  onNavigate,
  onNotify,
  fileInputTriggerRef,
}: RosterPanelProps) {
  const [importMode, setImportMode] = useState<ImportMode>('csv');
  const [pasteText, setPasteText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsvTable | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<number>(0);
  const [skipHeader, setSkipHeader] = useState<boolean>(true);
  const [csvError, setCsvError] = useState<string | null>(null);

  const [quickAddName, setQuickAddName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const internalFileRef = useRef<HTMLInputElement | null>(null);
  const fileRef = fileInputTriggerRef ?? internalFileRef;

  const parsedPasteList = useMemo(() => parsePastedNames(pasteText), [pasteText]);

  const extractedCsvNames = useMemo(() => {
    if (!parsedCsv || parsedCsv.rows.length === 0) return [];
    const dataRows = skipHeader && parsedCsv.rows.length > 1 ? parsedCsv.rows.slice(1) : parsedCsv.rows;
    return dataRows
      .map((row) => (row[selectedColumn] ?? '').trim())
      .filter((name) => name.length > 0);
  }, [parsedCsv, selectedColumn, skipHeader]);

  const duplicateCount = useMemo(() => {
    const seen = new Set<string>();
    let dupes = 0;
    for (const s of students) {
      if (seen.has(s.name)) dupes++;
      else seen.add(s.name);
    }
    return dupes;
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || String(s.seatNo).includes(q)
    );
  }, [students, searchQuery]);

  async function handleFileSelect(file: File) {
    setCsvError(null);
    const validExt = /\.(csv|txt|tsv)$/i.test(file.name);
    if (!validExt && !file.type.startsWith('text/')) {
      setCsvError('請選擇 .csv 或 .txt 文字格式的名單檔案。');
      return;
    }

    try {
      const content = await decodeTextFile(file);
      const parsed = parseCsvContent(content);
      if (parsed.rows.length === 0) {
        setCsvError('檔案內容為空，請確認檔案中是否包含學生姓名。');
        return;
      }
      setCsvFileName(file.name);
      setParsedCsv(parsed);
      setSelectedColumn(parsed.suggestedNameColumn);
      setSkipHeader(parsed.hasLikelyHeader);
      setImportMode('csv');
    } catch {
      setCsvError('讀取檔案時發生錯誤，請確認檔案未損毀後重試。');
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }

  function applyCsvImport(mode: 'replace' | 'append') {
    if (extractedCsvNames.length === 0) {
      onNotify('所選欄位中沒有可匯入的姓名', 'warning');
      return;
    }
    if (mode === 'replace') {
      onReplaceStudents(extractedCsvNames, false);
      onNotify(`已從 ${csvFileName ?? 'CSV'} 匯入 ${extractedCsvNames.length} 位學生`, 'success');
    } else {
      onAppendStudents(extractedCsvNames);
      onNotify(`已新增 ${extractedCsvNames.length} 位學生至現有名單`, 'success');
    }
    setParsedCsv(null);
    setCsvFileName(null);
  }

  function applyPasteImport(mode: 'replace' | 'append') {
    if (parsedPasteList.length === 0) {
      onNotify('請先貼上至少一位學生姓名', 'warning');
      return;
    }
    if (mode === 'replace') {
      onReplaceStudents(parsedPasteList, false);
      onNotify(`已套用 ${parsedPasteList.length} 位學生名單`, 'success');
    } else {
      onAppendStudents(parsedPasteList);
      onNotify(`已新增 ${parsedPasteList.length} 位學生至現有名單`, 'success');
    }
    setPasteText('');
  }

  function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = quickAddName.trim();
    if (!cleaned) return;
    onAddSingleStudent(cleaned);
    setQuickAddName('');
    onNotify(`已加入「${cleaned}」`, 'success');
  }

  function handleLoadSample() {
    onReplaceStudents(SAMPLE_STUDENT_NAMES, true);
    setConfirmClear(false);
    onNotify(`已載入 ${SAMPLE_STUDENT_NAMES.length} 位範例學生名單`, 'info');
  }

  function handleClearAll() {
    onReplaceStudents([], false);
    setConfirmClear(false);
    onNotify('已清空目前名單', 'info');
  }

  const colCount = parsedCsv?.rows[0]?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* Page Intro */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            班級學生名單管理
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            上傳 CSV 檔案或直接貼上姓名，名單會自動同步至隨機抽籤與自動分組並儲存在本機瀏覽器。
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('draw')}
            disabled={students.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
          >
            前往隨機抽籤
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('group')}
            disabled={students.length < 2}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
          >
            前往自動分組
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Import Sources */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">匯入名單來源</h2>
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              下載 CSV 範例
            </button>
          </div>

          {/* Interactive segmented mode toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setImportMode('csv')}
              className={`inline-flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                importMode === 'csv'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              上傳 CSV 檔案
            </button>
            <button
              type="button"
              onClick={() => setImportMode('paste')}
              className={`inline-flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                importMode === 'paste'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardPaste className="w-4 h-4 shrink-0" />
              貼上學生姓名
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {importMode === 'csv' ? (
            <div className="space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                  isDragging
                    ? 'border-sky-500 bg-sky-50/70'
                    : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50/80'
                }`}
              >
                <Upload className="w-7 h-7 mx-auto text-slate-400" />
                <p className="mt-3 text-sm font-medium text-slate-800">
                  拖曳 CSV 檔案至此，或點擊選擇檔案
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  支援 Excel 匯出的 UTF-8 與 Big5 編碼，多欄位檔案可指定姓名欄
                </p>
              </div>

              {csvError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
                  <span>{csvError}</span>
                </div>
              )}

              {/* Parsed CSV column & preview panel */}
              {parsedCsv && (
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      已讀取：{csvFileName}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setParsedCsv(null);
                        setCsvFileName(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 whitespace-nowrap"
                    >
                      取消
                    </button>
                  </div>

                  {colCount > 1 && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-600">
                        偵測到 {colCount} 個欄位，請選擇學生姓名所在欄位：
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: colCount }).map((_, idx) => {
                          const headerLabel = parsedCsv.rows[0]?.[idx] || `第 ${idx + 1} 欄`;
                          const active = selectedColumn === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedColumn(idx)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                                active
                                  ? 'bg-sky-600 text-white border-sky-600'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              欄 {idx + 1}：{headerLabel.slice(0, 12)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {parsedCsv.rows.length > 1 && (
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={skipHeader}
                        onChange={(e) => setSkipHeader(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                      />
                      略過第一列標題（{parsedCsv.rows[0]?.[selectedColumn] || '標題列'}）
                    </label>
                  )}

                  <div className="text-xs text-slate-600 space-y-1.5">
                    <div className="font-medium text-slate-800 tabular-nums">
                      預覽姓名（共 {extractedCsvNames.length} 位）：
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      {extractedCsvNames.slice(0, 8).join('、')}
                      {extractedCsvNames.length > 8
                        ? ` 等共 ${extractedCsvNames.length} 位`
                        : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => applyCsvImport('replace')}
                      className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      取代目前名單
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCsvImport('append')}
                      className="py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      附加至名單
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="paste-roster-textarea"
                  className="block text-xs font-medium text-slate-600 mb-2"
                >
                  每行輸入一位學生，或使用逗號、頓號分隔（可直接從 Excel / Google 試算表貼上）
                </label>
                <textarea
                  id="paste-roster-textarea"
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'陳宇軒\n林品妤\n黃柏翰\n張芷晴\n...'}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20 resize-y"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                <span>已辨識：{parsedPasteList.length} 位學生</span>
                {pasteText.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPasteText('')}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    清除輸入框
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => applyPasteImport('replace')}
                  disabled={parsedPasteList.length === 0}
                  className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
                >
                  取代目前名單
                </button>
                <button
                  type="button"
                  onClick={() => applyPasteImport('append')}
                  disabled={parsedPasteList.length === 0}
                  className="py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap"
                >
                  附加至名單
                </button>
              </div>
            </div>
          )}

          {/* Utility Footer Row */}
          <div className="pt-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              載入 24 位範例名單
            </button>

            {students.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-700 font-medium">確定清空全部？</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md whitespace-nowrap"
                  >
                    確定清空
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  清空目前名單
                </button>
              )
            )}
          </div>
        </section>

        {/* Right Column: Active Class Roster */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">目前班級名單</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span>共 {students.length} 位學生</span>
                {isUsingSample && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-700 font-medium">範例名單（可直接試用或匯入替換）</span>
                  </>
                )}
                {duplicateCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-700 font-medium">
                      發現 {duplicateCount} 筆重複姓名
                    </span>
                    <button
                      type="button"
                      onClick={onDeduplicateStudents}
                      className="text-sky-700 hover:underline font-medium"
                    >
                      一鍵去重
                    </button>
                  </>
                )}
              </div>
            </div>

            {students.length > 8 && (
              <div className="relative w-full sm:w-48">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋座號或姓名"
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/15"
                />
              </div>
            )}
          </div>

          {/* Quick add single student */}
          <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
            <input
              type="text"
              value={quickAddName}
              onChange={(e) => setQuickAddName(e.target.value)}
              placeholder="手動新增單一學生姓名..."
              className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/15"
            />
            <button
              type="submit"
              disabled={!quickAddName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              新增
            </button>
          </form>

          {/* Roster grid */}
          {students.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-200 rounded-xl">
              <p className="text-sm font-medium text-slate-700">目前尚未建立學生名單</p>
              <p className="mt-1 text-xs text-slate-500">
                請由左側上傳 CSV、貼上學生姓名，或點選載入範例名單開始使用。
              </p>
              <button
                type="button"
                onClick={handleLoadSample}
                className="mt-4 px-4 py-2 text-sm font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
              >
                載入 24 位範例學生
              </button>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              找不到符合「{searchQuery}」的學生。
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[440px] overflow-y-auto pr-1">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                      {String(student.seatNo).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {student.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveStudent(student.id)}
                    aria-label={`移除 ${student.name}`}
                    className="p-1 text-slate-400 hover:text-rose-600 opacity-60 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
