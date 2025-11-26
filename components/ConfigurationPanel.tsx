
import React from 'react';
import { GlobalConfig, PhaseName, StaffType } from '../types';
import { TEAMS } from '../constants';
import { X, Settings, Users, PieChart, AlertCircle, CheckCircle2, Trash2, Plus, User } from 'lucide-react';

interface ConfigurationPanelProps {
  config: GlobalConfig;
  setConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ config, setConfig, isOpen, onClose }) => {
  if (!isOpen) return null;

  const updatePhase = (phaseIndex: number, field: string, value: any) => {
    const newPhases = [...config.phases];
    (newPhases[phaseIndex] as any)[field] = value;
    setConfig({ ...config, phases: newPhases });
  };

  const updateStaffAllocation = (phaseIndex: number, staffTypeId: string, percentage: number) => {
    const newPhases = [...config.phases];
    const allocationIndex = newPhases[phaseIndex].staffAllocation.findIndex(s => s.staffTypeId === staffTypeId);
    if (allocationIndex >= 0) {
      newPhases[phaseIndex].staffAllocation[allocationIndex].percentage = percentage;
    }
    setConfig({ ...config, phases: newPhases });
  };

  const updateStaffType = (staffId: string, field: keyof StaffType, value: any) => {
    const newStaff = config.staffTypes.map(s => s.id === staffId ? { ...s, [field]: value } : s);
    setConfig({ ...config, staffTypes: newStaff });
  };

  const addStaffType = () => {
    const newId = `role-${Date.now()}`;
    const colors = [
          'bg-purple-100 text-purple-800',
          'bg-blue-100 text-blue-800', 
          'bg-green-100 text-green-800', 
          'bg-amber-100 text-amber-800', 
          'bg-rose-100 text-rose-800',
          'bg-cyan-100 text-cyan-800',
          'bg-indigo-100 text-indigo-800'
    ];
    const color = colors[config.staffTypes.length % colors.length];

    const newStaff: StaffType = {
        id: newId,
        name: 'New Staff Member',
        role: 'New Role',
        maxHoursPerWeek: 40,
        color,
        team: TEAMS[0] || 'General'
    };

    // Update phases to include this new staff with 0% allocation
    const updatedPhases = config.phases.map(p => ({
        ...p,
        staffAllocation: [...p.staffAllocation, { staffTypeId: newId, percentage: 0 }]
    }));

    setConfig({
        ...config,
        staffTypes: [...config.staffTypes, newStaff],
        phases: updatedPhases
    });
  };

  const deleteStaffType = (id: string) => {
    // Remove from staffTypes
    const newStaffTypes = config.staffTypes.filter(s => s.id !== id);
    
    // Remove from phases allocations
    const newPhases = config.phases.map(p => ({
        ...p,
        staffAllocation: p.staffAllocation.filter(sa => sa.staffTypeId !== id)
    }));

    setConfig({
        ...config,
        staffTypes: newStaffTypes,
        phases: newPhases
    });
  };

  const totalBudgetPercent = config.phases.reduce((acc, p) => acc + p.percentBudget, 0);
  const isBudgetValid = Math.abs(totalBudgetPercent - 100) < 0.1;

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex justify-end backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-slide-left">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Global Configuration
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Staff Config Section */}
          <section>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Staff Roles & Constraints
                </h3>
                <button 
                    onClick={addStaffType}
                    className="text-xs flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 px-2 py-1 rounded-md font-medium transition-colors"
                >
                    <Plus className="w-3 h-3" />
                    Add Role
                </button>
            </div>
            
            <div className="space-y-4">
              {config.staffTypes.map((staff) => (
                <div key={staff.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 shadow-sm group hover:border-indigo-300 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${staff.color.split(' ')[0]}`}></div>
                        <div className="flex-1">
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">Role Title</label>
                            <input 
                                type="text"
                                className="w-full font-bold text-slate-700 bg-transparent border-b border-transparent hover:border-indigo-200 focus:border-indigo-500 outline-none text-sm px-0 transition-colors placeholder:font-normal placeholder:text-slate-400"
                                value={staff.role}
                                placeholder="Role Title (e.g. Audit Lead)"
                                onChange={(e) => updateStaffType(staff.id, 'role', e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={() => deleteStaffType(staff.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors self-start mt-2"
                            title="Delete Role"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Representative Name</label>
                            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2 py-1.5 focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                                <User className="w-3 h-3 text-slate-400" />
                                <input 
                                    type="text"
                                    className="w-full text-xs text-slate-600 outline-none bg-transparent placeholder:text-slate-300"
                                    value={staff.name}
                                    placeholder="Staff Name"
                                    onChange={(e) => updateStaffType(staff.id, 'name', e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                             <label className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Capacity</label>
                             <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                    value={staff.maxHoursPerWeek}
                                    onChange={(e) => updateStaffType(staff.id, 'maxHoursPerWeek', parseInt(e.target.value))}
                                />
                                <span className="text-xs text-slate-400 shrink-0">hrs/wk</span>
                             </div>
                        </div>
                    </div>
                </div>
              ))}
              
              {config.staffTypes.length === 0 && (
                  <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                      No roles defined. Click "Add Role" to start.
                  </div>
              )}
            </div>
          </section>

          {/* Phase Config Section */}
          <section>
            <div className="flex justify-between items-end mb-4 border-b pb-2">
               <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Phase Definitions & Allocations
              </h3>
              <div className={`text-sm flex items-center gap-1 font-medium ${isBudgetValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isBudgetValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                Total Budget: {totalBudgetPercent}%
              </div>
            </div>
            
            <div className="space-y-6">
              {config.phases.map((phase, idx) => {
                 const totalStaffAllocation = phase.staffAllocation.reduce((sum, s) => sum + s.percentage, 0);
                 const isAllocationValid = Math.abs(totalStaffAllocation - 100) < 0.1;

                 return (
                <div key={phase.name} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 p-3 flex justify-between items-center">
                    <span className="font-semibold text-slate-700">{phase.name}</span>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Budget %</label>
                        <input 
                          type="number" 
                          className="w-16 px-2 py-1 border rounded text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={phase.percentBudget}
                          onChange={(e) => updatePhase(idx, 'percentBudget', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Min Weeks</label>
                        <input 
                          type="number" 
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={phase.minWeeks}
                          onChange={(e) => updatePhase(idx, 'minWeeks', parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Max Weeks</label>
                        <input 
                          type="number" 
                          className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={phase.maxWeeks}
                          onChange={(e) => updatePhase(idx, 'maxWeeks', parseInt(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Staff Distribution (% of Phase)</label>
                        <span className={`text-xs font-mono font-bold ${isAllocationValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                            Sum: {totalStaffAllocation}%
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {config.staffTypes.map(staff => {
                          const allocation = phase.staffAllocation.find(s => s.staffTypeId === staff.id);
                          const val = allocation ? allocation.percentage : 0;
                          return (
                            <div key={staff.id} className="flex items-center justify-between text-sm">
                               <span className="text-slate-600 w-1/3 text-xs truncate" title={staff.name}>
                                    {staff.role || staff.name}
                               </span>
                               <div className="flex-1 mx-3 flex items-center">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    value={val}
                                    onChange={(e) => updateStaffAllocation(idx, staff.id, parseInt(e.target.value))}
                                />
                               </div>
                               <div className="w-12 text-right">
                                    <input 
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-full text-right text-xs p-1 border rounded"
                                        value={val}
                                        onChange={(e) => updateStaffAllocation(idx, staff.id, parseInt(e.target.value))}
                                    />
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </section>

        </div>
        <div className="p-4 border-t bg-slate-50 text-right">
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
