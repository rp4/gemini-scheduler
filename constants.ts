

import { GlobalConfig, PhaseName, StaffType, ProjectInput } from './types';

export const TEAMS = ['Finance', 'IT', 'Operations', 'Compliance', 'General'];

export const SKILLS_LIST = [
  'Anti-Money Laundering (AML)',
  'Cloud Security',
  'Communication',
  'Cybersecurity',
  'Data Analytics',
  'Enterprise Risk Management',
  'Financial Accounting',
  'Fraud Investigation',
  'Governance',
  'Internal Controls (SOX)',
  'IT General Controls',
  'Process Improvement',
  'Project Management',
  'Python/R',
  'Regulatory Compliance',
  'SQL',
];

export const DEFAULT_STAFF_TYPES: StaffType[] = [
  { id: 'pm', name: 'Alex Johnson', role: 'Portfolio Manager', maxHoursPerWeek: 10, color: 'bg-purple-100 text-purple-800', team: 'Finance' },
  { id: 'lead', name: 'Sarah Miller', role: 'Audit Lead', maxHoursPerWeek: 40, color: 'bg-blue-100 text-blue-800', team: 'IT' },
  { id: 'staff', name: 'Mike Davis', role: 'Senior Auditor', maxHoursPerWeek: 40, color: 'bg-green-100 text-green-800', team: 'Operations' },
  { id: 'placeholder', name: 'Placeholder', role: 'Unassigned', maxHoursPerWeek: 40, color: 'bg-slate-200 text-slate-500', team: 'General' },
];

export const DEFAULT_CONFIG: GlobalConfig = {
  year: 2026,
  staffTypes: DEFAULT_STAFF_TYPES,
  skills: SKILLS_LIST,
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
        { staffTypeId: 'placeholder', percentage: 0 },
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
        { staffTypeId: 'placeholder', percentage: 0 },
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
        { staffTypeId: 'placeholder', percentage: 0 },
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
        { staffTypeId: 'placeholder', percentage: 0 },
      ],
    },
  ],
};

// Helper to deep copy phases
const getBasePhases = () => JSON.parse(JSON.stringify(DEFAULT_CONFIG.phases));

export const INITIAL_PROJECTS: ProjectInput[] = [
  { id: '1', name: 'Cybersecurity Review', budgetHours: 400, startWeekOffset: 0, locked: false, phasesConfig: getBasePhases(), team: 'IT', requiredSkills: ['Cybersecurity', 'IT General Controls'] },
  { id: '2', name: 'Financial Controls 2026', budgetHours: 600, startWeekOffset: 4, locked: false, phasesConfig: getBasePhases(), team: 'Finance', requiredSkills: ['Financial Accounting', 'Internal Controls (SOX)'] },
  { id: '3', name: 'HR Compliance Audit', budgetHours: 300, startWeekOffset: 12, locked: false, phasesConfig: getBasePhases(), team: 'Operations', requiredSkills: ['Regulatory Compliance', 'Communication'] },
];