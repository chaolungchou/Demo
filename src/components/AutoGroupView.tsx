import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Shuffle,
  Minus,
  Plus,
  Download,
  Copy,
  Check,
  Crown,
  LayoutGrid,
  Armchair,
  Users,
  Pencil,
} from 'lucide-react';
import { GroupItem, GroupVisualMode, RemainderStrategy, Student } from '../types';
import { exportGroupsToCsv, formatGroupsAsText } from '../utils/csv';
import { soundEngine } from '../utils/sound';

interface AutoGroupViewProps {
  students: Student[];
  groups: GroupItem[];
  groupSize: number;
  remainderStrategy: RemainderStrategy;
  onChangeGroupSize: (size: number) => void;
  onChangeRemainderStrategy: (strategy: RemainderStrategy) => void;
  onGenerateGroups: (size: number, strategy: RemainderStrategy) => void;
  onSwapStudents: (
    first: { groupId: string; studentId: string },
    second: { groupId: string; studentId: string }
  ) => void;
  onToggleLeader: (groupId: string, studentId: string) => void;
  onRandomizeLeaders: () => void;
  onRenameGroup: (groupId: string, title: string) => void;
  onGoToRoster: () => void;
  onNotify: (text: string, tone?: 'info' | 'success' | 'warning') => void;
}

// Curated distinct group accent palette (always paired with explicit "第 N 組" labels, never hue-only)
const GROUP_ACCENTS = [
  { dot: '#0284C7', tableBg: '#F0F9FF', tableBorder: '#BAE6FD', text: '#0369A1' }, // Sky
  { dot: '#059669', tableBg: '#ECFDF5', tableBorder: '#A7F3D0', text: '#047857' }, // Emerald
  { dot: '#D97706', tableBg: '#FFFBEB', tableBorder: '#FDE68A', text: '#B45309' }, // Amber
  { dot: '#4F46E5', tableBg: '#EEF2FF', tableBorder: '#C7D2FE', text: '#4338CA' }, // Indigo
  { dot: '#E11D48', tableBg: '#FFF1F2', tableBorder: '#FECDD3', text: '#BE123C' }, // Rose
  { dot: '#0D9488', tableBg: '#F0FDFA', tableBorder: '#99F6E4', text: '#0F766E' }, // Teal
  { dot: '#7C3AED', tableBg: '#F5F3FF', tableBorder: '#DDD6FE', text: '#6D28D9' }, // Violet
  { dot: '#EA580C', tableBg: '#FFF7ED', tableBorder: '#FED7AA', text: '#C2410C' }, // Orange
];

export function AutoGroupView({
  students,
  groups,
  groupSize,
  remainderStrategy,
  onChangeGroupSize,
  onChangeRemainderStrategy,
  onGenerateGroups,
  onSwapStudents,
  onToggleLeader,
  onRandomizeLeaders,
  onRenameGroup,
  onGoToRoster,
  onNotify,
}: AutoGroupViewProps) {
  const [visualMode, setVisualMode] = useState<GroupVisualMode>('tables');
  const [selectedForSwap, setSelectedForSwap] = useState<{
    groupId: string;
    studentId: string;
    studentName: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [shuffleKey, setShuffleKey] = useState(0);

  const maxGroupSize = Math.max(2, Math.min(20, students.length));
  const clampedGroupSize = Math.min(Math.max(2, groupSize), maxGroupSize);

  // Auto-generate initial grouping when entering view with valid roster and no groups yet
  useEffect(() => {
    if (students.length >= 2 && groups.length === 0) {
      onGenerateGroups(clampedGroupSize, remainderStrategy);
    }
  }, [students.length, groups.length, clampedGroupSize, remainderStrategy, onGenerateGroups]);

  // Clear swap selection if groups regenerate
  useEffect(() => {
    setSelectedForSwap(null);
  }, [groups]);

  // Preview calculation text
  const previewDistribution = useMemo(() => {
    const total = students.length;
    if (total < 2) return '名單人數不足 2 位';

    const baseGroups = Math.floor(total / clampedGroupSize);
    const rem = total % clampedGroupSize;

    if (rem === 0) {
      return `共 ${baseGroups} 組，每組 ${clampedGroupSize} 人`;
    }

    if (remainderStrategy === 'separate' || baseGroups === 0) {
      return `共 ${baseGroups + 1} 組（${baseGroups} 組 ${clampedGroupSize} 人、1 組 ${rem} 人）`;
    }

    // Evenly distribute remainder across baseGroups
    const extraPerGroup = Math.floor(rem / baseGroups);
    const groupsWithOneMore = rem % baseGroups;
    const minSize = clampedGroupSize + extraPerGroup;
    const maxSize = minSize + (groupsWithOneMore > 0 ? 1 : 0);

    if (minSize === maxSize) {
      return `共 ${baseGroups} 組，每組 ${minSize} 人`;
    }
    return `共 ${baseGroups} 組（${groupsWithOneMore} 組 ${maxSize} 人、${baseGroups - groupsWithOneMore} 組 ${minSize} 人）`;
  }, [students.length, clampedGroupSize, remainderStrategy]);

  function handleRunGrouping(
    nextSize = clampedGroupSize,
    nextStrategy = remainderStrategy
  ) {
    if (students.length < 2) return;
    onGenerateGroups(nextSize, nextStrategy);
    setShuffleKey((k) => k + 1);
    soundEngine.playGroupComplete();
  }

  function handleSizeStep(delta: number) {
    const next = Math.min(maxGroupSize, Math.max(2, clampedGroupSize + delta));
    if (next === clampedGroupSize) return;
    onChangeGroupSize(next);
    if (students.length >= 2) {
      onGenerateGroups(next, remainderStrategy);
      setShuffleKey((k) => k + 1);
    }
  }

  function handleSliderChange(val: number) {
    onChangeGroupSize(val);
    if (students.length >= 2) {
      onGenerateGroups(val, remainderStrategy);
      setShuffleKey((k) => k + 1);
    }
  }

  function handleStrategyChange(next: RemainderStrategy) {
    onChangeRemainderStrategy(next);
    if (students.length >= 2) {
      onGenerateGroups(clampedGroupSize, next);
      setShuffleKey((k) => k + 1);
    }
  }

  function handleStudentClick(groupId: string, student: Student) {
    if (!selectedForSwap) {
      setSelectedForSwap({
        groupId,
        studentId: student.id,
        studentName: student.name,
      });
      soundEngine.playPop();
      return;
    }

    if (selectedForSwap.studentId === student.id) {
      setSelectedForSwap(null);
      return;
    }

    onSwapStudents(
      { groupId: selectedForSwap.groupId, studentId: selectedForSwap.studentId },
      { groupId, studentId: student.id }
    );
    soundEngine.playPop();
    onNotify(`已將「${selectedForSwap.studentName}」與「${student.name}」互換位置`, 'success');
    setSelectedForSwap(null);
  }

  async function handleCopyText() {
    if (groups.length === 0) return;
    const text = formatGroupsAsText(groups);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onNotify('已複製分組名單文字，可直接貼上至訊息或文件', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('無法自動存取剪貼簿，請改用匯出 CSV', 'warning');
    }
  }

  function startEditingGroup(group: GroupItem) {
    setEditingGroupId(group.id);
    setEditingTitle(group.title);
  }

  function commitGroupTitle(groupId: string) {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameGroup(groupId, trimmed);
    }
    setEditingGroupId(null);
  }

  if (students.length < 2) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            課堂自動分組
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            設定每組人數後一鍵隨機分組，以視覺化教室桌位呈現結果並支援拖點互換。
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl py-20 px-6 text-center space-y-3">
          <Users className="w-10 h-10 mx-auto text-slate-300" />
          <h2 className="text-lg font-semibold text-slate-800">
            至少需要 2 位學生才能進行自動分組
          </h2>
          <p className="text-sm text-slate-500">
            目前名單有 {students.length} 位學生，請先上傳 CSV 或貼上學生姓名。
          </p>
          <button
            type="button"
            onClick={onGoToRoster}
            className="mt-2 px-5 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors"
          >
            前往管理名單
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            課堂自動分組
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            自訂每組人數並隨機分配組別，以視覺化教室桌位清楚展示，可點選任兩位學生微調互換。
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleRunGrouping()}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
        >
          <Shuffle className="w-4 h-4" />
          重新隨機分組
        </button>
      </div>

      {/* Grouping Control Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Group Size Stepper & Slider */}
          <div className="md:col-span-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="group-size-slider"
                className="text-sm font-semibold text-slate-900"
              >
                每組人數設定
              </label>
              <span className="font-mono text-sm font-semibold text-sky-700 tabular-nums">
                每組 {clampedGroupSize} 人
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSizeStep(-1)}
                disabled={clampedGroupSize <= 2}
                aria-label="減少每組人數"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 transition-colors shrink-0"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                id="group-size-slider"
                type="range"
                min={2}
                max={maxGroupSize}
                step={1}
                value={clampedGroupSize}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                className="flex-1 accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />

              <button
                type="button"
                onClick={() => handleSizeStep(1)}
                disabled={clampedGroupSize >= maxGroupSize}
                aria-label="增加每組人數"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Remainder Distribution */}
          <div className="md:col-span-4 space-y-2">
            <span className="block text-sm font-semibold text-slate-900">
              人數無法整除時
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => handleStrategyChange('distribute')}
                className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  remainderStrategy === 'distribute'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                平均分攤各組
              </button>
              <button
                type="button"
                onClick={() => handleStrategyChange('separate')}
                className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  remainderStrategy === 'separate'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                餘數獨立成組
              </button>
            </div>
          </div>

          {/* Visual Display Switch */}
          <div className="md:col-span-3 space-y-2">
            <span className="block text-sm font-semibold text-slate-900">
              視覺化檢視
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setVisualMode('tables')}
                className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  visualMode === 'tables'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Armchair className="w-3.5 h-3.5" />
                桌位圖
              </button>
              <button
                type="button"
                onClick={() => setVisualMode('grid')}
                className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  visualMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                清單檢視
              </button>
            </div>
          </div>
        </div>

        {/* Summary Metadata & Teacher Tools Strip */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
            <span className="font-medium text-slate-800">全班 {students.length} 位</span>
            <span aria-hidden="true">·</span>
            <span>{previewDistribution}</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-500">
              {selectedForSwap
                ? `已選取「${selectedForSwap.studentName}」，請點選另一位學生互換組別`
                : '點選任兩位學生可互換組別，點擊皇冠可設為組長'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedForSwap && (
              <button
                type="button"
                onClick={() => setSelectedForSwap(null)}
                className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md whitespace-nowrap"
              >
                取消選取
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onRandomizeLeaders();
                soundEngine.playPop();
                onNotify('已為各組隨機指派組長', 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
            >
              <Crown className="w-3.5 h-3.5 text-amber-600" />
              隨機指派組長
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '已複製' : '複製文字'}
            </button>
            <button
              type="button"
              onClick={() => {
                exportGroupsToCsv(groups);
                onNotify('已下載分組結果 CSV 檔案', 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              匯出 CSV
            </button>
          </div>
        </div>
      </section>

      {/* Visualized Grouping Stage */}
      {visualMode === 'tables' ? (
        /* Classroom Floorplan Visual Tables */
        <div
          key={`tables-${shuffleKey}`}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {groups.map((group, idx) => {
            const accent = GROUP_ACCENTS[group.colorIndex % GROUP_ACCENTS.length];
            const splitPoint = Math.ceil(group.members.length / 2);
            const topSeats = group.members.slice(0, splitPoint);
            const bottomSeats = group.members.slice(splitPoint);

            return (
              <motion.article
                key={group.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(idx * 0.04, 0.32),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                {/* Top Row of Seats around Table */}
                <div className="flex flex-wrap justify-center gap-2">
                  {topSeats.map((member) => {
                    const isSelected = selectedForSwap?.studentId === member.id;
                    const isLeader = group.leaderId === member.id;
                    return (
                      <SeatChip
                        key={member.id}
                        member={member}
                        position="top"
                        isSelected={isSelected}
                        isLeader={isLeader}
                        onSelect={() => handleStudentClick(group.id, member)}
                        onToggleLeader={() => onToggleLeader(group.id, member.id)}
                      />
                    );
                  })}
                </div>

                {/* Central Visual Classroom Tabletop */}
                <div
                  style={{
                    backgroundColor: accent.tableBg,
                    borderColor: accent.tableBorder,
                  }}
                  className="relative mx-auto w-full rounded-2xl border-2 px-5 py-5 text-center flex flex-col items-center justify-center min-h-[96px]"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: accent.dot }}
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                    />
                    {editingGroupId === group.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => commitGroupTitle(group.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitGroupTitle(group.id);
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        className="w-28 text-center text-base font-bold text-slate-900 bg-white border border-sky-400 rounded px-1.5 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingGroup(group)}
                        className="group inline-flex items-center gap-1.5 text-base font-bold text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded"
                        title="點擊修改組名"
                      >
                        <span>{group.title}</span>
                        <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </div>
                  <div
                    style={{ color: accent.text }}
                    className="mt-1 text-xs font-medium tabular-nums"
                  >
                    {group.members.length} 位組員
                    {group.leaderId && (
                      <>
                        {' · 組長：'}
                        {group.members.find((m) => m.id === group.leaderId)?.name}
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Row of Seats around Table */}
                <div className="flex flex-wrap justify-center gap-2 min-h-[42px]">
                  {bottomSeats.map((member) => {
                    const isSelected = selectedForSwap?.studentId === member.id;
                    const isLeader = group.leaderId === member.id;
                    return (
                      <SeatChip
                        key={member.id}
                        member={member}
                        position="bottom"
                        isSelected={isSelected}
                        isLeader={isLeader}
                        onSelect={() => handleStudentClick(group.id, member)}
                        onToggleLeader={() => onToggleLeader(group.id, member.id)}
                      />
                    );
                  })}
                </div>
              </motion.article>
            );
          })}
        </div>
      ) : (
        /* Clean Grid List Mode */
        <div
          key={`grid-${shuffleKey}`}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {groups.map((group, idx) => {
            const accent = GROUP_ACCENTS[group.colorIndex % GROUP_ACCENTS.length];
            return (
              <motion.article
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.22,
                  delay: Math.min(idx * 0.03, 0.25),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: accent.dot }}
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                    />
                    {editingGroupId === group.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => commitGroupTitle(group.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitGroupTitle(group.id);
                          if (e.key === 'Escape') setEditingGroupId(null);
                        }}
                        className="w-24 text-sm font-bold text-slate-900 bg-white border border-sky-400 rounded px-1.5 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingGroup(group)}
                        className="text-sm font-bold text-slate-900 truncate hover:underline"
                        title="點擊修改組名"
                      >
                        {group.title}
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
                    {group.members.length} 人
                  </span>
                </div>

                <ul className="divide-y divide-slate-100 p-2 flex-1">
                  {group.members.map((member) => {
                    const isSelected = selectedForSwap?.studentId === member.id;
                    const isLeader = group.leaderId === member.id;
                    return (
                      <li key={member.id} className="flex items-center gap-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => handleStudentClick(group.id, member)}
                          className={`flex-1 flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                            isSelected
                              ? 'bg-sky-50 ring-2 ring-sky-600 text-sky-900'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                              {String(member.seatNo).padStart(2, '0')}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {member.name}
                            </span>
                          </div>
                          {isLeader && (
                            <span className="text-xs font-medium text-amber-700 shrink-0">
                              組長
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleLeader(group.id, member.id)}
                          aria-label={isLeader ? `取消 ${member.name} 組長` : `指定 ${member.name} 為組長`}
                          title={isLeader ? '取消組長' : '指定為組長'}
                          className={`p-2 rounded-lg transition-colors shrink-0 ${
                            isLeader
                              ? 'text-amber-500 hover:bg-amber-50'
                              : 'text-slate-300 hover:text-amber-500 hover:bg-slate-50'
                          }`}
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SeatChipProps {
  member: Student;
  position: 'top' | 'bottom';
  isSelected: boolean;
  isLeader: boolean;
  onSelect: () => void;
  onToggleLeader: () => void;
}

function SeatChip({
  member,
  position,
  isSelected,
  isLeader,
  onSelect,
  onToggleLeader,
}: SeatChipProps) {
  return (
    <div className="flex flex-col items-center">
      {position === 'bottom' && (
        <div
          aria-hidden="true"
          className={`w-6 h-1.5 rounded-t-full mb-0.5 ${
            isSelected ? 'bg-sky-500' : 'bg-slate-200'
          }`}
        />
      )}

      <div
        className={`inline-flex items-center rounded-lg border transition-all ${
          isSelected
            ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-600/30 text-sky-950'
            : 'border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300 text-slate-800'
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 rounded-l-lg"
        >
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
            {String(member.seatNo).padStart(2, '0')}
          </span>
          <span className="max-w-[96px] truncate">{member.name}</span>
        </button>
        <button
          type="button"
          onClick={onToggleLeader}
          aria-label={isLeader ? `取消 ${member.name} 組長` : `設 ${member.name} 為組長`}
          title={isLeader ? '組長（點擊取消）' : '設為組長'}
          className={`pr-2 pl-1 py-1.5 rounded-r-lg transition-colors ${
            isLeader
              ? 'text-amber-500'
              : 'text-slate-300 hover:text-amber-500'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
        </button>
      </div>

      {position === 'top' && (
        <div
          aria-hidden="true"
          className={`w-6 h-1.5 rounded-b-full mt-0.5 ${
            isSelected ? 'bg-sky-500' : 'bg-slate-200'
          }`}
        />
      )}
    </div>
  );
}
