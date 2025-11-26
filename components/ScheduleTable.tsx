
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ScheduleData, PhaseName, ScheduleRow, ScheduleCell, ProjectInput, GlobalConfig } from '../types';
import { format, parseISO } from 'date-fns';
import { Download, TrendingUp, Users, Layers, User, ChevronRight, ChevronDown, Clock, Activity, Target, Award } from 'lucide-react';
import * as XLSX from 'xlsx';

export type ViewMode = 'project' | 'member' | 'skill';

interface ScheduleTableProps {
  data: ScheduleData;
  projects: ProjectInput[];
  config: GlobalConfig;
  onCellUpdate: (projectId: string, staffTypeId: string, staffIndex: number, date: string, value: any, type: 'hours' | 'phase') => void;
  onAssignmentChange: (projectId: string, oldStaffTypeId: string, newStaffTypeId: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const PHASE_COLORS: Record<string, string> = {
  [PhaseName.PRE_PLANNING]: 'bg-purple-200 text-purple-900 border-purple-300',
  [PhaseName.PLANNING]: 'bg-blue-200 text-blue-900 border-blue-300',
  [PhaseName.FIELDWORK]: 'bg-amber-200 text-amber-900 border-amber-300',
  [PhaseName.REPORTING]: 'bg-emerald-200 text-emerald-900 border-emerald-300',
  'Mixed': 'bg-slate-300 text-slate-700 border-slate-400'
};

const PHASE_OPTIONS = Object.values(PhaseName);

interface GroupedRow {
  id: string;
  label: string;
  subLabel?: string;
  totalHours: number;
  // Metadata for editing group-level cells (Project view only)
  projectId?: string; 
  cells: { hours: number; phase: string | null; date: string }[];
  children: ScheduleRow[];
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({ data, projects, config, onCellUpdate, onAssignmentChange, viewMode, onViewModeChange }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Editing State
  const [editingCell, setEditingCell] = useState<{ id: string, date: string, type: 'project' | 'staff' } | null>(null);

  // Map Project IDs to Set of assigned Staff IDs
  const projectAssignments = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    data.rows.forEach(row => {
        if (row.totalHours > 0) {
            if (!map[row.projectId]) map[row.projectId] = new Set();
            map[row.projectId].add(row.staffTypeId);
        }
    });
    return map;
  }, [data.rows]);

  const toggleGroup = (id: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedGroups(newSet);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    onViewModeChange(mode);
    setExpandedGroups(new Set()); 
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    if (viewMode === 'skill') {
        const headerRow = ['Audit Name', ...config.skills];
        const wsData = [headerRow];
        projects.forEach(p => {
            const row = [p.name, ...config.skills.map(s => {
                const required = p.requiredSkills?.includes(s);
                if (!required) return 0;

                // Calculate real score for export
                const assignedIds = projectAssignments[p.id];
                if (!assignedIds) return 0;

                let score = 0;
                assignedIds.forEach(id => {
                    const staff = config.staffTypes.find(st => st.id === id);
                    const lvl = staff?.skills?.[s];
                    if (lvl === 'Beginner') score += 1;
                    if (lvl === 'Intermediate') score += 2;
                    if (lvl === 'Advanced') score += 3;
                });
                return score;
            })];
            wsData.push(row as any);
        });
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Skills Matrix");
    } else {
        const wsData = [];
        const headerRow = ['Audit Name', 'Staff Role', 'Team Member', 'Split #', 'Total Hrs', ...data.headers.map(d => format(parseISO(d), 'M/d/yy'))];
        wsData.push(headerRow);
        data.rows.forEach(row => {
            const rowData = [
                row.projectName,
                row.staffRole,
                row.staffTypeName,
                row.staffIndex > 1 ? row.staffIndex : '',
                row.totalHours,
                ...row.cells.map(c => c.hours || '')
            ];
            wsData.push(rowData);
        });
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Schedule");
    }
    
    XLSX.writeFile(wb, "Audit_Schedule_2026.xlsx");
  };

  // Stats
  const stats = useMemo(() => {
    const weeksCount = data.headers.length || 52;
    let grandTotal = 0;
    
    // Track hours per staff member per week to calculate overtime
    // Key: "staffTypeId-staffIndex"
    const staffLoads: Record<string, number[]> = {};
    const uniqueStaffIds = new Set<string>();

    data.rows.forEach(row => {
        uniqueStaffIds.add(row.staffTypeId);
        // Sum for grand total
        grandTotal += row.cells.reduce((acc, cell) => acc + (cell.hours || 0), 0);
        
        // Aggregate for overtime
        const staffKey = `${row.staffTypeId}-${row.staffIndex}`;
        if (!staffLoads[staffKey]) {
            staffLoads[staffKey] = new Array(data.headers.length).fill(0);
        }
        
        row.cells.forEach((cell, idx) => {
            staffLoads[staffKey][idx] += (cell.hours || 0);
        });
    });
    
    let totalOvertime = 0;
    Object.entries(staffLoads).forEach(([key, weeklyHours]) => {
        const [staffId] = key.split('-');
        const staffConfig = config.staffTypes.find(s => s.id === staffId);
        const maxHours = staffConfig ? staffConfig.maxHoursPerWeek : 40;
        
        weeklyHours.forEach(hours => {
            if (hours > maxHours) {
                totalOvertime += (hours - maxHours);
            }
        });
    });

    // Calculate Utilization
    // Utilization = Total Assigned Hours / (Sum of Max Capacity of All Active Staff * Weeks)
    let totalCapacity = 0;
    uniqueStaffIds.forEach(id => {
        const staff = config.staffTypes.find(s => s.id === id);
        if (staff) {
            totalCapacity += (staff.maxHoursPerWeek * weeksCount);
        }
    });

    const utilization = totalCapacity > 0 ? (grandTotal / totalCapacity) * 100 : 0;
    const totalAvgWeekly = grandTotal / weeksCount;

    // Skills Score Calculation
    // Sum of (Total Points for Project / Num Skills in Project) for all projects
    let totalSkillScore = 0;
    
    // Reuse the projectAssignments calculation logic for consistency
    const assignmentMap: Record<string, Set<string>> = {};
    data.rows.forEach(row => {
        if (row.totalHours > 0) {
            if (!assignmentMap[row.projectId]) assignmentMap[row.projectId] = new Set();
            assignmentMap[row.projectId].add(row.staffTypeId);
        }
    });

    // Calculate score per project
    Object.keys(assignmentMap).forEach(projectId => {
        const project = projects.find(p => p.id === projectId);
        
        if (project && project.requiredSkills && project.requiredSkills.length > 0) {
            let projectPoints = 0;
            const assignedStaffIds = assignmentMap[projectId];
            
            project.requiredSkills.forEach(skillName => {
                assignedStaffIds.forEach(staffId => {
                    const staff = config.staffTypes.find(s => s.id === staffId);
                    const level = staff?.skills?.[skillName];
                    
                    if (level === 'Beginner') projectPoints += 1;
                    else if (level === 'Intermediate') projectPoints += 2;
                    else if (level === 'Advanced') projectPoints += 3;
                });
            });

            // Normalize by number of skills required
            totalSkillScore += (projectPoints / project.requiredSkills.length);
        }
    });

    return { totalAvgWeekly, totalOvertime, utilization, totalSkillScore };
  }, [data, config.staffTypes, projects]);

  // Grouping
  const groupedData = useMemo(() => {
    const groups: Record<string, GroupedRow> = {};

    data.rows.forEach(row => {
      let groupId: string;
      let label: string;
      let subLabel = '';
      let projectId: string | undefined = undefined;

      if (viewMode === 'project') {
        groupId = row.projectName; // Group by Project Name
        label = row.projectName;
        projectId = row.projectId;
      } else {
        // Group by Member (and split index)
        groupId = `${row.staffTypeName}-${row.staffIndex}`;
        // Label is the Member Name
        label = row.staffIndex > 1 ? `${row.staffTypeName} #${row.staffIndex}` : row.staffTypeName;
        // Sublabel is the Role - CLEARED as per user request
        subLabel = '';
      }

      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          label,
          subLabel,
          projectId,
          totalHours: 0,
          cells: data.headers.map(d => ({ hours: 0, phase: null, date: d })),
          children: []
        };
      }

      const group = groups[groupId];
      group.totalHours += row.totalHours;
      group.children.push(row);

      row.cells.forEach((cell, idx) => {
        const groupCell = group.cells[idx];
        groupCell.hours += cell.hours;
        if (cell.hours > 0 && cell.phase) {
           if (groupCell.phase === null) {
             groupCell.phase = cell.phase;
           } else if (groupCell.phase !== cell.phase) {
             groupCell.phase = 'Mixed';
           }
        }
      });
    });
    return Object.values(groups);
  }, [data, viewMode]);

  // Editing Component
  const EditCellInput = ({ 
      initialValue, 
      type, 
      onSave, 
      onCancel 
  }: { 
      initialValue: any, 
      type: 'hours' | 'phase', 
      onSave: (val: any) => void, 
      onCancel: () => void 
  }) => {
      const [val, setVal] = useState(initialValue);
      const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

      useEffect(() => {
          if (inputRef.current) {
              inputRef.current.focus();
              if (type === 'hours' && inputRef.current instanceof HTMLInputElement) {
                  inputRef.current.select();
              }
          }
      }, [type]);

      const handleBlur = () => {
          if (type !== 'phase') {
              onSave(val);
          } else {
              onCancel();
          }
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === 'Enter') {
              if (type === 'phase') {
                  onSave(val);
              } else {
                  inputRef.current?.blur();
              }
          } else if (e.key === 'Escape') {
              onCancel();
          }
      };

      if (type === 'phase') {
          return (
              <select
                  ref={inputRef as any}
                  className="w-full h-full text-[10px] p-0 border-none outline-none bg-white focus:ring-2 focus:ring-indigo-500 rounded"
                  value={val}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setVal(newVal);
                    onSave(newVal); 
                  }}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()} 
              >
                  <option value="" disabled>Select Phase...</option>
                  {PHASE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
          );
      }

      return (
          <input
              ref={inputRef as any}
              type="number"
              className="w-full h-full text-center text-xs p-0 border-none outline-none bg-white focus:ring-2 focus:ring-indigo-500 rounded"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
          />
      );
  };

  const renderContent = () => {
    if (viewMode === 'skill') {
        return (
            <table className="border-collapse min-w-max w-full text-sm">
                <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="sticky left-0 z-30 bg-slate-100 p-3 text-left font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[200px] w-[200px]">
                            Audit Name
                        </th>
                        {config.skills.map(skill => (
                            <th key={skill} className="p-3 text-center font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[100px]">
                                <span className="text-xs">{skill}</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {projects.map(project => (
                        <tr key={project.id} className="hover:bg-slate-50 border-b border-slate-100 bg-white">
                            <td className="sticky left-0 z-10 bg-white p-3 border-r border-slate-200 font-medium text-slate-700">
                                {project.name}
                            </td>
                            {config.skills.map(skill => {
                                const required = project.requiredSkills?.includes(skill);
                                
                                if (!required) {
                                    return (
                                        <td key={skill} className="p-2 text-center border-r border-slate-100">
                                            <span className="text-slate-200 text-[10px]">-</span>
                                        </td>
                                    );
                                }

                                // Calculate Score based on assigned staff
                                const assignedStaffIds = projectAssignments[project.id] || new Set();
                                let score = 0;
                                let contributingStaff: string[] = [];
                                
                                assignedStaffIds.forEach(staffId => {
                                    const staff = config.staffTypes.find(s => s.id === staffId);
                                    const level = staff?.skills?.[skill];
                                    if (level) {
                                        if (level === 'Beginner') score += 1;
                                        else if (level === 'Intermediate') score += 2;
                                        else if (level === 'Advanced') score += 3;
                                        
                                        if (level !== 'None') {
                                            contributingStaff.push(`${staff?.name} (${level})`);
                                        }
                                    }
                                });
                                
                                return (
                                    <td key={skill} className="p-2 text-center border-r border-slate-100">
                                        {score > 0 ? (
                                            <div className="group relative inline-block">
                                                <div className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-100 cursor-help">
                                                    {score} pts
                                                </div>
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-max max-w-[200px]">
                                                    <div className="bg-slate-800 text-white text-[10px] rounded py-1 px-2 shadow-xl">
                                                        {contributingStaff.map((s, i) => (
                                                            <div key={i}>{s}</div>
                                                        ))}
                                                        {contributingStaff.length === 0 && <div>No contributing staff</div>}
                                                    </div>
                                                    <div className="w-2 h-2 bg-slate-800 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="inline-block px-2 py-0.5 rounded bg-red-50 text-red-600 font-bold text-xs border border-red-100" title="Required skill missing from assigned staff">
                                                Missing
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    {projects.length === 0 && (
                        <tr>
                            <td colSpan={config.skills.length + 1} className="p-10 text-center text-slate-400">
                                Add projects to view skill requirements.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        );
    }

    return (
        <table className="border-collapse min-w-max w-full text-sm">
          <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-100 p-3 text-left font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[200px] w-[200px]">
                Audit Name
              </th>
              <th className="sticky left-[200px] z-30 bg-slate-100 p-3 text-left font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[150px] w-[150px]">
                Staff Role
              </th>
              <th className="sticky left-[350px] z-30 bg-slate-100 p-3 text-left font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[150px] w-[150px]">
                Team Member
              </th>
               <th className="p-3 text-center font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[80px] w-[80px]">
                Total
              </th>
              {data.headers.map(dateStr => (
                <th key={dateStr} className="p-2 text-center font-normal text-slate-500 border-b border-r border-slate-200 min-w-[50px] w-[50px]">
                   <div className="flex flex-col items-center">
                       <span className="text-xs font-bold">{format(parseISO(dateStr), 'MMM')}</span>
                       <span className="text-[10px]">{format(parseISO(dateStr), 'd')}</span>
                   </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedData.length === 0 ? (
                <tr>
                    <td colSpan={data.headers.length + 4} className="p-10 text-center text-slate-400">
                        Add projects to generate a schedule.
                    </td>
                </tr>
            ) : (
                groupedData.map((group) => {
                  const isExpanded = expandedGroups.has(group.id);
                  
                  // For Member view, retrieve staff Max Hours
                  let maxHours = 40;
                  if (viewMode === 'member') {
                     const staffId = group.children[0]?.staffTypeId;
                     const staffMember = config.staffTypes.find(s => s.id === staffId);
                     if (staffMember) maxHours = staffMember.maxHoursPerWeek;
                  }

                  return (
                    <React.Fragment key={group.id}>
                      {/* Group Header Row */}
                      <tr className="bg-slate-50/80 hover:bg-slate-100 border-b border-slate-200 transition-colors">
                        <td className="sticky left-0 z-10 bg-slate-50/80 p-2 border-r border-slate-200 font-bold text-slate-800">
                          <button 
                            onClick={() => toggleGroup(group.id)}
                            className="flex items-center gap-2 w-full text-left focus:outline-none"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            <span className="truncate" title={group.label}>
                                {group.label}
                            </span>
                          </button>
                        </td>
                        <td className="sticky left-[200px] z-10 bg-slate-50/80 p-2 border-r border-slate-200 text-slate-500 italic text-xs">
                           {viewMode === 'project' ? `${group.children.length} Assignments` : group.subLabel}
                        </td>
                        <td className="sticky left-[350px] z-10 bg-slate-50/80 p-2 border-r border-slate-200 text-slate-500 italic text-xs">
                           -
                        </td>
                        <td className="p-2 text-center font-bold font-mono text-slate-800 border-r border-slate-200 text-xs">
                          {Math.round(group.totalHours)}
                        </td>
                        {group.cells.map((cell, cIdx) => {
                          const isEditing = editingCell?.id === group.id && editingCell?.date === cell.date && editingCell?.type === 'project';
                          // Only allow editing phase on Project groups, not Member groups
                          const canEdit = viewMode === 'project' && group.projectId;
                          
                          let cellColorClass = '';
                          if (viewMode === 'member') {
                               if (cell.hours > maxHours) {
                                   cellColorClass = 'bg-red-200 text-red-900 border-red-300 font-bold';
                               } else {
                                   cellColorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                               }
                          } else {
                               cellColorClass = PHASE_COLORS[cell.phase || ''] || 'bg-gray-100 text-gray-600 border-gray-200';
                          }

                          return (
                          <td 
                            key={`g-${cIdx}`} 
                            className={`p-1 text-center border-r border-slate-200 h-10 min-w-[50px] relative ${canEdit ? 'cursor-pointer hover:bg-indigo-50/50' : ''}`}
                            onClick={() => {
                                if (canEdit) setEditingCell({ id: group.id, date: cell.date, type: 'project' });
                            }}
                          >
                             {isEditing ? (
                                <div 
                                    className="absolute inset-0 z-50 p-0.5"
                                    onClick={(e) => e.stopPropagation()} 
                                >
                                    <EditCellInput 
                                        initialValue={cell.phase === 'Mixed' ? '' : cell.phase || ''}
                                        type="phase"
                                        onSave={(val) => {
                                            if (group.projectId && val) {
                                                onCellUpdate(group.projectId, '', 0, cell.date, val, 'phase');
                                            }
                                            setEditingCell(null);
                                        }}
                                        onCancel={() => setEditingCell(null)}
                                    />
                                </div>
                             ) : (
                                cell.hours > 0 && (
                                    <div 
                                        className={`h-full w-full rounded flex items-center justify-center text-[10px] font-bold border ${cellColorClass}`}
                                        title={`${cell.phase || 'Allocated'}: ${cell.hours} hrs${viewMode === 'member' ? ` (Max: ${maxHours})` : ''}`}
                                    >
                                        {Math.round(cell.hours)}
                                    </div>
                                )
                             )}
                          </td>
                        )})}
                      </tr>

                      {/* Child Rows */}
                      {isExpanded && group.children.map((row) => (
                        <tr key={row.rowId} className="hover:bg-slate-50 border-b border-slate-100 bg-white">
                            <td className="sticky left-0 z-10 bg-white p-2 pl-8 border-r border-slate-200 text-slate-600 truncate text-xs border-l-4 border-l-indigo-500">
                                {viewMode === 'project' ? '↳ Assignment' : row.projectName}
                            </td>
                            <td className="sticky left-[200px] z-10 bg-white p-2 border-r border-slate-200 text-slate-600 truncate text-xs">
                                {viewMode === 'project' ? 
                                    `${row.staffRole} ${row.staffIndex > 1 ? '#' + row.staffIndex : ''}` : 
                                    row.staffRole
                                }
                            </td>
                            <td className="sticky left-[350px] z-10 bg-white p-2 border-r border-slate-200 text-slate-400 truncate text-xs">
                                {viewMode === 'project' ? (
                                    <select
                                        className="w-full bg-transparent border border-transparent hover:border-slate-300 rounded px-1 py-0.5 text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer transition-all -ml-1"
                                        value={row.staffTypeId}
                                        onChange={(e) => onAssignmentChange(row.projectId, row.staffTypeId, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {config.staffTypes.map(st => (
                                            <option key={st.id} value={st.id}>
                                                {st.name} {st.id === 'placeholder' ? '' : `(${st.role})`}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    row.staffTypeName
                                )}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-200 text-xs">
                                {Math.round(row.totalHours)}
                            </td>
                            {row.cells.map((cell, cIdx) => {
                                const isEditing = editingCell?.id === row.rowId && editingCell?.date === cell.date && editingCell?.type === 'staff';
                                
                                return (
                                <td 
                                    key={`c-${cIdx}`} 
                                    className={`p-1 text-center border-r border-slate-100 h-10 min-w-[50px] relative cursor-pointer hover:bg-indigo-50/50`}
                                    onClick={() => setEditingCell({ id: row.rowId, date: cell.date, type: 'staff' })}
                                >
                                {isEditing ? (
                                    <div 
                                        className="absolute inset-0 z-50 p-0.5"
                                        onClick={(e) => e.stopPropagation()} 
                                    >
                                        <EditCellInput 
                                            initialValue={cell.hours}
                                            type="hours"
                                            onSave={(val) => {
                                                const num = parseFloat(val);
                                                const finalVal = isNaN(num) ? 0 : num;
                                                onCellUpdate(row.projectId, row.staffTypeId, row.staffIndex, cell.date, finalVal, 'hours');
                                                setEditingCell(null);
                                            }}
                                            onCancel={() => setEditingCell(null)}
                                        />
                                    </div>
                                ) : (
                                    cell.hours > 0 ? (
                                        <div 
                                            className={`h-[80%] w-full rounded-sm flex items-center justify-center text-[9px] border ${cell.isOverride ? 'border-indigo-500 ring-1 ring-indigo-200 opacity-100 font-bold' : 'opacity-80'} ${PHASE_COLORS[cell.phase || ''] || 'bg-gray-100'}`}
                                            title={`${cell.phase}: ${cell.hours} hrs${cell.isOverride ? ' (Manual)' : ''}`}
                                        >
                                            {cell.hours}
                                        </div>
                                    ) : (
                                        <div className="h-full w-full hover:bg-slate-100"></div>
                                    )
                                )}
                                </td>
                            )})}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
            )}
          </tbody>
        </table>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Stats Dashboard */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Avg Hrs/Wk</p>
                <p className="text-2xl font-bold text-slate-800">{stats.totalAvgWeekly.toFixed(1)}</p>
            </div>
            <div className="p-2 bg-indigo-50 rounded-full">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
         </div>
         
         <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overtime Hours</p>
                <p className="text-xl font-bold text-slate-700">{Math.round(stats.totalOvertime).toLocaleString()} <span className="text-xs font-normal text-slate-400">hrs</span></p>
            </div>
            <div className="p-2 bg-amber-50 rounded-full">
                <Clock className="w-4 h-4 text-amber-600" />
            </div>
         </div>

         <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Utilization</p>
                <p className="text-xl font-bold text-slate-700">{Math.round(stats.utilization)}%</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-full">
                <Activity className="w-4 h-4 text-emerald-600" />
            </div>
         </div>

         <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skills Score</p>
                <p className="text-xl font-bold text-slate-700">{stats.totalSkillScore.toFixed(1)}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-full">
                <Target className="w-4 h-4 text-blue-600" />
            </div>
         </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        {renderContent()}
      </div>
    </div>
  );
};
