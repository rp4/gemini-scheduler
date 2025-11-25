import React, { useState } from 'react';
import { GlobalConfig, StaffType } from '../types';
import { Plus, Trash2, Users, X } from 'lucide-react';

interface TeamMemberListProps {
  config: GlobalConfig;
  setConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
}

export const TeamMemberList: React.FC<TeamMemberListProps> = ({ config, setConfig }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    setIsModalOpen(false);
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
    <>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Team Members
          </h2>
          <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95"
          >
              <Plus className="w-3.5 h-3.5" />
              Add Member
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
          {config.staffTypes.map((staff) => (
               <div key={staff.id} className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-all group">
                  <div className={`w-2 h-10 rounded-full ${staff.color.split(' ')[0]}`}></div>
                  <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-7">
                           <label className="text-[10px] text-slate-400 block">Role Name</label>
                           <input 
                              type="text"
                              className="w-full font-medium text-slate-700 text-sm bg-transparent border-b border-transparent focus:border-indigo-300 outline-none transition-colors"
                              value={staff.name}
                              onChange={(e) => updateMember(staff.id, 'name', e.target.value)}
                           />
                      </div>
                      <div className="col-span-5">
                          <label className="text-[10px] text-slate-400 block">Hrs/Wk</label>
                          <input 
                              type="number"
                              className="w-full text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                              value={staff.maxHoursPerWeek}
                              onChange={(e) => updateMember(staff.id, 'maxHoursPerWeek', parseInt(e.target.value) || 0)}
                           />
                      </div>
                  </div>
                  <button
                      onClick={() => removeMember(staff.id)}
                      className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors opacity-0 group-hover:opacity-100"
                  >
                      <Trash2 className="w-4 h-4" />
                  </button>
               </div>
          ))}
           {config.staffTypes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
              <Users className="w-8 h-8 mb-2 opacity-20" />
              <span className="text-sm italic">No team members defined.</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Portal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                onClick={() => setIsModalOpen(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl transform transition-all flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800">Add Team Member</h3>
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Role / Name</label>
                        <input
                            type="text"
                            autoFocus
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="e.g., Senior Auditor"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addMember()}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Max Hours / Week</label>
                        <input
                            type="number"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            value={newHours}
                            onChange={(e) => setNewHours(parseInt(e.target.value) || 0)}
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={addMember}
                        disabled={!newName.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add Member
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};