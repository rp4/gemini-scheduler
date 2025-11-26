
import { 
  GlobalConfig, 
  ProjectInput, 
  ScheduleData, 
  ScheduleRow, 
  PhaseName, 
  ScheduleCell,
  ProjectOverrides
} from '../types';
import { startOfYear, addWeeks, startOfWeek } from 'date-fns';

/**
 * Helper to get weekly allocations for all projects/staff without generating full UI structure.
 * Used by optimization algorithm to evaluate schedule "cost".
 */
const calculateWeeklyAggregates = (projects: ProjectInput[], config: GlobalConfig) => {
    const staffLoads: Record<string, number[]> = {};
    config.staffTypes.forEach(st => {
        staffLoads[st.id] = new Array(53).fill(0);
    });

    projects.forEach(project => {
        let currentWeekIndex = project.startWeekOffset;
        const phases = project.phasesConfig || config.phases;

        phases.forEach(phaseConfig => {
            const phaseTotalHours = (project.budgetHours * phaseConfig.percentBudget) / 100;
            let duration = phaseConfig.maxWeeks;
            
            if (duration <= 0) return;

            phaseConfig.staffAllocation.forEach(sa => {
                const staffHoursTotal = (phaseTotalHours * sa.percentage) / 100;
                if (staffHoursTotal <= 0) return;
                
                const rawWeekly = staffHoursTotal / duration;
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
 * Assigns real staff to placeholder slots based on constraints and optimization goals.
 */
const assignStaffToPlaceholders = (projects: ProjectInput[], config: GlobalConfig) => {
    const workingProjects = JSON.parse(JSON.stringify(projects));
    const warnings: string[] = [];
    
    // 1. Calculate Initial Loads based on current assignments
    const weeklyLoads = calculateWeeklyAggregates(workingProjects, config);

    // 2. Identify Tasks (Placeholder slots)
    interface Task {
        projectId: string;
        projectName: string;
        phaseIndex: number;
        allocIndex: number;
        startWeek: number;
        duration: number;
        hoursPerWeek: number;
        requiredSkills: string[];
        team: string;
    }

    const tasks: Task[] = [];

    workingProjects.forEach((p: ProjectInput) => {
        const phases = p.phasesConfig || config.phases;
        let currentWeek = p.startWeekOffset;
        
        phases.forEach((phase: any, pIdx: number) => {
            const phaseTotalHours = (p.budgetHours * phase.percentBudget) / 100;
            const duration = phase.maxWeeks;
            
            if (duration > 0) {
                 phase.staffAllocation.forEach((alloc: any, aIdx: number) => {
                     if (alloc.staffTypeId === 'placeholder' && alloc.percentage > 0) {
                         const staffHoursTotal = (phaseTotalHours * alloc.percentage) / 100;
                         let hoursPerWeek = staffHoursTotal / duration;
                         // Round to nearest 4 for realistic scheduling
                         hoursPerWeek = Math.round(hoursPerWeek / 4) * 4;
                         if (hoursPerWeek === 0 && staffHoursTotal > 0) hoursPerWeek = 4;

                         tasks.push({
                             projectId: p.id,
                             projectName: p.name,
                             phaseIndex: pIdx,
                             allocIndex: aIdx,
                             startWeek: currentWeek,
                             duration: duration,
                             hoursPerWeek,
                             requiredSkills: p.requiredSkills || [],
                             team: p.team || 'General'
                         });
                     }
                 });
            }
            currentWeek += duration;
        });
    });

    // 3. Sort Tasks by Total Effort Descending (Assign big chunks first)
    tasks.sort((a, b) => (b.hoursPerWeek * b.duration) - (a.hoursPerWeek * a.duration));

    // 4. Optimization Loop
    tasks.forEach(task => {
        // Find assigned staff on this project to exclude (Constraint: cannot be assigned twice)
        const project = workingProjects.find((p: ProjectInput) => p.id === task.projectId);
        const assignedStaff = new Set<string>();
        if (project && project.phasesConfig) {
             project.phasesConfig.forEach((ph: any) => {
                 ph.staffAllocation.forEach((sa: any) => {
                     if (sa.staffTypeId !== 'placeholder') assignedStaff.add(sa.staffTypeId);
                 });
             });
        }

        const candidates = config.staffTypes.filter(s => 
            s.id !== 'placeholder' && 
            !assignedStaff.has(s.id)
        );

        let bestCandidate = null;
        let bestScore = -Infinity;

        candidates.forEach(candidate => {
            let score = 0;

            // 1. Team Match Bonus
            if (candidate.team === task.team) score += 50;

            // 2. Skill Match Bonus
            if (task.requiredSkills.length > 0 && candidate.skills) {
                task.requiredSkills.forEach(skill => {
                    const level = candidate.skills?.[skill];
                    if (level === 'Beginner') score += 10;
                    if (level === 'Intermediate') score += 20;
                    if (level === 'Advanced') score += 30;
                });
            }

            // 3. Overtime Penalty & Utilization Reward
            let overtimePenalty = 0;
            let utilizationReward = 0;
            
            for (let w = 0; w < task.duration; w++) {
                const weekIdx = task.startWeek + w;
                if (weekIdx < 53) {
                    const currentLoad = weeklyLoads[candidate.id]?.[weekIdx] || 0;
                    const newLoad = currentLoad + task.hoursPerWeek;
                    
                    if (newLoad > candidate.maxHoursPerWeek) {
                        // Squared penalty for overtime to strongly discourage peaks
                        overtimePenalty += Math.pow(newLoad - candidate.maxHoursPerWeek, 2);
                    } else {
                        // Reward for using available capacity
                        utilizationReward += task.hoursPerWeek;
                    }
                }
            }

            score -= (overtimePenalty * 10); 
            score += (utilizationReward * 1);

            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        });

        // If we found a candidate (even if score is low due to overtime), assign them.
        // We only fail if there are NO candidates (e.g., everyone is already on the project).
        if (bestCandidate) {
             const p = workingProjects.find((proj: any) => proj.id === task.projectId);
             if (p && p.phasesConfig) {
                 const candId = (bestCandidate as any).id;
                 p.phasesConfig[task.phaseIndex].staffAllocation[task.allocIndex].staffTypeId = candId;

                 // Update Local Loads
                 for (let w = 0; w < task.duration; w++) {
                     const weekIdx = task.startWeek + w;
                     if (weekIdx < 53) {
                         if (!weeklyLoads[candId]) weeklyLoads[candId] = new Array(53).fill(0);
                         weeklyLoads[candId][weekIdx] += task.hoursPerWeek;
                     }
                 }
             }
        } else {
            warnings.push(`Could not fill placeholder for ${task.projectName}.`);
        }
    });

    return { projects: workingProjects, warnings };
};

/**
 * Optimizes the schedule by adjusting start weeks of unlocked projects.
 */
const optimizeProjectTiming = (
  currentProjects: ProjectInput[],
  config: GlobalConfig
): ProjectInput[] => {
    let bestProjects = currentProjects.map(p => ({ ...p }));
    
    // Updated Cost function: considers the Total Average Hours per Week (aggregate load)
    // It minimizes the variance of the total weekly hours across the entire organization.
    const getCost = (projs: ProjectInput[]) => {
        const loads = calculateWeeklyAggregates(projs, config);
        let cost = 0;
        
        const totalWeeklyLoad = new Array(53).fill(0);
        
        // Sum up all staff hours for each week to get organization-wide total
        Object.values(loads).forEach(weeks => {
            weeks.forEach((hours, idx) => {
                if (totalWeeklyLoad[idx] !== undefined) {
                    totalWeeklyLoad[idx] += hours;
                }
            });
        });

        // Sum of squares of the total load creates a metric that penalizes peaks in the global schedule
        totalWeeklyLoad.forEach(hours => {
            cost += (hours * hours);
        });
        
        return cost;
    };

    let bestCost = getCost(bestProjects);
    const iterations = 5000;

    const getProjectDuration = (p: ProjectInput) => {
        const phases = p.phasesConfig || config.phases;
        return phases.reduce((sum, phase) => sum + phase.maxWeeks, 0);
    };

    const projectConstraints = bestProjects.map((p, i) => {
        const duration = getProjectDuration(p);
        const maxStart = Math.max(0, 52 - duration);
        return { index: i, duration, maxStart };
    });

    const unlockedIndices = bestProjects.map((p, i) => p.locked ? -1 : i).filter(i => i !== -1);

    if (unlockedIndices.length === 0) return currentProjects;

    for (let i = 0; i < iterations; i++) {
        const idx = unlockedIndices[Math.floor(Math.random() * unlockedIndices.length)];
        const originalOffset = bestProjects[idx].startWeekOffset;
        const constraint = projectConstraints[idx];
        const newOffset = Math.floor(Math.random() * (constraint.maxStart + 1));
        
        if (newOffset === originalOffset) continue;

        bestProjects[idx].startWeekOffset = newOffset;
        const newCost = getCost(bestProjects);

        if (newCost < bestCost) {
            bestCost = newCost;
        } else {
            bestProjects[idx].startWeekOffset = originalOffset;
        }
    }

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
 * Main optimization function exposed to UI.
 * 1. Fills placeholders with staff assignments.
 * 2. Optimizes project start dates to balance load.
 */
export const optimizeSchedule = (
  projects: ProjectInput[],
  config: GlobalConfig
): { optimizedProjects: ProjectInput[], warnings: string[] } => {
  // Phase 1: Assign Staff
  const { projects: staffedProjects, warnings } = assignStaffToPlaceholders(projects, config);
  
  // Phase 2: Optimize Timing
  // We use the staffed projects so timing decisions are based on real people's loads
  const finalProjects = optimizeProjectTiming(staffedProjects, config);

  return { optimizedProjects: finalProjects, warnings };
};

/**
 * Core scheduling algorithm with Override support.
 */
export const generateSchedule = (
  projects: ProjectInput[],
  config: GlobalConfig
): ScheduleData => {
  const { year, staffTypes } = config;
  
  // 1. Generate Timeline Headers
  const startDate = startOfWeek(startOfYear(new Date(year, 0, 1)), { weekStartsOn: 1 });
  let currentMonday = startDate;
  if (currentMonday.getFullYear() < year) {
      currentMonday = addWeeks(currentMonday, 1);
  }
  
  const headers: string[] = [];
  for (let i = 0; i < 53; i++) {
    const d = addWeeks(currentMonday, i);
    if (d.getFullYear() > year) break; 
    headers.push(d.toISOString());
  }

  const rows: ScheduleRow[] = [];

  projects.forEach((project) => {
    const phases = project.phasesConfig || config.phases;
    
    // --- Pre-calculate Allocation Profiles per Phase ---
    // How many hours per week does a staff type get in a specific phase (normalized)?
    const phaseProfiles: Record<string, Record<string, number>> = {};
    const allocatedStaffIds = new Set<string>();

    phases.forEach(p => {
        const totalPhaseHours = (project.budgetHours * p.percentBudget) / 100;
        const duration = Math.max(1, p.maxWeeks); // Avoid division by zero
        const weeklyPhaseHours = totalPhaseHours / duration;
        
        phaseProfiles[p.name] = {};
        p.staffAllocation.forEach(sa => {
            phaseProfiles[p.name][sa.staffTypeId] = (weeklyPhaseHours * sa.percentage) / 100;
            // Track explicit allocations (even if 0%)
            allocatedStaffIds.add(sa.staffTypeId);
        });
    });

    // --- Determine Effective Phase for each Week ---
    // Start with natural timeline
    const weeklyPhases: Record<string, PhaseName> = {};
    let weekCursor = Math.max(0, Math.min(project.startWeekOffset, headers.length - 1));
    
    phases.forEach(p => {
        for (let i = 0; i < p.maxWeeks; i++) {
            if (weekCursor < headers.length) {
                weeklyPhases[headers[weekCursor]] = p.name;
            }
            weekCursor++;
        }
    });

    // Apply Phase Overrides
    if (project.overrides?.phase) {
        Object.entries(project.overrides.phase).forEach(([date, phase]) => {
            if (headers.includes(date)) {
                weeklyPhases[date] = phase;
            }
        });
    }

    // --- Generate Rows for Staff ---
    staffTypes.forEach(staff => {
        // We need to determine how many splits (indices) are needed.
        // This is max(calculated_max_load, max_override_index).
        
        let maxWeeklyLoadCalculated = 0;
        let maxOverrideIndex = 0;

        // Check overrides to see if we have manual data for high indices
        if (project.overrides?.staff) {
            Object.keys(project.overrides.staff).forEach(key => {
                const [sId, sIdx] = key.split('-');
                if (sId === staff.id) {
                    const idx = parseInt(sIdx);
                    if (idx > maxOverrideIndex) maxOverrideIndex = idx;
                }
            });
        }

        // Calculate load based on effective phases
        headers.forEach(date => {
            const phaseName = weeklyPhases[date];
            if (phaseName && phaseProfiles[phaseName]) {
                 const hours = phaseProfiles[phaseName][staff.id] || 0;
                 if (hours > maxWeeklyLoadCalculated) maxWeeklyLoadCalculated = hours;
            }
        });

        // We disable automatic splitting based on capacity overflow.
        // Users can manually add splits via overrides if they want a second row for the same person/role.
        const calculatedSplits = 1;
        const isExplicitlyAllocated = allocatedStaffIds.has(staff.id);

        // Ensure at least 1 row if we have calculated load > 0, OR explicit allocation, OR overrides exist
        let numSplits = Math.max(calculatedSplits, maxOverrideIndex);
        if (maxWeeklyLoadCalculated === 0 && maxOverrideIndex === 0 && !isExplicitlyAllocated) numSplits = 0;

        for (let i = 0; i < numSplits; i++) {
            const staffIndex = i + 1;
            const staffKey = `${staff.id}-${staffIndex}`;
            
            const rowCells: ScheduleCell[] = headers.map(d => ({ date: d, hours: 0, phase: null }));
            let rowTotalHours = 0;
            let hasAnyHours = false;

            headers.forEach((date, dateIdx) => {
                const phaseName = weeklyPhases[date];
                let cellHours = 0;
                let isOverride = false;
                
                // 1. Check specific hour override
                if (project.overrides?.staff?.[staffKey]?.[date] !== undefined) {
                    cellHours = project.overrides.staff[staffKey][date];
                    isOverride = true;
                } 
                // 2. Fallback to calculated if phase exists
                else if (phaseName) {
                    const rawTotalForType = phaseProfiles[phaseName][staff.id] || 0;
                    if (rawTotalForType > 0) {
                        const rawPerPerson = rawTotalForType / numSplits;
                        // Rounding logic
                        let baseWeekly = Math.round(rawPerPerson / 4) * 4;
                        if (baseWeekly === 0 && rawPerPerson > 0) baseWeekly = 4;
                        cellHours = baseWeekly;
                    }
                }

                if (cellHours > 0 || isOverride) {
                    rowCells[dateIdx].hours = cellHours;
                    // If we have an override phase, use it, otherwise use computed
                    rowCells[dateIdx].phase = phaseName || null; 
                    rowCells[dateIdx].isOverride = isOverride;
                    rowTotalHours += cellHours;
                    hasAnyHours = true;
                }
            });

            // Only add the row if it has content (or if it was forced by override index logic effectively, or explicit allocation)
            if (numSplits > 0 && (hasAnyHours || staffIndex <= maxOverrideIndex || (isExplicitlyAllocated && staffIndex === 1))) {
                rows.push({
                    rowId: `${project.id}-${staff.id}-${i}`,
                    projectId: project.id,
                    staffTypeId: staff.id,
                    projectName: project.name,
                    staffTypeName: staff.name,
                    staffRole: staff.role || 'Auditor',
                    staffIndex: staffIndex,
                    cells: rowCells,
                    totalHours: rowTotalHours
                });
            }
        }
    });
  });

  return { headers, rows };
};
