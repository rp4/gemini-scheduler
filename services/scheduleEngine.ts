import { 
  GlobalConfig, 
  ProjectInput, 
  ScheduleData, 
  ScheduleRow, 
  PhaseName, 
  ScheduleCell 
} from '../types';
import { startOfYear, addWeeks, startOfWeek } from 'date-fns';

/**
 * Helper to get weekly allocations for all projects/staff without generating full UI structure.
 * Used by optimization algorithm to evaluate schedule "cost".
 */
const calculateWeeklyAggregates = (projects: ProjectInput[], config: GlobalConfig) => {
    // Initialize weekly buckets for each staff type
    // Map<StaffTypeId, number[]> where number[] is 53 weeks of hours
    const staffLoads: Record<string, number[]> = {};
    config.staffTypes.forEach(st => {
        staffLoads[st.id] = new Array(53).fill(0);
    });

    projects.forEach(project => {
        let currentWeekIndex = project.startWeekOffset;
        
        // Use project-specific phases or fallback to global if missing (though type says it's there)
        const phases = project.phasesConfig || config.phases;

        phases.forEach(phaseConfig => {
            const phaseTotalHours = (project.budgetHours * phaseConfig.percentBudget) / 100;
            let duration = phaseConfig.maxWeeks;
            
            // If duration is 0, skip
            if (duration <= 0) return;

            phaseConfig.staffAllocation.forEach(sa => {
                const staffHoursTotal = (phaseTotalHours * sa.percentage) / 100;
                if (staffHoursTotal <= 0) return;
                
                const rawWeekly = staffHoursTotal / duration;
                // Mimic the rounding logic of the main engine to ensure accuracy
                let baseWeekly = Math.round(rawWeekly / 4) * 4;
                if (baseWeekly === 0 && rawWeekly > 0) baseWeekly = 4;

                for (let w = 0; w < duration; w++) {
                    const weekIdx = currentWeekIndex + w;
                    if (weekIdx < 53 && weekIdx >= 0) {
                        if (!staffLoads[sa.staffTypeId]) staffLoads[sa.staffTypeId] = new Array(53).fill(0);
                         staffLoads[sa.staffTypeId][weekIdx] += baseWeekly;
                    }
                }
            });
            currentWeekIndex += duration;
        });
    });
    return staffLoads;
};

/**
 * Optimizes the schedule by adjusting start weeks of unlocked projects.
 * Uses a randomized hill climbing approach to minimize sum of squared weekly hours (variance).
 * Enforces that projects must finish within the year (week 52).
 */
export const optimizeSchedule = (
  currentProjects: ProjectInput[],
  config: GlobalConfig
): ProjectInput[] => {
    // Deep copy
    let bestProjects = currentProjects.map(p => ({ ...p }));
    
    const getCost = (projs: ProjectInput[]) => {
        const loads = calculateWeeklyAggregates(projs, config);
        let cost = 0;
        // Calculate Sum of Squares for each staff type to penalize peaks
        Object.values(loads).forEach(weeks => {
            weeks.forEach(hours => {
                cost += (hours * hours);
            });
        });
        return cost;
    };

    let bestCost = getCost(bestProjects);
    
    // Number of iterations
    const iterations = 5000;

    // Helper to calculate total duration of a project
    const getProjectDuration = (p: ProjectInput) => {
        const phases = p.phasesConfig || config.phases;
        return phases.reduce((sum, phase) => sum + phase.maxWeeks, 0);
    };

    // Pre-calculate constraints
    // We want projectStart + duration <= 52 (assuming 52 weeks/year)
    // So maxStart = 52 - duration.
    const projectConstraints = bestProjects.map((p, i) => {
        const duration = getProjectDuration(p);
        const maxStart = Math.max(0, 52 - duration);
        return { 
            index: i,
            duration,
            maxStart
        };
    });

    const unlockedIndices = bestProjects.map((p, i) => p.locked ? -1 : i).filter(i => i !== -1);

    if (unlockedIndices.length === 0) return currentProjects;

    for (let i = 0; i < iterations; i++) {
        // Pick a random unlocked project
        const idx = unlockedIndices[Math.floor(Math.random() * unlockedIndices.length)];
        const originalOffset = bestProjects[idx].startWeekOffset;
        const constraint = projectConstraints[idx];
        
        // Propose move: Pick a random week in the VALID range [0, maxStart]
        const newOffset = Math.floor(Math.random() * (constraint.maxStart + 1));
        
        if (newOffset === originalOffset) continue;

        bestProjects[idx].startWeekOffset = newOffset;
        const newCost = getCost(bestProjects);

        if (newCost < bestCost) {
            bestCost = newCost;
            // Keep the change
        } else {
            bestProjects[idx].startWeekOffset = originalOffset; // Revert
        }
    }

    // One final pass to fix any originally invalid offsets (if they were initially set manually out of bounds)
    // even if optimization didn't touch them (though the loop above covers unlocked ones)
    bestProjects.forEach((p, idx) => {
        if (!p.locked) {
             const constraint = projectConstraints[idx];
             if (p.startWeekOffset > constraint.maxStart) {
                 p.startWeekOffset = constraint.maxStart;
             }
        }
    });

    return bestProjects;
};

/**
 * Core scheduling algorithm.
 * 1. Generates all Mondays for the configured year.
 * 2. Iterates through projects.
 * 3. Calculates phase durations and hour allocations.
 * 4. Splits resources if max hours exceeded.
 * 5. Rounds to nearest 4.
 */
export const generateSchedule = (
  projects: ProjectInput[],
  config: GlobalConfig
): ScheduleData => {
  const { year, staffTypes } = config;
  
  // 1. Generate Timeline Headers (Mondays)
  const startDate = startOfWeek(startOfYear(new Date(year, 0, 1)), { weekStartsOn: 1 });
  let currentMonday = startDate;
  if (currentMonday.getFullYear() < year) {
      currentMonday = addWeeks(currentMonday, 1);
  }
  
  const headers: string[] = [];
  // Generate 53 weeks to be safe
  for (let i = 0; i < 53; i++) {
    const d = addWeeks(currentMonday, i);
    // Allow 53 weeks if the year has it, but generally typically 52
    if (d.getFullYear() > year) break; 
    headers.push(d.toISOString());
  }

  const rows: ScheduleRow[] = [];

  projects.forEach((project) => {
    // Determine Start Date based on offset
    const projectStartMondayIndex = Math.max(0, Math.min(project.startWeekOffset, headers.length - 1));
    
    let currentWeekIndex = projectStartMondayIndex;
    
    const projectPhasesDetails: { 
      name: PhaseName, 
      durationWeeks: number, 
      startIndex: number,
      endIndex: number,
      totalHours: number,
      allocations: { staffTypeId: string, totalHours: number }[] 
    }[] = [];

    // Use project-specific phases
    const phases = project.phasesConfig || config.phases;

    phases.forEach(phaseConfig => {
        const phaseTotalHours = (project.budgetHours * phaseConfig.percentBudget) / 100;
        
        // Calculate ideal duration based on Max Weeks
        let duration = phaseConfig.maxWeeks;
        
        const startIndex = currentWeekIndex;
        let endIndex = startIndex + duration;
        
        projectPhasesDetails.push({
            name: phaseConfig.name,
            durationWeeks: duration,
            startIndex,
            endIndex,
            totalHours: phaseTotalHours,
            allocations: phaseConfig.staffAllocation.map(sa => ({
                staffTypeId: sa.staffTypeId,
                totalHours: (phaseTotalHours * sa.percentage) / 100
            }))
        });

        currentWeekIndex += duration;
    });

    // Now generate rows for each staff type
    staffTypes.forEach(staff => {
        // Check if this staff has any hours in this project
        const totalStaffHoursInProject = projectPhasesDetails.reduce((acc, p) => {
            const alloc = p.allocations.find(a => a.staffTypeId === staff.id);
            return acc + (alloc ? alloc.totalHours : 0);
        }, 0);

        if (totalStaffHoursInProject <= 0) return;

        // Calculate weekly load per phase
        // We look for the MAX required weekly hours across any phase
        let maxWeeklyLoadNeeded = 0;

        projectPhasesDetails.forEach(phase => {
            if (phase.durationWeeks <= 0) return;
            const alloc = phase.allocations.find(a => a.staffTypeId === staff.id);
            if (alloc && alloc.totalHours > 0) {
                const weekly = alloc.totalHours / phase.durationWeeks;
                if (weekly > maxWeeklyLoadNeeded) maxWeeklyLoadNeeded = weekly;
            }
        });

        // Determine number of splits needed
        const numSplits = Math.ceil(maxWeeklyLoadNeeded / staff.maxHoursPerWeek);
        
        for (let i = 0; i < numSplits; i++) {
            const rowCells: ScheduleCell[] = headers.map(d => ({ date: d, hours: 0, phase: null }));
            let rowTotalHours = 0;

            projectPhasesDetails.forEach(phase => {
                if (phase.durationWeeks <= 0) return;
                
                const alloc = phase.allocations.find(a => a.staffTypeId === staff.id);
                if (!alloc || alloc.totalHours <= 0) return;

                // Total hours for this staff type in this phase
                const totalHoursForType = alloc.totalHours;
                
                // Split hours among the N employees
                const hoursForThisEmployee = totalHoursForType / numSplits;
                
                const rawWeekly = hoursForThisEmployee / phase.durationWeeks;

                // Round to nearest 4 logic
                let baseWeekly = Math.round(rawWeekly / 4) * 4;
                if (baseWeekly === 0 && rawWeekly > 0) baseWeekly = 4; // Minimum allocation if required

                // Distribute these hours across the phase weeks
                for (let w = 0; w < phase.durationWeeks; w++) {
                    const weekIdx = phase.startIndex + w;
                    if (weekIdx < rowCells.length) {
                        rowCells[weekIdx].hours = baseWeekly;
                        rowCells[weekIdx].phase = phase.name;
                        rowTotalHours += baseWeekly;
                    }
                }
            });

            rows.push({
                rowId: `${project.id}-${staff.id}-${i}`,
                projectName: project.name,
                staffTypeName: staff.name,
                staffIndex: i + 1,
                cells: rowCells,
                totalHours: rowTotalHours
            });
        }
    });
  });

  return { headers, rows };
};