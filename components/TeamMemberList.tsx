import React, { useState } from 'react';
import { GlobalConfig, StaffType } from '../types';
import { Plus, Trash2, Users } from 'lucide-react';

interface TeamMemberListProps {
  config: GlobalConfig;
  setConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
}

export const TeamMemberList: React.FC<TeamMemberListProps> = ({ config, setConfig }) => {
  const [newName, setNewName] = useState('');
  const [newHours, setNewHours] = useState<number>(40);

  const addMember = () => {
    if (!newName.trim()) return;
    const id = `role-${Date.now()}`;
    // Rotate through some colors
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
      id,
      name: newName,
      maxHoursPerWeek: newHours,
      color
    };

    // Update staff types AND ensure phases have allocation entry (default 0)
    const updatedPhases = config.phases.map(p => ({
      ...p,
      staffAllocation: [...p.staffAllocation, { staffTypeId: id, percentage: 0 }]
    }));

    setConfig({
      ...config,
      staffTypes: [...config.staffTypes, newStaff],
      phases: updatedPhases
    });
    setNewName('');
    setNewHours(40);
  };

  const removeMember = (id: string) => {
    setConfig({
      ...config,
      staffTypes: config.staffTypes.filter(s => s.id !== id),
      phases: config.phases.map(p => ({
        ...p,
        staffAllocation: p.staffAllocation.filter(sa => sa.staffTypeId !== id)
      }))
    });
  };

  const updateMember = (id: string, field: keyof StaffType, value: any) => {
    setConfig({
      ...config,
      staffTypes: config.staffTypes.map(s => s.id === id ? { ...s, [field]: value } : s)
    });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-indigo-600" />
        Team Members
      </h2>

      <div className="flex flex-col gap-3 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
         <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
             <div className="md:col-span-7">
                <label className="block text-xs font-medium text-slate-500 mb-1">Role / Name</label>
                <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Senior Auditor"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                />
             </div>
             <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Max Hrs/Wk</label>
                <input
                    type="number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newHours}
                    onChange={(e) => setNewHours(parseInt(e.target.value) || 0)}
                />
             </div>
             <div className="md:col-span-2">
                <button
                    onClick={addMember}
                    className="w-full flex justify-center items-center bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-md transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
             </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
        {config.staffTypes.map((staff) => (
             <div key={staff.id} className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow">
                <div className={`w-2 h-10 rounded-full ${staff.color.split(' ')[0]}`}></div>
                <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-7">
                         <label className="text-[10px] text-slate-400 block">Role Name</label>
                         <input 
                            type="text"
                            className="w-full font-medium text-slate-700 text-sm bg-transparent border-b border-transparent focus:border-indigo-300 outline-none"
                            value={staff.name}
                            onChange={(e) => updateMember(staff.id, 'name', e.target.value)}
                         />
                    </div>
                    <div className="col-span-5">
                        <label className="text-[10px] text-slate-400 block">Hrs/Wk</label>
                        <input 
                            type="number"
                            className="w-full text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={staff.maxHoursPerWeek}
                            onChange={(e) => updateMember(staff.id, 'maxHoursPerWeek', parseInt(e.target.value) || 0)}
                         />
                    </div>
                </div>
                <button
                    onClick={() => removeMember(staff.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
             </div>
        ))}
         {config.staffTypes.length === 0 && (
          <div className="text-center text-slate-400 py-10 italic">
            No team members defined.
          </div>
        )}
      </div>
    </div>
  );
};