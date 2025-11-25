import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ScheduleData, PhaseName, ScheduleRow, ScheduleCell } from '../types';
import { format, parseISO } from 'date-fns';
import { Download, TrendingUp, Users, Layers, User, ChevronRight, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ScheduleTableProps {
  data: ScheduleData;
  onCellUpdate: (projectId: string, staffTypeId: string, staffIndex: number, date: string, value: any, type: 'hours' | 'phase') => void;
}

const PHASE_COLORS: Record<string, string> = {
  [PhaseName.PRE_PLANNING]: 'bg-purple-200 text-purple-900 border-purple-300',
  [PhaseName.PLANNING]: 'bg-blue-200 text-blue-900 border-blue-300',
  [PhaseName.FIELDWORK]: 'bg-amber-200 text-amber-900 border-amber-300',
  [PhaseName.REPORTING]: 'bg-emerald-200 text-emerald-900 border-emerald-300',
  'Mixed': 'bg-slate-300 text-slate-700 border-slate-400'
};

const PHASE_OPTIONS = Object.values(PhaseName);

type ViewMode = 'project' | 'member';

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

export const ScheduleTable: React.FC<ScheduleTableProps> = ({ data, onCellUpdate }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('project');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Editing State
  const [editingCell, setEditingCell] = useState<{ id: string, date: string, type: 'project' | 'staff' } | null>(null);

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
    setViewMode(mode);
    setExpandedGroups(new Set()); 
  };

  const exportToExcel = () => {
    const wsData = [];
    const headerRow = ['Audit Name', 'Staff Type', 'Team Member', 'Split #', 'Total Hrs', ...data.headers.map(d => format(parseISO(d), 'M/d/yy'))];
    wsData.push(headerRow);
    data.rows.forEach(row => {
        const rowData = [
            row.projectName,
            row.staffTypeName,
            'Placeholder',
            row.staffIndex > 1 ? row.staffIndex : '',
            row.totalHours,
            ...row.cells.map(c => c.hours || '')
        ];
        wsData.push(rowData);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Schedule");
    XLSX.writeFile(wb, "Audit_Schedule_2026.xlsx");
  };

  // Stats
  const stats = useMemo(() => {
    const weeksCount = data.headers.length || 52;
    const roleAggregation: Record<string, { total: number, count: number }> = {};
    let grandTotal = 0;

    data.rows.forEach(row => {
        const role = row.staffTypeName;
        if (!roleAggregation[role]) {
            roleAggregation[role] = { total: 0, count: 0 };
        }
        const rowTotal = row.cells.reduce((acc, cell) => acc + (cell.hours || 0), 0);
        roleAggregation[role].total += rowTotal;
        grandTotal += rowTotal;
    });

    const roleStats = Object.entries(roleAggregation).map(([role, values]) => ({
        role,
        avgWeekly: values.total / weeksCount
    }));

    const totalAvgWeekly = grandTotal / weeksCount;
    return { totalAvgWeekly, roleStats };
  }, [data]);

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
        groupId = `${row.staffTypeName}-${row.staffIndex}`;
        label = `Placeholder`;
        subLabel = `${row.staffTypeName} ${row.staffIndex > 1 ? '#' + row.staffIndex : ''}`;
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
          inputRef.current?.focus();
      }, []);

      const handleBlur = () => {
          onSave(val);
      };

      const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === 'Enter') {
              inputRef.current?.blur();
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
                    // Immediate save on select change for better UX
                    inputRef.current?.blur(); 
                  }}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
              >
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
          />
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
         {stats.roleStats.map((roleStat) => (
             <div key={roleStat.role} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate w-32" title={roleStat.role}>{roleStat.role} Avg</p>
                    <p className="text-xl font-bold text-slate-700">{roleStat.avgWeekly.toFixed(1)} <span className="text-xs font-normal text-slate-400">hrs/wk</span></p>
                </div>
                <div className={`p-2 rounded-full bg-slate-100`}>
                    <Users className="w-4 h-4 text-slate-600" />
                </div>
             </div>
         ))}
      </div>

      <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white">
        <div className="flex items-center gap-4">
          <h2 className="text-md font-bold text-slate-800">Schedule Details</h2>
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => handleViewModeChange('project')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'project' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              by Project
            </button>
            <button
              onClick={() => handleViewModeChange('member')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'member' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              by Member
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex gap-2 text-xs">
              {Object.entries(PHASE_COLORS).map(([phase, color]) => (
                  <div key={phase} className="flex items-center gap-1">
                      <div className={`w-3 h-3 rounded-sm ${color.split(' ')[0]} border ${color.split(' ')[2] || 'border-transparent'}`}></div>
                      <span>{phase}</span>
                  </div>
              ))}
           </div>
           <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm transition-colors shadow-sm"
           >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar relative">
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
                  const isMixedPhase = (p: string | null) => p === 'Mixed';

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
                                {viewMode === 'project' ? group.label : `${group.label} (${group.subLabel})`}
                            </span>
                          </button>
                        </td>
                        <td className="sticky left-[200px] z-10 bg-slate-50/80 p-2 border-r border-slate-200 text-slate-500 italic text-xs">
                           {viewMode === 'project' ? `${group.children.length} Assignments` : group.subLabel}
                        </td>
                        <td className="sticky left-[350px] z-10 bg-slate-50/80 p-2 border-r border-slate-200 text-slate-500 italic text-xs">
                           {viewMode === 'project' ? '-' : 'Placeholder'}
                        </td>
                        <td className="p-2 text-center font-bold font-mono text-slate-800 border-r border-slate-200 text-xs">
                          {Math.round(group.totalHours)}
                        </td>
                        {group.cells.map((cell, cIdx) => {
                          const isEditing = editingCell?.id === group.id && editingCell?.date === cell.date && editingCell?.type === 'project';
                          // Only allow editing phase on Project groups, not Member groups
                          const canEdit = viewMode === 'project' && group.projectId;

                          return (
                          <td 
                            key={`g-${cIdx}`} 
                            className={`p-1 text-center border-r border-slate-200 h-10 min-w-[50px] relative ${canEdit ? 'cursor-pointer hover:bg-indigo-50/50' : ''}`}
                            onClick={() => {
                                if (canEdit) setEditingCell({ id: group.id, date: cell.date, type: 'project' });
                            }}
                          >
                             {isEditing ? (
                                <div className="absolute inset-0 z-50 p-0.5">
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
                                        className={`h-full w-full rounded flex items-center justify-center text-[10px] font-bold border ${PHASE_COLORS[cell.phase || ''] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                        title={`${cell.phase || 'Allocated'}: ${cell.hours} hrs (Click to Change Phase)`}
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
                                {viewMode === 'project' ? `${row.staffTypeName} ${row.staffIndex > 1 ? '#' + row.staffIndex : ''}` : row.staffTypeName}
                            </td>
                            <td className="sticky left-[350px] z-10 bg-white p-2 border-r border-slate-200 text-slate-400 truncate text-xs">
                                Placeholder
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
                                    <div className="absolute inset-0 z-50 p-0.5">
                                        <EditCellInput 
                                            initialValue={cell.hours}
                                            type="hours"
                                            onSave={(val) => {
                                                const num = parseFloat(val);
                                                if (!isNaN(num)) {
                                                    onCellUpdate(row.projectId, row.staffTypeId, row.staffIndex, cell.date, num, 'hours');
                                                }
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
      </div>
    </div>
  );
};