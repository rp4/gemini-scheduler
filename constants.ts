import { GlobalConfig, PhaseName, StaffType, ProjectInput } from './types';

export const DEFAULT_STAFF_TYPES: StaffType[] = [
  { id: 'pm', name: 'Portfolio Manager', maxHoursPerWeek: 10, color: 'bg-purple-100 text-purple-800' },
  { id: 'lead', name: 'Audit Lead', maxHoursPerWeek: 40, color: 'bg-blue-100 text-blue-800' },
  { id: 'staff', name: 'Staff Auditor', maxHoursPerWeek: 40, color: 'bg-green-100 text-green-800' },
];

export const DEFAULT_CONFIG: GlobalConfig = {
  year: 2026,
  staffTypes: DEFAULT_STAFF_TYPES,
  phases: [
    {
      name: PhaseName.PRE_PLANNING,
      percentBudget: 10,
      minWeeks: 1,
      maxWeeks: 2,
      staffAllocation: [
        { staffTypeId: 'pm', percentage: 40 },
        { staffTypeId: 'lead', percentage: 60 },
        { staffTypeId: 'staff', percentage: 0 },
      ],
    },
    {
      name: PhaseName.PLANNING,
      percentBudget: 20,
      minWeeks: 2,
      maxWeeks: 4,
      staffAllocation: [
        { staffTypeId: 'pm', percentage: 10 },
        { staffTypeId: 'lead', percentage: 40 },
        { staffTypeId: 'staff', percentage: 50 },
      ],
    },
    {
      name: PhaseName.FIELDWORK,
      percentBudget: 50,
      minWeeks: 4,
      maxWeeks: 8,
      staffAllocation: [
        { staffTypeId: 'pm', percentage: 5 },
        { staffTypeId: 'lead', percentage: 25 },
        { staffTypeId: 'staff', percentage: 70 },
      ],
    },
    {
      name: PhaseName.REPORTING,
      percentBudget: 20,
      minWeeks: 2,
      maxWeeks: 4,
      staffAllocation: [
        { staffTypeId: 'pm', percentage: 20 },
        { staffTypeId: 'lead', percentage: 50 },
        { staffTypeId: 'staff', percentage: 30 },
      ],
    },
  ],
};

// Helper to deep copy phases
const getBasePhases = () => JSON.parse(JSON.stringify(DEFAULT_CONFIG.phases));

export const INITIAL_PROJECTS: ProjectInput[] = [
  { id: '1', name: 'Cybersecurity Review', budgetHours: 400, startWeekOffset: 0, locked: false, phasesConfig: getBasePhases() },
  { id: '2', name: 'Financial Controls 2026', budgetHours: 600, startWeekOffset: 4, locked: false, phasesConfig: getBasePhases() },
  { id: '3', name: 'HR Compliance Audit', budgetHours: 300, startWeekOffset: 12, locked: false, phasesConfig: getBasePhases() },
];