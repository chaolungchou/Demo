import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Trash2,
  Undo2,
  Users,
  Disc,
  LayoutList,
} from 'lucide-react';
import { DrawDuration, DrawRecord, DrawVisualMode, Student } from '../types';
import { soundEngine } from '../utils/sound';
import { SpinningWheel } from './SpinningWheel';

interface LuckyDrawViewProps {
  students: Student[];
  allowRepeat: boolean;
  onChangeAllowRepeat: (allow: boolean) => void;
  drawnIds: string[];
  history: DrawRecord[];
  soundEnabled: boolean;
  volume: number;
  onToggleSound: () => void;
  onChangeVolume: (val: number) => void;
  onRecordDraw: (student: Student) => void;
  onResetPool: () => void;
  onClearHistory: () => void;
  onReturnStudentToPool: (studentId: string) => void;
  onGoToRoster: () => void;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  alpha: number;
}

const CONFETTI_COLORS = ['#0284C7', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1', '#F43F5E'];

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function LuckyDrawView({
  students,
  allowRepeat,
  onChangeAllowRepeat,
  drawnIds,
  history,
  soundEnabled,
  volume,
  onToggleSound,
  onChangeVolume,
  onRecordDraw,
  onResetPool,
  onClearHistory,
  onReturnStudentToPool,
  onGoToRoster,
}: LuckyDrawViewProps) {
  const [visualMode, setVisualMode] = useState<DrawVisualMode>('reel');
  const [duration, setDuration] = useState<DrawDuration>(3000);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Reel display state
  const [reelIndex, setReelIndex] = useState(0);
  const [reelSnapshot, setReelSnapshot] = useState<Student[]>([]);
  const [revealedStudent, setRevealedStudent] = useState<Student | null>(null);
  const [revealKey, setRevealKey] = useState(0);

  // Wheel display state
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelSnapshot, setWheelSnapshot] = useState<Student[] | null>(null);

  const rafRef = useRef<number | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiRafRef = useRef<number | null>(null);
  const wheelRotationRef = useRef(0);

  const drawnIdSet = useMemo(() => new Set(drawnIds), [drawnIds]);

  const eligibleStudents = useMemo(() => {
    if (allowRepeat) return students;
    return students.filter((s) => !drawnIdSet.has(s.id));
  }, [students, allowRepeat, drawnIdSet]);

  // Clear stale snapshots when roster or pool resets while idle
  useEffect(() => {
    if (!isSpinning) {
      if (students.length === 0) {
        setRevealedStudent(null);
        setWheelSnapshot(null);
      } else if (revealedStudent && !students.some((s) => s.id === revealedStudent.id)) {
        setRevealedStudent(null);
        setWheelSnapshot(null);
      }
    }
  }, [students, isSpinning, revealedStudent]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (confettiRafRef.current !== null) cancelAnimationFrame(confettiRafRef.current);
    };
  }, []);

  const triggerConfetti = useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const originX = rect.width / 2;
    const originY = rect.height * 0.48;

    const particles: ConfettiParticle[] = Array.from({ length: 48 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.6 + Math.random() * 6.5;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3.2,
        size: 5 + Math.random() * 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        alpha: 1,
      };
    });

    if (confettiRafRef.current !== null) {
      cancelAnimationFrame(confettiRafRef.current);
    }

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, rect.width, rect.height);

      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16; // gentle gravity
        p.vx *= 0.985;
        p.rotation += p.vRot;
        p.alpha = Math.max(0, 1 - elapsed / 1350);

        if (p.alpha > 0.02) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
          ctx.restore();
        }
      }

      if (alive && elapsed < 1400) {
        confettiRafRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
        confettiRafRef.current = null;
      }
    };

    confettiRafRef.current = requestAnimationFrame(animate);
  }, []);

  const startDraw = useCallback(() => {
    if (isSpinning || eligibleStudents.length === 0) return;

    const pool = [...eligibleStudents];
    const winnerIdx = Math.floor(Math.random() * pool.length);
    const winner = pool[winnerIdx];

    setIsSpinning(true);
    setRevealedStudent(null);

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      setWheelSnapshot(pool);
      setRevealedStudent(winner);
      setRevealKey((k) => k + 1);
      setIsSpinning(false);
      soundEngine.playReveal();
      onRecordDraw(winner);
      return;
    }

    if (visualMode === 'wheel') {
      setWheelSnapshot(pool);
      const count = pool.length;
      const sliceAngle = (Math.PI * 2) / count;
      const twoPi = Math.PI * 2;
      const startRot = wheelRotationRef.current;

      const targetMod = (((-(winnerIdx + 0.5) * sliceAngle) % twoPi) + twoPi) % twoPi;
      const jitter = (Math.random() - 0.5) * sliceAngle * 0.45;
      const desiredMod = (((targetMod + jitter) % twoPi) + twoPi) % twoPi;
      const currentMod = ((startRot % twoPi) + twoPi) % twoPi;
      const deltaForward = (desiredMod - currentMod + twoPi) % twoPi;
      const extraTurns = (duration === 1600 ? 4 : duration === 3000 ? 6 : 9) * twoPi;
      const endRot = startRot + extraTurns + deltaForward;

      let lastSliceUnderPointer = Math.floor(
        (((-startRot % twoPi) + twoPi) % twoPi) / sliceAngle
      );
      const startTime = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = easeOutQuart(t);
        const currentRot = startRot + (endRot - startRot) * eased;
        wheelRotationRef.current = currentRot;
        setWheelRotation(currentRot);

        const sliceUnderPointer = Math.floor(
          (((-currentRot % twoPi) + twoPi) % twoPi) / sliceAngle
        );
        if (sliceUnderPointer !== lastSliceUnderPointer) {
          lastSliceUnderPointer = sliceUnderPointer;
          soundEngine.playTick(t);
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          setIsSpinning(false);
          setRevealedStudent(winner);
          setRevealKey((k) => k + 1);
          soundEngine.playReveal();
          triggerConfetti();
          onRecordDraw(winner);
        }
      };

      rafRef.current = requestAnimationFrame(step);
    } else {
      // Slot Reel mode: construct a crisp shuffled sequence ending strictly on `winner`
      const totalSteps = duration === 1600 ? 22 : duration === 3000 ? 34 : 46;
      const sequence: Student[] = [];
      let prevId = '';
      for (let i = 0; i < totalSteps; i++) {
        if (pool.length === 1) {
          sequence.push(pool[0]);
        } else {
          let candidate = pool[Math.floor(Math.random() * pool.length)];
          if (candidate.id === prevId) {
            candidate = pool[(pool.indexOf(candidate) + 1) % pool.length];
          }
          sequence.push(candidate);
          prevId = candidate.id;
        }
      }
      // Guarantee last item is the winner and adjacent slot isn't identical if pool > 1
      if (pool.length > 1 && sequence[sequence.length - 1]?.id === winner.id) {
        sequence[sequence.length - 1] =
          pool[(winnerIdx + 1) % pool.length];
      }
      sequence.push(winner);

      setReelSnapshot(sequence);
      setReelIndex(0);

      let lastStepIdx = -1;
      const startTime = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = easeOutCubic(t);
        const currentStep = Math.min(
          sequence.length - 1,
          Math.floor(eased * (sequence.length - 1))
        );

        if (currentStep !== lastStepIdx) {
          lastStepIdx = currentStep;
          setReelIndex(currentStep);
          if (currentStep < sequence.length - 1) {
            soundEngine.playTick(t);
          }
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          setReelIndex(sequence.length - 1);
          setIsSpinning(false);
          setRevealedStudent(winner);
          setRevealKey((k) => k + 1);
          soundEngine.playReveal();
          triggerConfetti();
          onRecordDraw(winner);
        }
      };

      rafRef.current = requestAnimationFrame(step);
    }
  }, [isSpinning, eligibleStudents, visualMode, duration, onRecordDraw, triggerConfetti]);

  // Keyboard shortcuts: Space to draw, Escape to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        return;
      }

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        if (!isSpinning && eligibleStudents.length > 0) {
          startDraw();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, isSpinning, eligibleStudents.length, startDraw]);

  function handleResetPoolClick() {
    if (isSpinning) return;
    setRevealedStudent(null);
    setWheelSnapshot(null);
    onResetPool();
  }

  function handleSwitchVisualMode(mode: DrawVisualMode) {
    if (isSpinning) return;
    setVisualMode(mode);
    setWheelSnapshot(null);
  }

  const activeWheelList = wheelSnapshot ?? eligibleStudents;
  const activeReelStudent = isSpinning
    ? reelSnapshot[reelIndex] ?? null
    : revealedStudent;
  const prevReelStudent =
    isSpinning && reelIndex > 0 ? reelSnapshot[reelIndex - 1] : null;
  const nextReelStudent =
    isSpinning && reelIndex + 1 < reelSnapshot.length
      ? reelSnapshot[reelIndex + 1]
      : null;

  const isPoolExhausted = !allowRepeat && students.length > 0 && eligibleStudents.length === 0;

  const stageContent = (
    <div
      className={`bg-white border border-slate-200 rounded-xl flex flex-col ${
        isFullscreen ? 'h-full w-full max-w-5xl mx-auto shadow-xl' : ''
      }`}
    >
      {/* Stage Top Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            disabled={isSpinning}
            onClick={() => handleSwitchVisualMode('reel')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              visualMode === 'reel'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            名牌滾動
          </button>
          <button
            type="button"
            disabled={isSpinning}
            onClick={() => handleSwitchVisualMode('wheel')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              visualMode === 'wheel'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            幸運轉盤
          </button>
        </div>

        {/* Unboxed pool metadata */}
        <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
          <span>
            {allowRepeat
              ? `可重複抽取 · 名單共 ${students.length} 位`
              : `剩餘待抽 ${eligibleStudents.length} / ${students.length} 位`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
          aria-label={isFullscreen ? '退出全螢幕投影' : '全螢幕投影模式'}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              退出投影
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              投影模式
            </>
          )}
        </button>
      </div>

      {/* Main Interactive Visual Canvas */}
      <div
        className={`relative flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-hidden ${
          isFullscreen ? 'min-h-[420px]' : 'min-h-[430px]'
        }`}
      >
        {/* Confetti Canvas Overlay */}
        <canvas
          ref={confettiCanvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 w-full h-full z-20"
        />

        {students.length === 0 ? (
          <div className="text-center max-w-sm space-y-3">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-800">尚未匯入學生名單</h3>
            <p className="text-sm text-slate-500">
              請先上傳 CSV 或貼上學生姓名，即可立即開始課堂隨機抽籤。
            </p>
            <button
              type="button"
              onClick={onGoToRoster}
              className="mt-2 px-5 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors"
            >
              前往匯入名單
            </button>
          </div>
        ) : visualMode === 'wheel' ? (
          <div className="flex flex-col items-center justify-center gap-6 z-10 w-full">
            <SpinningWheel
              students={activeWheelList}
              rotationRad={wheelRotation}
              highlightStudentId={!isSpinning ? revealedStudent?.id ?? null : null}
              size={isFullscreen ? 410 : 330}
            />

            <div className="min-h-[56px] flex items-center justify-center text-center">
              <AnimatePresence mode="wait">
                {!isSpinning && revealedStudent ? (
                  <motion.div
                    key={`wheel-winner-${revealKey}`}
                    initial={{ opacity: 0, scale: 0.9, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-xs font-medium text-sky-700 font-mono tabular-nums">
                      中選學生 · 座號 {String(revealedStudent.seatNo).padStart(2, '0')}
                    </span>
                    <span
                      className={`font-bold tracking-tight text-slate-900 mt-0.5 ${
                        isFullscreen ? 'text-5xl' : 'text-3xl'
                      }`}
                    >
                      {revealedStudent.name}
                    </span>
                  </motion.div>
                ) : isSpinning ? (
                  <p className="text-sm font-medium text-slate-500">轉盤旋轉中...</p>
                ) : isPoolExhausted ? (
                  <p className="text-sm font-medium text-amber-700">
                    全班 {students.length} 位學生皆已抽過，請重置抽籤池以進行新一輪。
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    按下下方「開始抽籤」或鍵盤空白鍵旋轉幸運轉盤
                  </p>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          /* Slot Card Reel Stage */
          <div className="flex flex-col items-center justify-center w-full max-w-xl z-10 select-none">
            {isPoolExhausted && !revealedStudent ? (
              <div className="text-center space-y-3 py-8">
                <p className="text-xl font-bold text-slate-900">全班名單已抽取完畢</p>
                <p className="text-sm text-slate-500">
                  在「不重複抽取」模式下，所有 {students.length} 位學生皆已輪流抽過一次。
                </p>
              </div>
            ) : activeReelStudent ? (
              <div className="w-full flex flex-col items-center">
                {/* Upper muted preview slot during rolling */}
                <div className="h-9 flex items-center justify-center overflow-hidden">
                  {isSpinning && prevReelStudent && (
                    <span className="text-lg font-medium text-slate-300 tracking-wide">
                      {prevReelStudent.name}
                    </span>
                  )}
                </div>

                {/* Primary Focal Spotlight */}
                <motion.div
                  key={isSpinning ? `rolling-${reelIndex}` : `reveal-${revealKey}`}
                  initial={
                    isSpinning
                      ? { opacity: 0.7, y: 10, scale: 0.98 }
                      : { opacity: 0.4, scale: 0.88 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={
                    isSpinning
                      ? { duration: 0.06 }
                      : { type: 'spring', stiffness: 380, damping: 24 }
                  }
                  className={`w-full py-10 px-6 rounded-2xl border text-center transition-colors ${
                    !isSpinning && revealedStudent
                      ? 'border-sky-300 bg-sky-50/50'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-mono text-slate-500 tabular-nums mb-2">
                    {!isSpinning && revealedStudent
                      ? `中選名單 · 座號 ${String(activeReelStudent.seatNo).padStart(2, '0')}`
                      : `座號 ${String(activeReelStudent.seatNo).padStart(2, '0')}`}
                  </div>
                  <div
                    className={`font-bold tracking-tight text-slate-900 leading-tight break-words ${
                      isFullscreen
                        ? 'text-6xl sm:text-7xl'
                        : 'text-5xl sm:text-6xl'
                    }`}
                  >
                    {activeReelStudent.name}
                  </div>
                </motion.div>

                {/* Lower muted preview slot during rolling */}
                <div className="h-9 flex items-center justify-center overflow-hidden mt-1">
                  {isSpinning && nextReelStudent ? (
                    <span className="text-lg font-medium text-slate-300 tracking-wide">
                      {nextReelStudent.name}
                    </span>
                  ) : !isSpinning && revealedStudent && isPoolExhausted ? (
                    <span className="text-xs font-medium text-amber-700">
                      此為本輪最後一位待抽學生
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="w-full py-12 px-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center space-y-2">
                <p className="text-xs font-mono text-slate-400 tabular-nums">
                  待抽池已就緒 · {eligibleStudents.length} 位學生
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-400 tracking-tight">
                  準備好抽出下一位同學
                </p>
                <p className="text-xs text-slate-500 pt-1">
                  點擊下方「開始抽籤」或按鍵盤空白鍵開始
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Primary Action Footer */}
      <div className="px-6 py-5 border-t border-slate-200 bg-slate-50/60 rounded-b-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          快捷鍵：<kbd className="font-mono px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700">Space</kbd> 開始抽籤
          {isFullscreen && (
            <>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <kbd className="font-mono px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700">Esc</kbd> 退出投影
            </>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isPoolExhausted ? (
            <button
              type="button"
              onClick={handleResetPoolClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              重置抽籤池，開始新一輪
            </button>
          ) : (
            <button
              type="button"
              disabled={isSpinning || students.length === 0}
              onClick={startDraw}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-semibold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
            >
              <Play className="w-4 h-4 fill-current" />
              {isSpinning ? '隨機抽取中...' : '開始抽籤'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Fullscreen Projection Overlay */}
      {isFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="隨機抽籤全螢幕投影"
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs p-4 sm:p-8 flex items-center justify-center"
        >
          {stageContent}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
            課堂隨機點名抽籤
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            隨機抽出一位學生並搭配動畫與音效提示，支援「不重複」與「可重複」兩種抽取模式。
          </p>
        </div>
      </div>

      {/* Two-Zone Sandbox Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Interactive Stage (8 cols ~ 66%) */}
        <div className="lg:col-span-8">{!isFullscreen && stageContent}</div>

        {/* Right Control & History Deck (4 cols ~ 33%) */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          {/* Repeat Mode Setting */}
          <div className="space-y-2.5">
            <label className="block text-sm font-semibold text-slate-900">
              是否允許重複抽取
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => onChangeAllowRepeat(false)}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  !allowRepeat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                不重複抽取
              </button>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => onChangeAllowRepeat(true)}
                className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  allowRepeat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                可重複抽取
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {allowRepeat
                ? '每次抽籤皆從全班名單中隨機抽出，同一位學生可能再次被抽中。'
                : '已抽中的學生會暫時移出待抽池，直到全班抽完或手動重置。'}
            </p>
          </div>

          {/* Animation Duration */}
          <div className="space-y-2.5 pt-5 border-t border-slate-200">
            <label className="block text-sm font-semibold text-slate-900">
              抽籤動畫節奏
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { value: 1600, label: '快速 1.6秒' },
                  { value: 3000, label: '標準 3秒' },
                  { value: 4500, label: '刺激 4.5秒' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isSpinning}
                  onClick={() => setDuration(opt.value)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
                    duration === opt.value
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sound Controls */}
          <div className="space-y-3 pt-5 border-t border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">音效提示</span>
              <button
                type="button"
                onClick={() => {
                  onToggleSound();
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  soundEnabled
                    ? 'bg-sky-50 border-sky-200 text-sky-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    音效開啟
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    已靜音
                  </>
                )}
              </button>
            </div>

            {soundEnabled && (
              <div className="flex items-center gap-3">
                <label
                  htmlFor="sound-volume-slider"
                  className="text-xs text-slate-500 whitespace-nowrap tabular-nums w-16"
                >
                  音量 {Math.round(volume * 100)}%
                </label>
                <input
                  id="sound-volume-slider"
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                  onMouseUp={() => soundEngine.playTick(0.6)}
                  onTouchEnd={() => soundEngine.playTick(0.6)}
                  className="flex-1 accent-sky-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Draw History */}
          <div className="pt-5 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">抽籤紀錄</h2>
                <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                  累計抽出 {history.length} 次
                  {!allowRepeat && drawnIds.length > 0 && ` · 本輪已抽 ${drawnIds.length} 位`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!allowRepeat && drawnIds.length > 0 && (
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={handleResetPoolClick}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" />
                    重置池
                  </button>
                )}
                {history.length > 0 && (
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={onClearHistory}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                    aria-label="清除抽籤紀錄"
                    title="清除抽籤紀錄"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                尚未有抽籤紀錄，抽出的學生會依序顯示於此。
              </p>
            ) : (
              <ol className="divide-y divide-slate-100 max-h-[260px] overflow-y-auto pr-1">
                {history.map((rec) => {
                  const isExcluded = !allowRepeat && drawnIdSet.has(rec.studentId);
                  return (
                    <li
                      key={rec.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs text-slate-400 tabular-nums w-6 shrink-0">
                          #{rec.round}
                        </span>
                        <span className="font-medium text-slate-800 truncate">
                          {rec.studentName}
                        </span>
                        <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                          ({String(rec.seatNo).padStart(2, '0')}號)
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs text-slate-400 tabular-nums">
                          {rec.drawnAt}
                        </span>
                        {isExcluded && (
                          <button
                            type="button"
                            disabled={isSpinning}
                            onClick={() => onReturnStudentToPool(rec.studentId)}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-sky-700 transition-colors whitespace-nowrap"
                            title="將此學生放回待抽池"
                          >
                            <Undo2 className="w-3 h-3" />
                            放回
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
