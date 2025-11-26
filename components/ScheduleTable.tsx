
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ScheduleData, PhaseName, ScheduleRow, ScheduleCell, ProjectInput, GlobalConfig } from '../types';
import { format, parseISO } from 'date-fns';
import { Download, TrendingUp, Users, Layers, User, ChevronRight, ChevronDown, Clock, Activity, Target, Award, Plus, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export type ViewMode = 'project' | 'member' | 'skill';

interface ScheduleTableProps {
  data: ScheduleData;
  projects: ProjectInput[];
  config: GlobalConfig;
  onCellUpdate: (projectId: string, staffTypeId: string, staffIndex: number, date: string, value: any, type: 'hours' | 'phase') => void;
  onAssignmentChange: (projectId: string, oldStaffTypeId: string, newStaffTypeId: string) => void;
  onAddAssignment?: (projectId: string) => void;
  onRemoveAssignment?: (projectId: string, staffTypeId: string, staffIndex: number) => void;
  onAddProjectToMember?: (staffTypeId: string) => void;
  onProjectChange?: (staffTypeId: string, oldProjectId: string, newProjectId: string) => void;
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
  // Metadata for editing group-level cells
  projectId?: string; 
  staffTypeId?: string;
  cells: { hours: number; phase: string | null; date: string }[];
  children: ScheduleRow[];
}

interface DragState {
  startRowId: string;
  startColIdx: number;
  endColIdx: number;
  type: 'hours' | 'phase';
  val: any;
  meta: { projectId?: string; staffTypeId?: string; staffIndex?: number };
}

// Moved outside to prevent re-mounting and focus loss on render
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

export const ScheduleTable: React.FC<ScheduleTableProps> = ({ 
  data, 
  projects, 
  config, 
  onCellUpdate, 
  onAssignmentChange, 
  onAddAssignment,
  onRemoveAssignment,
  onAddProjectToMember,
  onProjectChange,
  viewMode, 
  onViewModeChange 
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Editing State
  const [editingCell, setEditingCell] = useState<{ id: string, date: string, type: 'project' | 'staff' } | null>(null);

  // Drag-to-Fill State
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Map Project IDs to Set of assigned Staff IDs
  const projectAssignments = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    data.rows.forEach(row => {
        if (!map[row.projectId]) map[row.projectId] = new Set();
        map[row.projectId].add(row.staffTypeId);
    });
    return map;
  }, [data.rows]);

  // Map Staff IDs to Set of assigned Project IDs
  const memberAssignments = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    data.rows.forEach(row => {
        if (!map[row.staffTypeId]) map[row.staffTypeId] = new Set();
        map[row.staffTypeId].add(row.projectId);
    });
    return map;
  }, [data.rows]);

  const uniqueRoles = useMemo(() => {
    return Array.from(new Set(config.staffTypes.map(s => s.role))).filter(Boolean).sort();
  }, [config.staffTypes]);

  // Handle Drag Commit
  useEffect(() => {
    const handleMouseUp = () => {
        if (dragState) {
            const { startColIdx, endColIdx, val, type, meta } = dragState;
            const start = Math.min(startColIdx, endColIdx);
            const end = Math.max(startColIdx, endColIdx);
            
            for (let i = start; i <= end; i++) {
                if (i === startColIdx) continue; // Skip source
                
                const date = data.headers[i];
                if (type === 'phase' && meta.projectId) {
                     onCellUpdate(meta.projectId, '', 0, date, val, 'phase');
                } else if (type === 'hours' && meta.projectId && meta.staffTypeId && meta.staffIndex) {
                     onCellUpdate(meta.projectId, meta.staffTypeId, meta.staffIndex, date, Number(val), 'hours');
                }
            }
            setDragState(null);
        }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragState, data.headers, onCellUpdate]);

  const handleDragStart = (e: React.MouseEvent, rowId: string, colIdx: number, type: 'hours'|'phase', val: any, meta: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
        startRowId: rowId,
        startColIdx: colIdx,
        endColIdx: colIdx,
        type,
        val,
        meta
    });
  };

  const handleDragEnter = (rowId: string, colIdx: number) => {
    if (dragState && dragState.startRowId === rowId) {
        setDragState({ ...dragState, endColIdx: colIdx });
    }
  };

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

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [];
    
    // Create Headers
    // Project Name, Role, Staff Name, Total Hours, [Dates...]
    const headers = ['Project Name', 'Role', 'Staff Name', 'Total Hours', ...data.headers.map(d => format(parseISO(d), 'yyyy-MM-dd'))];
    wsData.push(headers);

    // Create Rows
    data.rows.forEach(row => {
        const rowData = [
            row.projectName,
            row.staffRole,
            row.staffTypeName,
            row.totalHours,
            ...row.cells.map(c => c.hours)
        ];
        wsData.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Schedule");
    XLSX.writeFile(wb, `AuditSchedule_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  // Stats
  const stats = useMemo(() => {
    const weeksCount = data.headers.length || 52;
    let grandTotal = 0;
    
    const staffLoads: Record<string, number[]> = {};
    const uniqueStaffIds = new Set<string>();

    data.rows.forEach(row => {
        uniqueStaffIds.add(row.staffTypeId);
        grandTotal += row.cells.reduce((acc, cell) => acc + (cell.hours || 0), 0);
        
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

    let totalCapacity = 0;
    uniqueStaffIds.forEach(id => {
        const staff = config.staffTypes.find(s => s.id === id);
        if (staff) {
            totalCapacity += (staff.maxHoursPerWeek * weeksCount);
        }
    });

    const utilization = totalCapacity > 0 ? (grandTotal / totalCapacity) * 100 : 0;
    const totalAvgWeekly = grandTotal / weeksCount;

    let totalSkillScore = 0;
    const assignmentMap: Record<string, Set<string>> = {};
    data.rows.forEach(row => {
        if (row.totalHours > 0) {
            if (!assignmentMap[row.projectId]) assignmentMap[row.projectId] = new Set();
            assignmentMap[row.projectId].add(row.staffTypeId);
        }
    });

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
      let staffTypeId: string | undefined = undefined;

      if (viewMode === 'project') {
        groupId = row.projectName; // Group by Project Name
        label = row.projectName;
        projectId = row.projectId;
      } else {
        // Group by Member (and split index)
        // Using staffTypeId ensures uniqueness even if names are same
        groupId = `${row.staffTypeId}-${row.staffIndex}`;
        label = row.staffIndex > 1 ? `${row.staffTypeName} #${row.staffIndex}` : row.staffTypeName;
        subLabel = '';
        staffTypeId = row.staffTypeId;
      }

      if (!groups[groupId]) {
        groups[groupId] = {
          id: groupId,
          label,
          subLabel,
          projectId,
          staffTypeId,
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
        <table className="border-collapse min-w-max w-full text-sm select-none">
          <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-100 p-3 text-left font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[200px] w-[200px]">
                {viewMode === 'project' ? 'Audit Name' : 'Team Member'}
              </th>
              <th className="sticky left-[200px] z-30 bg-slate-100 p-3 text-left font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[150px] w-[150px]">
                Staff Role
              </th>
              <th className="sticky left-[350px] z-30 bg-slate-100 p-3 text-left font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[150px] w-[150px]">
                {viewMode === 'project' ? 'Team Member' : 'Audit Project'}
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
                        No data to display.
                    </td>
                </tr>
            ) : (
                groupedData.map((group) => {
                  const isExpanded = expandedGroups.has(group.id);
                  
                  let maxHours = 40;
                  if (viewMode === 'member') {
                     const staffId = group.staffTypeId;
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
                           <div className="flex items-center justify-between">
                             <span>{viewMode === 'project' ? `${group.children.length} Assignments` : group.subLabel}</span>
                             {viewMode === 'project' && group.projectId && onAddAssignment && (
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   onAddAssignment(group.projectId!);
                                   if (!isExpanded) toggleGroup(group.id);
                                 }}
                                 className="p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                 title="Add Staff Assignment"
                               >
                                 <Plus className="w-3.5 h-3.5" />
                               </button>
                             )}
                             {viewMode === 'member' && group.staffTypeId && onAddProjectToMember && (
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   onAddProjectToMember(group.staffTypeId!);
                                   if (!isExpanded) toggleGroup(group.id);
                                 }}
                                 className="p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                 title="Add Project Assignment"
                               >
                                 <Plus className="w-3.5 h-3.5" />
                               </button>
                             )}
                           </div>
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

                          // Drag Logic
                          const isDragActive = dragState?.startRowId === group.id;
                          const isDragSelected = isDragActive && cIdx >= Math.min(dragState!.startColIdx, dragState!.endColIdx) && cIdx <= Math.max(dragState!.startColIdx, dragState!.endColIdx);
                          const showDragHandle = canEdit && !isEditing && cell.phase !== 'Mixed' && cell.phase !== null;

                          return (
                          <td 
                            key={`g-${cIdx}`} 
                            className={`p-1 text-center border-r border-slate-200 h-10 min-w-[50px] relative group/cell ${canEdit ? 'cursor-pointer hover:bg-indigo-50/50' : ''} ${isDragSelected ? 'bg-indigo-100 ring-2 ring-indigo-400 z-10' : ''}`}
                            onClick={() => {
                                if (canEdit) setEditingCell({ id: group.id, date: cell.date, type: 'project' });
                            }}
                            onMouseEnter={() => handleDragEnter(group.id, cIdx)}
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
                                    <>
                                        <div 
                                            className={`h-full w-full rounded flex items-center justify-center text-[10px] font-bold border ${cellColorClass}`}
                                            title={`${cell.phase || 'Allocated'}: ${cell.hours} hrs${viewMode === 'member' ? ` (Max: ${maxHours})` : ''}`}
                                        >
                                            {Math.round(cell.hours)}
                                        </div>
                                        {showDragHandle && (
                                            <div 
                                                className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-600 border border-white cursor-crosshair opacity-0 group-hover/cell:opacity-100 z-20 rounded-sm hover:scale-125 transition-transform"
                                                onMouseDown={(e) => handleDragStart(e, group.id, cIdx, 'phase', cell.phase, { projectId: group.projectId })}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}
                                    </>
                                )
                             )}
                          </td>
                        )})}
                      </tr>

                      {/* Child Rows */}
                      {isExpanded && group.children.map((row) => {
                        const assignedToProject = projectAssignments[row.projectId] || new Set();
                        // For member view, find projects this member is assigned to
                        const assignedToMember = memberAssignments[row.staffTypeId] || new Set();

                        return (
                        <tr key={row.rowId} className="hover:bg-slate-50 border-b border-slate-100 bg-white group/row">
                            <td className="sticky left-0 z-10 bg-white p-2 pl-8 border-r border-slate-200 text-slate-600 truncate text-xs border-l-4 border-l-indigo-500">
                                <div className="flex items-center justify-between">
                                    {viewMode === 'project' ? (
                                        <span>↳ Assignment</span>
                                    ) : (
                                        /* In Member View, First Column is Project. Allow switching projects */
                                        onProjectChange ? (
                                             <select
                                                className="w-full bg-transparent border border-transparent hover:border-slate-300 rounded px-1 py-0.5 text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer transition-all -ml-1"
                                                value={row.projectId}
                                                onChange={(e) => onProjectChange(row.staffTypeId, row.projectId, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {projects.map(p => {
                                                    // Filter out projects where this member is already assigned (exclude current project)
                                                    if (assignedToMember.has(p.id) && p.id !== row.projectId) return null;
                                                    return (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    );
                                                })}
                                            </select>
                                        ) : (
                                            <span>{row.projectName}</span>
                                        )
                                    )}

                                    {/* Delete Button for both views */}
                                    {onRemoveAssignment && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveAssignment(row.projectId, row.staffTypeId, row.staffIndex);
                                            }}
                                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors opacity-0 group-hover/row:opacity-100"
                                            title="Remove Assignment"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td className="sticky left-[200px] z-10 bg-white p-2 border-r border-slate-200 text-slate-600 truncate text-xs">
                                <div className="flex items-center gap-1">
                                    <select
                                        className="w-full bg-transparent border border-transparent hover:border-slate-300 rounded px-1 py-0.5 text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer transition-all -ml-1"
                                        value={row.staffRole}
                                        disabled={viewMode === 'member'} // Usually role depends on staff type, can't easily change role without changing staff in member view
                                        onChange={(e) => {
                                            if (viewMode === 'member') return; // Changing role in member view is complex as it implies changing the staff type config?
                                            const newRole = e.target.value;
                                            const currentStaff = config.staffTypes.find(s => s.id === row.staffTypeId);
                                            
                                            // Find candidates with this role who are NOT already assigned to this project
                                            const candidates = config.staffTypes.filter(s => s.role === newRole);
                                            
                                            // 1. Prefer same team, unassigned
                                            let bestCandidate = candidates.find(s => s.team === currentStaff?.team && !assignedToProject.has(s.id));
                                            
                                            // 2. Prefer any team, unassigned
                                            if (!bestCandidate) {
                                                bestCandidate = candidates.find(s => !assignedToProject.has(s.id));
                                            }

                                            if (bestCandidate) {
                                                onAssignmentChange(row.projectId, row.staffTypeId, bestCandidate.id);
                                            } else {
                                                alert(`All staff members with role '${newRole}' are already assigned to this project.`);
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {uniqueRoles.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                    {row.staffIndex > 1 && (
                                        <span className="text-[10px] text-slate-400 font-mono shrink-0">#{row.staffIndex}</span>
                                    )}
                                </div>
                            </td>
                            <td className="sticky left-[350px] z-10 bg-white p-2 border-r border-slate-200 text-slate-400 truncate text-xs">
                                {viewMode === 'project' ? (
                                    <select
                                        className="w-full bg-transparent border border-transparent hover:border-slate-300 rounded px-1 py-0.5 text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer transition-all -ml-1"
                                        value={row.staffTypeId}
                                        onChange={(e) => onAssignmentChange(row.projectId, row.staffTypeId, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {config.staffTypes.map(st => {
                                            // Filter out members who are already assigned to this project (exclude current selection)
                                            if (assignedToProject.has(st.id) && st.id !== row.staffTypeId) return null;
                                            
                                            return (
                                                <option key={st.id} value={st.id}>
                                                    {st.name} {st.id === 'placeholder' ? '' : `(${st.role})`}
                                                </option>
                                            );
                                        })}
                                    </select>
                                ) : (
                                    row.projectName
                                )}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-200 text-xs">
                                {Math.round(row.totalHours)}
                            </td>
                            {row.cells.map((cell, cIdx) => {
                                const isEditing = editingCell?.id === row.rowId && editingCell?.date === cell.date && editingCell?.type === 'staff';
                                
                                // Drag Logic
                                const isDragActive = dragState?.startRowId === row.rowId;
                                const isDragSelected = isDragActive && cIdx >= Math.min(dragState!.startColIdx, dragState!.endColIdx) && cIdx <= Math.max(dragState!.startColIdx, dragState!.endColIdx);
                                const showDragHandle = !isEditing;

                                return (
                                <td 
                                    key={`c-${cIdx}`} 
                                    className={`p-1 text-center border-r border-slate-100 h-10 min-w-[50px] relative cursor-pointer group/cell ${isDragSelected ? 'bg-indigo-100 ring-2 ring-indigo-400 z-10' : 'hover:bg-indigo-50/50'}`}
                                    onClick={() => setEditingCell({ id: row.rowId, date: cell.date, type: 'staff' })}
                                    onMouseEnter={() => handleDragEnter(row.rowId, cIdx)}
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
                                    <>
                                        {cell.hours > 0 ? (
                                            <div 
                                                className={`h-[80%] w-full rounded-sm flex items-center justify-center text-[9px] border ${cell.isOverride ? 'border-indigo-500 ring-1 ring-indigo-200 opacity-100 font-bold' : 'opacity-80'} ${PHASE_COLORS[cell.phase || ''] || 'bg-gray-100'}`}
                                                title={`${cell.phase}: ${cell.hours} hrs${cell.isOverride ? ' (Manual)' : ''}`}
                                            >
                                                {cell.hours}
                                            </div>
                                        ) : (
                                            <div className="h-full w-full"></div>
                                        )}
                                        {showDragHandle && (
                                            <div 
                                                className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-600 border border-white cursor-crosshair opacity-0 group-hover/cell:opacity-100 z-20 rounded-sm hover:scale-125 transition-transform"
                                                onMouseDown={(e) => handleDragStart(e, row.rowId, cIdx, 'hours', cell.hours, { projectId: row.projectId, staffTypeId: row.staffTypeId, staffIndex: row.staffIndex })}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        )}
                                    </>
                                )}
                                </td>
                            )})}
                        </tr>
                      )})}
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
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-4">
         <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Performance Metrics
              </h3>
              <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
              >
                 <Download className="w-3.5 h-3.5" />
                 Export to Excel
              </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        {renderContent()}
      </div>
    </div>
  );
};
