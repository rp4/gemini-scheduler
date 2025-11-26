
import React, { useState } from 'react';
import { GlobalConfig, StaffType, SkillLevel } from '../types';
import { TEAMS } from '../constants';
import { Plus, Trash2, Users, X } from 'lucide-react';

interface TeamMemberListProps {
  config: GlobalConfig;
  setConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
}

export const TeamMemberList: React.FC<TeamMemberListProps> = ({ config, setConfig }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  
  const [newName, setNewName] = useState('');
  const [newHours, setNewHours] = useState<number>(40);
  const [newTeam, setNewTeam] = useState<string>(TEAMS[0]);
  const [newSkills, setNewSkills] = useState<Record<string, SkillLevel>>({});

  const openAddModal = () => {
    setEditingMemberId(null);
    setNewName('');
    setNewHours(40);
    setNewTeam(TEAMS[0]);
    setNewSkills({});
    setIsModalOpen(true);
  };

  const openEditModal = (staff: StaffType) => {
    setEditingMemberId(staff.id);
    setNewName(staff.name);
    setNewHours(staff.maxHoursPerWeek);
    setNewTeam(staff.team || TEAMS[0]);
    setNewSkills(staff.skills || {});
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!newName.trim()) return;

    if (editingMemberId) {
        // Edit existing member
        setConfig({
            ...config,
            staffTypes: config.staffTypes.map(s => s.id === editingMemberId ? {
                ...s,
                name: newName,
                maxHoursPerWeek: newHours,
                team: newTeam,
                skills: newSkills
            } : s)
        });
    } else {
        // Add new member
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
          color,
          team: newTeam,
          skills: newSkills
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
    }

    setNewName('');
    setNewHours(40);
    setNewTeam(TEAMS[0]);
    setNewSkills({});
    setIsModalOpen(false);
    setEditingMemberId(null);
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

  const updateSkillLevel = (skill: string, level: SkillLevel) => {
    setNewSkills(prev => ({
      ...prev,
      [skill]: level
    }));
  };

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Team Members
          </h2>
          <button 
              onClick={openAddModal}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95"
          >
              <Plus className="w-3.5 h-3.5" />
              Add Member
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 min-h-0">
          {config.staffTypes.map((staff) => (
               <div 
                  key={staff.id} 
                  onClick={() => openEditModal(staff)}
                  className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-all group cursor-pointer"
                >
                  <div className={`w-2 h-10 rounded-full ${staff.color.split(' ')[0]}`}></div>
                  <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-7 flex flex-col">
                           <input 
                              type="text"
                              className="w-full font-medium text-slate-700 text-sm bg-transparent border-b border-transparent focus:border-indigo-300 outline-none transition-colors"
                              value={staff.name}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateMember(staff.id, 'name', e.target.value)}
                           />
                           {staff.team && (
                               <span className="text-[10px] text-slate-400 mt-0.5">{staff.team}</span>
                           )}
                      </div>
                      <div className="col-span-5">
                          <label className="text-[10px] text-slate-400 block">Hrs/Wk</label>
                          <input 
                              type="number"
                              className="w-full text-slate-600 text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                              value={staff.maxHoursPerWeek}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateMember(staff.id, 'maxHoursPerWeek', parseInt(e.target.value) || 0)}
                           />
                      </div>
                  </div>
                  <button
                      onClick={(e) => {
                          e.stopPropagation();
                          removeMember(staff.id);
                      }}
                      className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors opacity-0 group-hover:opacity-100 self-center"
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
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl transform transition-all flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-[600px]">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                    <h3 className="text-lg font-bold text-slate-800">
                        {editingMemberId ? 'Edit Team Member' : 'Add Team Member'}
                    </h3>
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
                        <input
                            type="text"
                            autoFocus
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="e.g., John Doe"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Team</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                value={newTeam}
                                onChange={(e) => setNewTeam(e.target.value)}
                            >
                                {TEAMS.map(team => (
                                    <option key={team} value={team}>{team}</option>
                                ))}
                            </select>
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

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Skills & Proficiency</label>
                        <div className="w-full border border-slate-300 rounded-lg h-60 overflow-y-auto bg-slate-50/50 custom-scrollbar divide-y divide-slate-100">
                            {config.skills.map(skill => {
                                const level = newSkills[skill] || 'None';
                                const getLevelColor = (l: SkillLevel) => {
                                    switch(l) {
                                        case 'Advanced': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
                                        case 'Intermediate': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
                                        case 'Beginner': return 'text-blue-600 bg-blue-50 border-blue-200';
                                        default: return 'text-slate-500 bg-white border-slate-200';
                                    }
                                };
                                
                                return (
                                <div key={skill} className="flex items-center justify-between p-2.5 hover:bg-white transition-colors group">
                                    <span className="text-xs text-slate-700 font-medium">{skill}</span>
                                    <select
                                        className={`text-[10px] font-medium border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors ${getLevelColor(level)}`}
                                        value={level}
                                        onChange={(e) => updateSkillLevel(skill, e.target.value as SkillLevel)}
                                    >
                                        <option value="None" className="bg-white text-slate-500">None</option>
                                        <option value="Beginner" className="bg-white text-blue-600">Beginner</option>
                                        <option value="Intermediate" className="bg-white text-indigo-600">Intermediate</option>
                                        <option value="Advanced" className="bg-white text-emerald-600">Advanced</option>
                                    </select>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={!newName.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {editingMemberId ? 'Save Changes' : 'Add Member'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};
