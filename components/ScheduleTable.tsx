import React, { useMemo } from 'react';
import { ScheduleData, PhaseName, ScheduleRow } from '../types';
import { format, parseISO } from 'date-fns';
import { Download, TrendingUp, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ScheduleTableProps {
  data: ScheduleData;
}

const PHASE_COLORS: Record<PhaseName, string> = {
  [PhaseName.PRE_PLANNING]: 'bg-purple-200 text-purple-900 border-purple-300',
  [PhaseName.PLANNING]: 'bg-blue-200 text-blue-900 border-blue-300',
  [PhaseName.FIELDWORK]: 'bg-amber-200 text-amber-900 border-amber-300',
  [PhaseName.REPORTING]: 'bg-emerald-200 text-emerald-900 border-emerald-300',
};

export const ScheduleTable: React.FC<ScheduleTableProps> = ({ data }) => {

  const exportToExcel = () => {
    const wsData = [];
    
    // Headers
    const headerRow = ['Audit Name', 'Staff Type', 'Split #', 'Total Hrs', ...data.headers.map(d => format(parseISO(d), 'M/d/yy'))];
    wsData.push(headerRow);

    // Rows
    data.rows.forEach(row => {
        const rowData = [
            row.projectName,
            row.staffTypeName,
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

  // Calculate Stats
  const stats = useMemo(() => {
    const weeksCount = data.headers.length || 52;
    const roleAggregation: Record<string, { total: number, count: number }> = {};
    let grandTotal = 0;

    // Map for role aggregates per week to calculate true peaks/avgs if needed, 
    // but user requested "Average hours per week per staff role"
    
    data.rows.forEach(row => {
        const role = row.staffTypeName;
        if (!roleAggregation[role]) {
            roleAggregation[role] = { total: 0, count: 0 };
        }
        
        // Sum all hours for this row
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

  // Memoize the grouped rows for potential folding later
  const rows = data.rows;

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
         
         {stats.roleStats.map((roleStat, idx) => (
             <div key={roleStat.role} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate w-32" title={roleStat.role}>{roleStat.role} Avg</p>
                    <p className="text-xl font-bold text-slate-700">{roleStat.avgWeekly.toFixed(1)} <span className="text-xs font-normal text-slate-400">hrs/wk</span></p>
                </div>
                {/* Attempt to match some colors roughly based on role names if known, otherwise generic */}
                <div className={`p-2 rounded-full bg-slate-100`}>
                    <Users className="w-4 h-4 text-slate-600" />
                </div>
             </div>
         ))}
      </div>

      <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white">
        <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
            Schedule Details
        </h2>
        <div className="flex items-center gap-4">
           <div className="flex gap-2 text-xs">
              {Object.entries(PHASE_COLORS).map(([phase, color]) => (
                  <div key={phase} className="flex items-center gap-1">
                      <div className={`w-3 h-3 rounded-sm ${color.split(' ')[0]}`}></div>
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
          <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="sticky left-0 z-20 bg-slate-100 p-3 text-left font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[200px] w-[200px]">
                Audit Name
              </th>
              <th className="sticky left-[200px] z-20 bg-slate-100 p-3 text-left font-semibold text-slate-600 border-r border-b border-slate-300 min-w-[150px] w-[150px]">
                Staff Role
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
            {rows.length === 0 ? (
                <tr>
                    <td colSpan={data.headers.length + 3} className="p-10 text-center text-slate-400">
                        Add projects to generate a schedule.
                    </td>
                </tr>
            ) : (
                rows.map((row, idx) => (
                <tr key={row.rowId} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td className="sticky left-0 z-10 bg-white p-3 border-r border-slate-200 font-medium text-slate-800 truncate max-w-[200px]" title={row.projectName}>
                    {row.projectName}
                    </td>
                    <td className="sticky left-[200px] z-10 bg-white p-3 border-r border-slate-200 text-slate-600 truncate max-w-[150px]">
                    {row.staffTypeName} {row.staffIndex > 1 && <span className="text-xs text-slate-400 ml-1">#{row.staffIndex}</span>}
                    </td>
                    <td className="p-2 text-center font-mono text-slate-700 bg-slate-50 border-r border-slate-200 text-xs">
                        {Math.round(row.totalHours)}
                    </td>
                    {row.cells.map((cell, cIdx) => (
                    <td key={cIdx} className={`p-1 text-center border-r border-slate-100 relative h-10 min-w-[50px] w-[50px]`}>
                        {cell.hours > 0 && (
                            <div 
                                className={`h-full w-full rounded flex items-center justify-center text-[10px] font-bold border ${PHASE_COLORS[cell.phase!] || 'bg-gray-200'}`}
                                title={`${cell.phase}: ${cell.hours} hrs`}
                            >
                                {cell.hours}
                            </div>
                        )}
                    </td>
                    ))}
                </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};