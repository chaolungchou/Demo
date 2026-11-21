import { useEffect, useRef } from 'react';
import { Student } from '../types';

interface SpinningWheelProps {
  students: Student[];
  rotationRad: number;
  highlightStudentId?: string | null;
  size?: number;
}

// Curated classroom-legible pastel-neutral slice palette paired with dark ink for >7:1 WCAG AAA contrast
const SLICE_COLORS = [
  '#E0F2FE', // sky-100
  '#F1F5F9', // slate-100
  '#ECFDF5', // emerald-50
  '#FEF3C7', // amber-100
  '#EEF2FF', // indigo-50
  '#FFF1F2', // rose-50
];

export function SpinningWheel({
  students,
  rotationRad,
  highlightStudentId,
  size = 340,
}: SpinningWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 14;

    ctx.clearRect(0, 0, size, size);

    // Outer subtle rim
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#CBD5E1';
    ctx.stroke();

    const count = students.length;
    if (count === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.fillStyle = '#64748B';
      ctx.font = '500 14px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('待抽名單為空', cx, cy);
      return;
    }

    const sliceAngle = (Math.PI * 2) / count;
    // Offset by -PI/2 so slice 0 starts at 12 o'clock when rotationRad === 0
    const baseOffset = -Math.PI / 2 + rotationRad;

    students.forEach((student, i) => {
      const startAngle = baseOffset + i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      const isHighlighted = highlightStudentId === student.id;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = isHighlighted
        ? '#0284C7'
        : SLICE_COLORS[i % SLICE_COLORS.length];
      ctx.fill();

      ctx.lineWidth = count > 32 ? 0.75 : 1.25;
      ctx.strokeStyle = '#CBD5E1';
      ctx.stroke();

      // Label inside slice
      const midAngle = startAngle + sliceAngle / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);

      const fontSize =
        count <= 10 ? 15 : count <= 18 ? 13 : count <= 28 ? 11.5 : count <= 40 ? 9.5 : 8;
      ctx.font = `${isHighlighted ? '700' : '600'} ${fontSize}px "Noto Sans TC", "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = isHighlighted ? '#FFFFFF' : '#0F172A';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const maxLabelChars = count <= 16 ? 7 : count <= 30 ? 5 : 4;
      const label =
        student.name.length > maxLabelChars
          ? `${student.name.slice(0, maxLabelChars)}…`
          : student.name;

      ctx.fillText(label, radius - 14, 0);
      ctx.restore();
    });

    // Rim pegs at each slice boundary for crisp visual feedback
    if (count <= 40) {
      for (let i = 0; i < count; i++) {
        const angle = baseOffset + i * sliceAngle;
        const px = cx + Math.cos(angle) * (radius - 2);
        const py = cy + Math.sin(angle) * (radius - 2);
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#94A3B8';
        ctx.fill();
      }
    }

    // Center hub cap
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0284C7';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0284C7';
    ctx.fill();
  }, [students, rotationRad, highlightStudentId, size]);

  return (
    <div className="relative inline-flex items-center justify-center select-none">
      {/* Top fixed pointer indicator */}
      <div
        aria-hidden="true"
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 drop-shadow-sm"
      >
        <svg width="28" height="30" viewBox="0 0 28 30" fill="none">
          <path
            d="M14 28L3 6C2.2 4.3 3.4 2.5 5.2 2.5H22.8C24.6 2.5 25.8 4.3 25 6L14 28Z"
            fill="#0284C7"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
        </svg>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block max-w-full h-auto"
        aria-label="隨機抽籤轉盤"
      />
    </div>
  );
}
