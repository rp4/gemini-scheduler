export enum PhaseName {
  PRE_PLANNING = 'Pre-Planning',
  PLANNING = 'Planning',
  FIELDWORK = 'Fieldwork',
  REPORTING = 'Reporting'
}

export interface StaffType {
  id: string;
  name: string;
  maxHoursPerWeek: number;
  color: string;
}

export interface StaffPhaseConfig {
  staffTypeId: string;
  percentage: number; // 0-100, represents % of the Phase's hours assigned to this staff
}

export interface PhaseConfig {
  name: PhaseName;
  percentBudget: number; // 0-100
  minWeeks: number;
  maxWeeks: number;
  staffAllocation: StaffPhaseConfig[];
}

export interface GlobalConfig {
  year: number;
  phases: PhaseConfig[];
  staffTypes: StaffType[];
}

export interface ProjectInput {
  id: string;
  name: string;
  budgetHours: number;
  startWeekOffset: number; // User preference: delay start by X weeks from Jan 1
  locked: boolean;
  phasesConfig: PhaseConfig[]; // Snapshot of configuration at creation
}

// Structure for the output table
export interface ScheduleCell {
  date: string; // ISO Date string for the Monday
  hours: number;
  phase: PhaseName | null;
}

export interface ScheduleRow {
  rowId: string;
  projectName: string;
  staffTypeName: string;
  staffIndex: number; // If split into multiple employees (1, 2, 3...)
  cells: ScheduleCell[];
  totalHours: number;
}

export interface ScheduleData {
  headers: string[]; // Date strings for Mondays
  rows: ScheduleRow[];
}