import React, { useState } from 'react';
import { ProjectInput, GlobalConfig } from '../types';
import { Plus, Trash2, Calendar, Lock, Unlock, X } from 'lucide-react';

interface ProjectListProps {
  projects: ProjectInput[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectInput[]>>;
  currentConfig: GlobalConfig;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, setProjects, currentConfig }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectBudget, setNewProjectBudget] = useState<number>(200);
  const [newProjectOffset, setNewProjectOffset] = useState<number>(0);

  const addProject = () => {
    if (!newProjectName.trim()) return;
    const newId = Math.random().toString(36).substr(2, 9);
    
    // Deep copy current phases config to snapshot it for this project
    const phasesSnapshot = JSON.parse(JSON.stringify(currentConfig.phases));

    const project: ProjectInput = {
      id: newId,
      name: newProjectName,
      budgetHours: newProjectBudget,
      startWeekOffset: newProjectOffset,
      locked: false,
      phasesConfig: phasesSnapshot
    };
    setProjects([...projects, project]);
    
    // Reset state and close modal
    setNewProjectName('');
    setNewProjectBudget(200);
    setNewProjectOffset(prev => prev + 4); 
    setIsModalOpen(false);
  };

  const removeProject = (id: string) => {
    setProjects(projects.filter(p => p.id !== id));
  };

  const updateProject = (id: string, field: keyof ProjectInput, value: any) => {
    setProjects(projects.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Audit Projects
            </h2>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
                <Plus className="w-3.5 h-3.5" />
                Add Project
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
          {projects.map((project) => (
            <div key={project.id} className={`flex items-center gap-2 p-3 bg-white border rounded-lg hover:shadow-md transition-all group ${project.locked ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200'}`}>
              <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                 {/* Name */}
                 <div className="col-span-4 font-medium text-slate-700 truncate text-sm" title={project.name}>
                   {project.name}
                 </div>

                 {/* Budget */}
                 <div className="col-span-3 text-sm text-slate-500 flex flex-col gap-0.5">
                    <label className="text-[10px] text-slate-400">Budget</label>
                    <input 
                      type="number" 
                      className="w-full p-1 text-xs border border-slate-300 rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                      value={project.budgetHours}
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
                            onChange={(e) => updateProject(project.id, 'startWeekOffset', parseInt(e.target.value) || 0)}
                        />
                        <button 
                          onClick={() => updateProject(project.id, 'locked', !project.locked)}
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
                onClick={() => removeProject(project.id)}
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
      </div>

      {/* Modal Portal (Logically here, visually overlay) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                onClick={() => setIsModalOpen(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl transform transition-all flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-lg font-bold text-slate-800">Add New Project</h3>
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Project Name</label>
                        <input
                            type="text"
                            autoFocus
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                            placeholder="e.g., Enterprise Risk Assessment"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addProject()}
                        />
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
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={addProject}
                        disabled={!newProjectName.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Create Project
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};