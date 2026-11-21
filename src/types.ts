export type ActiveView = 'draw' | 'group' | 'roster';

export interface Student {
  id: string;
  seatNo: number;
  name: string;
}

export interface DrawRecord {
  id: string;
  studentId: string;
  studentName: string;
  seatNo: number;
  drawnAt: string;
  round: number;
}

export type DrawVisualMode = 'reel' | 'wheel';
export type DrawDuration = 1600 | 3000 | 4500;

export interface GroupItem {
  id: string;
  index: number;
  title: string;
  colorIndex: number;
  members: Student[];
  leaderId: string | null;
}

export type RemainderStrategy = 'distribute' | 'separate';
export type GroupVisualMode = 'tables' | 'grid';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'warning';
}
