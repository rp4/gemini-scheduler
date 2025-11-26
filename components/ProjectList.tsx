import React, { useState } from 'react';
import { ProjectInput, GlobalConfig } from '../types';
import { TEAMS, SKILLS_LIST } from '../constants';
import { Plus, Trash2, Calendar, Lock, Unlock, X, Sparkles, Settings } from 'lucide-react';

interface ProjectListProps {
  projects: ProjectInput[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectInput[]>>;
  currentConfig: GlobalConfig;
  onOptimize: () => void;
  isOptimizing: boolean;
  onConfigure: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ 
  projects, 
  setProjects, 
  currentConfig,
  onOptimize,
  isOptimizing,
  onConfigure
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectBudget, setNewProjectBudget] = useState<number>(200);
  const [newProjectOffset, setNewProjectOffset] = useState<number>(0);
  const [newProjectTeam, setNewProjectTeam] = useState<string>(TEAMS[0]);
  const [newProjectSkills, setNewProjectSkills] = useState<string[]>([]);

  const openAddModal = () => {
    setEditingProjectId(null);
    setNewProjectName('');
    setNewProjectBudget(200);
    // Calculate a smart default for start week (max existing + 4, or 0)
    const nextOffset = projects.length > 0 ? Math.max(...projects.map(p => p.startWeekOffset)) + 4 : 0;
    setNewProjectOffset(nextOffset);
    setNewProjectTeam(TEAMS[0]);
    setNewProjectSkills([]);
    setIsModalOpen(true);
  };

  const openEditModal = (project: ProjectInput) => {
    setEditingProjectId(project.id);
    setNewProjectName(project.name);
    setNewProjectBudget(project.budgetHours);
    setNewProjectOffset(project.startWeekOffset);
    setNewProjectTeam(project.team || TEAMS[0]);
    setNewProjectSkills(project.requiredSkills || []);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!newProjectName.trim()) return;

    if (editingProjectId) {
        // Update existing project
        setProjects(projects.map(p => p.id === editingProjectId ? {
            ...p,
            name: newProjectName,
            budgetHours: newProjectBudget,
            startWeekOffset: newProjectOffset,
            team: newProjectTeam,
            requiredSkills: newProjectSkills
        } : p));
    } else {
        // Create new project
        const newId = Math.random().toString(36).substr(2, 9);
        
        // Deep copy current phases config to snapshot it for this project
        const phasesSnapshot = JSON.parse(JSON.stringify(currentConfig.phases));

        const project: ProjectInput = {
            id: newId,
            name: newProjectName,
            budgetHours: newProjectBudget,
            startWeekOffset: newProjectOffset,
            locked: false,
            phasesConfig: phasesSnapshot,
            team: newProjectTeam,
            requiredSkills: newProjectSkills
        };
        setProjects([...projects, project]);
    }
    
    // Reset and close
    setNewProjectName('');
    setNewProjectBudget(200);
    setNewProjectTeam(TEAMS[0]);
    setNewProjectSkills([]);
    setEditingProjectId(null);
    setIsModalOpen(false);
  };

  const removeProject = (id: string) => {
    setProjects(projects.filter(p => p.id !== id));
  };

  const updateProject = (id: string, field: keyof ProjectInput, value: any) => {
    setProjects(projects.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const toggleSkill = (skill: string) => {
    if (newProjectSkills.includes(skill)) {
      setNewProjectSkills(newProjectSkills.filter(s => s !== skill));
    } else {
      setNewProjectSkills([...newProjectSkills, skill]);
    }
  };

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 shrink-0">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Audit Projects
            </h2>
            <button 
                onClick={openAddModal}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
                <Plus className="w-3.5 h-3.5" />
                Add Project
            </button>
        </div>
        
        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 min-h-0">
          {projects.map((project) => (
            <div 
                key={project.id} 
                onClick={() => openEditModal(project)}
                className={`flex items-center gap-2 p-3 bg-white border rounded-lg hover:shadow-md transition-all group cursor-pointer ${project.locked ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200'}`}
            >
              <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                 {/* Name */}
                 <div className="col-span-4 flex flex-col justify-center">
                    <div className="font-medium text-slate-700 truncate text-sm" title={project.name}>
                        {project.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {project.team && (
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{project.team}</span>
                      )}
                      {project.requiredSkills && project.requiredSkills.length > 0 && (
                        <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1 rounded-sm">
                          {project.requiredSkills.length} Skills
                        </span>
                      )}
                    </div>
                 </div>

                 {/* Budget */}
                 <div className="col-span-3 text-sm text-slate-500 flex flex-col gap-0.5">
                    <label className="text-[10px] text-slate-400">Budget</label>
                    <input 
                      type="number" 
                      className="w-full p-1 text-xs border border-slate-300 rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                      value={project.budgetHours}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateProject(project.id, 'budgetHours', parseInt(e.target.value) || 0)}
                    />
                 </div>

                 {/* Start Week & Lock */}
                 <div className="col-span-5 flex items-end gap-1">
                    <div className="flex-1 flex flex-col gap-0.5">
                      <label className="text-[10px] text-slate-400">Start Wk</label>
                      <div className="flex items-center gap-1">
                        <input 
                            type="number" 
                            disabled={project.locked}
                            className={`w-full p-1 text-xs border border-slate-300 rounded outline-none transition-all ${project.locked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500'}`}
                            value={project.startWeekOffset}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateProject(project.id, 'startWeekOffset', parseInt(e.target.value) || 0)}
                        />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            updateProject(project.id, 'locked', !project.locked);
                          }}
                          className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${project.locked ? 'text-amber-600' : 'text-slate-400'}`}
                          title={project.locked ? "Unlock Start Date" : "Lock Start Date"}
                        >
                          {project.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                 </div>
              </div>
              <button
                onClick={(e) => {
                    e.stopPropagation();
                    removeProject(project.id);
                }}
                className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors self-center opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          {projects.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                <Calendar className="w-8 h-8 mb-2 opacity-20" />
                <span className="text-sm italic">No projects added yet.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3 shrink-0">
          <button 
            onClick={onOptimize}
            disabled={isOptimizing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            <Sparkles className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} />
            {isOptimizing ? 'Optimizing Schedule...' : 'Auto-Optimize Schedule'}
          </button>

          <button 
            onClick={onConfigure}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-all border border-slate-700 shadow-sm group"
          >
            <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform" />
            Configure Rules
          </button>
       </div>
      </div>

      {/* Modal Portal (Logically here, visually overlay) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                onClick={() => setIsModalOpen(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl transform transition-all flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-[600px]">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                    <h3 className="text-lg font-bold text-slate-800">
                        {editingProjectId ? 'Edit Project' : 'Add New Project'}
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
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Project Name</label>
                        <input
                            type="text"
                            autoFocus
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="e.g., Enterprise Risk Assessment"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Team</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            value={newProjectTeam}
                            onChange={(e) => setNewProjectTeam(e.target.value)}
                        >
                            {TEAMS.map(team => (
                                <option key={team} value={team}>{team}</option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Budget (Hours)</label>
                            <input
                                type="number"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                value={newProjectBudget}
                                onChange={(e) => setNewProjectBudget(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Week</label>
                            <input
                                type="number"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                value={newProjectOffset}
                                onChange={(e) => setNewProjectOffset(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-[10px] text-slate-400 mt-1.5">Weeks from Jan 1st</p>
                        </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Required Skills</label>
                      <div className="w-full border border-slate-300 rounded-lg h-32 overflow-y-auto p-2 bg-slate-50/50 custom-scrollbar">
                        {SKILLS_LIST.map(skill => (
                          <label key={skill} className="flex items-center gap-2 p-1.5 hover:bg-white hover:shadow-sm rounded cursor-pointer transition-all">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={newProjectSkills.includes(skill)}
                              onChange={() => toggleSkill(skill)}
                            />
                            <span className="text-xs text-slate-700">{skill}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5 flex justify-between">
                         <span>Select all skills required for this audit.</span>
                         <span className="font-semibold text-indigo-600">{newProjectSkills.length} selected</span>
                      </p>
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
                        disabled={!newProjectName.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {editingProjectId ? 'Save Changes' : 'Create Project'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};