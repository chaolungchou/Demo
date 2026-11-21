import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActiveView,
  DrawRecord,
  GroupItem,
  RemainderStrategy,
  Student,
  ToastMessage,
} from './types';
import { createStudentsFromNames, SAMPLE_STUDENT_NAMES } from './utils/csv';
import { soundEngine } from './utils/sound';
import { TopBar } from './components/TopBar';
import { RosterPanel } from './components/RosterPanel';
import { LuckyDrawView } from './components/LuckyDrawView';
import { AutoGroupView } from './components/AutoGroupView';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const STORAGE_KEY_STUDENTS = 'classroom_toolkit_students_v1';
const STORAGE_KEY_IS_SAMPLE = 'classroom_toolkit_is_sample_v1';

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildRandomGroups(
  students: Student[],
  groupSize: number,
  strategy: RemainderStrategy
): GroupItem[] {
  const total = students.length;
  if (total < 2) return [];

  const safeSize = Math.max(2, Math.min(groupSize, total));
  const shuffled = shuffleArray(students);

  const buckets: Student[][] = [];
  const baseCount = Math.floor(total / safeSize);
  const remainder = total % safeSize;

  if (remainder === 0) {
    for (let i = 0; i < baseCount; i++) {
      buckets.push(shuffled.slice(i * safeSize, (i + 1) * safeSize));
    }
  } else if (strategy === 'separate' || baseCount === 0) {
    for (let i = 0; i < total; i += safeSize) {
      buckets.push(shuffled.slice(i, i + safeSize));
    }
  } else {
    // Evenly distribute remainder across the baseCount groups
    const extraBase = Math.floor(remainder / baseCount);
    const extraOneCount = remainder % baseCount;
    let cursor = 0;
    for (let i = 0; i < baseCount; i++) {
      const sizeForThisGroup = safeSize + extraBase + (i < extraOneCount ? 1 : 0);
      buckets.push(shuffled.slice(cursor, cursor + sizeForThisGroup));
      cursor += sizeForThisGroup;
    }
  }

  return buckets.map((members, idx) => ({
    id: `grp-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`,
    index: idx + 1,
    title: `第 ${idx + 1} 組`,
    colorIndex: idx,
    members,
    leaderId: null,
  }));
}

function loadInitialRoster(): { students: Student[]; isSample: boolean } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_STUDENTS);
    const savedSample = localStorage.getItem(STORAGE_KEY_IS_SAMPLE);
    if (saved) {
      const parsed = JSON.parse(saved) as Student[];
      if (Array.isArray(parsed)) {
        return {
          students: parsed,
          isSample: savedSample === 'true',
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    students: createStudentsFromNames(SAMPLE_STUDENT_NAMES),
    isSample: true,
  };
}

export default function App() {
  const initial = loadInitialRoster();

  const [activeView, setActiveView] = useState<ActiveView>('draw');
  const [students, setStudents] = useState<Student[]>(initial.students);
  const [isUsingSample, setIsUsingSample] = useState<boolean>(initial.isSample);

  // Lucky Draw state
  const [allowRepeat, setAllowRepeat] = useState<boolean>(false);
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const [history, setHistory] = useState<DrawRecord[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.65);

  // Auto Group state
  const [groupSize, setGroupSize] = useState<number>(4);
  const [remainderStrategy, setRemainderStrategy] =
    useState<RemainderStrategy>('distribute');
  const [groups, setGroups] = useState<GroupItem[]>([]);

  // Toast feedback
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const rosterFileInputRef = useRef<HTMLInputElement | null>(null);

  // Persist roster to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
      localStorage.setItem(STORAGE_KEY_IS_SAMPLE, String(isUsingSample));
    } catch {
      // ignore quota errors
    }
  }, [students, isUsingSample]);

  // Sync audio engine
  useEffect(() => {
    soundEngine.setEnabled(soundEnabled);
    soundEngine.setVolume(volume);
  }, [soundEnabled, volume]);

  const notify = useCallback(
    (text: string, tone: 'info' | 'success' | 'warning' = 'info') => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ id: String(Date.now()), text, tone });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 3200);
    },
    []
  );

  // Roster mutations
  const handleReplaceStudents = useCallback((names: string[], isSample = false) => {
    const nextStudents = createStudentsFromNames(names);
    setStudents(nextStudents);
    setIsUsingSample(isSample);
    setDrawnIds([]);
    setHistory([]);
    setGroups([]);
  }, []);

  const handleAppendStudents = useCallback((names: string[]) => {
    const cleaned = names.map((n) => n.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    setStudents((prev) => {
      const startSeat = prev.length + 1;
      const appended: Student[] = cleaned.map((name, idx) => ({
        id: `stu-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        seatNo: startSeat + idx,
        name,
      }));
      return [...prev, ...appended];
    });
    setIsUsingSample(false);
    setGroups([]);
  }, []);

  const handleAddSingleStudent = useCallback((name: string) => {
    setStudents((prev) => [
      ...prev,
      {
        id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        seatNo: prev.length + 1,
        name,
      },
    ]);
    setIsUsingSample(false);
    setGroups([]);
  }, []);

  const handleRemoveStudent = useCallback((id: string) => {
    setStudents((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, seatNo: idx + 1 }))
    );
    setDrawnIds((prev) => prev.filter((did) => did !== id));
    setGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          members: g.members.filter((m) => m.id !== id),
          leaderId: g.leaderId === id ? null : g.leaderId,
        }))
        .filter((g) => g.members.length > 0)
    );
  }, []);

  const handleDeduplicateStudents = useCallback(() => {
    setStudents((prev) => {
      const seen = new Set<string>();
      const unique: Student[] = [];
      for (const s of prev) {
        if (!seen.has(s.name)) {
          seen.add(s.name);
          unique.push(s);
        }
      }
      return unique.map((s, idx) => ({ ...s, seatNo: idx + 1 }));
    });
    setGroups([]);
    notify('已移除重複的學生姓名', 'success');
  }, [notify]);

  // Lucky Draw handlers
  const handleRecordDraw = useCallback((student: Student) => {
    const now = new Date();
    const drawnAt = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    setDrawnIds((prev) => (prev.includes(student.id) ? prev : [...prev, student.id]));
    setHistory((prev) => [
      {
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        seatNo: student.seatNo,
        drawnAt,
        round: prev.length + 1,
      },
      ...prev,
    ]);
  }, []);

  const handleResetPool = useCallback(() => {
    setDrawnIds([]);
    notify('已重置待抽池，全班學生可重新參與抽籤', 'info');
  }, [notify]);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    notify('已清除抽籤紀錄', 'info');
  }, [notify]);

  const handleReturnStudentToPool = useCallback(
    (studentId: string) => {
      const target = students.find((s) => s.id === studentId);
      setDrawnIds((prev) => prev.filter((id) => id !== studentId));
      if (target) {
        notify(`已將「${target.name}」放回待抽池`, 'info');
      }
    },
    [students, notify]
  );

  // Auto Group handlers
  const handleGenerateGroups = useCallback(
    (size: number, strategy: RemainderStrategy) => {
      const next = buildRandomGroups(students, size, strategy);
      setGroups(next);
    },
    [students]
  );

  const handleSwapStudents = useCallback(
    (
      first: { groupId: string; studentId: string },
      second: { groupId: string; studentId: string }
    ) => {
      setGroups((prev) => {
        let firstStudent: Student | undefined;
        let secondStudent: Student | undefined;

        for (const g of prev) {
          if (g.id === first.groupId) {
            firstStudent = g.members.find((m) => m.id === first.studentId);
          }
          if (g.id === second.groupId) {
            secondStudent = g.members.find((m) => m.id === second.studentId);
          }
        }

        if (!firstStudent || !secondStudent) return prev;

        return prev.map((g) => {
          if (g.id !== first.groupId && g.id !== second.groupId) return g;

          const updatedMembers = g.members.map((m) => {
            if (g.id === first.groupId && m.id === first.studentId) {
              return secondStudent!;
            }
            if (g.id === second.groupId && m.id === second.studentId) {
              return firstStudent!;
            }
            return m;
          });

          let nextLeaderId = g.leaderId;
          if (g.id === first.groupId && g.leaderId === first.studentId) {
            nextLeaderId = null;
          }
          if (g.id === second.groupId && g.leaderId === second.studentId) {
            nextLeaderId = null;
          }

          return {
            ...g,
            members: updatedMembers,
            leaderId: nextLeaderId,
          };
        });
      });
    },
    []
  );

  const handleToggleLeader = useCallback((groupId: string, studentId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          leaderId: g.leaderId === studentId ? null : studentId,
        };
      })
    );
  }, []);

  const handleRandomizeLeaders = useCallback(() => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.members.length === 0) return g;
        const picked = g.members[Math.floor(Math.random() * g.members.length)];
        return { ...g, leaderId: picked.id };
      })
    );
  }, []);

  const handleRenameGroup = useCallback((groupId: string, title: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, title } : g))
    );
  }, []);

  const handleQuickImport = useCallback(() => {
    if (activeView === 'roster') {
      rosterFileInputRef.current?.click();
    } else {
      setActiveView('roster');
    }
  }, [activeView]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeView={activeView}
        onSelectView={setActiveView}
        onQuickImport={handleQuickImport}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'draw' && (
          <LuckyDrawView
            students={students}
            allowRepeat={allowRepeat}
            onChangeAllowRepeat={setAllowRepeat}
            drawnIds={drawnIds}
            history={history}
            soundEnabled={soundEnabled}
            volume={volume}
            onToggleSound={() => setSoundEnabled((prev) => !prev)}
            onChangeVolume={setVolume}
            onRecordDraw={handleRecordDraw}
            onResetPool={handleResetPool}
            onClearHistory={handleClearHistory}
            onReturnStudentToPool={handleReturnStudentToPool}
            onGoToRoster={() => setActiveView('roster')}
          />
        )}

        {activeView === 'group' && (
          <AutoGroupView
            students={students}
            groups={groups}
            groupSize={groupSize}
            remainderStrategy={remainderStrategy}
            onChangeGroupSize={setGroupSize}
            onChangeRemainderStrategy={setRemainderStrategy}
            onGenerateGroups={handleGenerateGroups}
            onSwapStudents={handleSwapStudents}
            onToggleLeader={handleToggleLeader}
            onRandomizeLeaders={handleRandomizeLeaders}
            onRenameGroup={handleRenameGroup}
            onGoToRoster={() => setActiveView('roster')}
            onNotify={notify}
          />
        )}

        {activeView === 'roster' && (
          <RosterPanel
            students={students}
            isUsingSample={isUsingSample}
            onReplaceStudents={handleReplaceStudents}
            onAppendStudents={handleAppendStudents}
            onRemoveStudent={handleRemoveStudent}
            onAddSingleStudent={handleAddSingleStudent}
            onDeduplicateStudents={handleDeduplicateStudents}
            onNavigate={setActiveView}
            onNotify={notify}
            fileInputTriggerRef={rosterFileInputRef}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>課堂抽籤與分組工具 · 所有學生名單僅儲存於您的本機瀏覽器中</span>
          <div className="flex items-center gap-4 tabular-nums">
            <span>目前名單：{students.length} 位學生</span>
            <button
              type="button"
              onClick={() => setActiveView('roster')}
              className="text-sky-700 hover:underline font-medium"
            >
              管理名單
            </button>
          </div>
        </div>
      </footer>

      {/* Quiet Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-2.5"
        >
          {toast.tone === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          {toast.tone === 'warning' && (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          {toast.tone === 'info' && (
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
