import React, { useState } from 'react';
import { ProjectInput, GlobalConfig } from '../types';
import { Plus, Trash2, Calendar, Lock, Unlock } from 'lucide-react';

interface ProjectListProps {
  projects: ProjectInput[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectInput[]>>;
  currentConfig: GlobalConfig;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, setProjects, currentConfig }) => {
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
    setNewProjectName('');
    setNewProjectBudget(200);
    // Auto increment offset for next one as a helper
    setNewProjectOffset(prev => prev + 4); 
  };

  const removeProject = (id: string) => {
    setProjects(projects.filter(p => p.id !== id));
  };

  const updateProject = (id: string, field: keyof ProjectInput, value: any) => {
    setProjects(projects.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-indigo-600" />
        Audit Projects
      </h2>
      
      <div className="flex flex-col gap-3 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-500 mb-1">Project Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g., Q1 Compliance"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">Budget (Hrs)</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={newProjectBudget}
              onChange={(e) => setNewProjectBudget(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="md:col-span-3">
             <label className="block text-xs font-medium text-slate-500 mb-1">Start Week</label>
             <input
              type="number"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={newProjectOffset}
              onChange={(e) => setNewProjectOffset(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="md:col-span-1">
            <button
              onClick={addProject}
              className="w-full flex justify-center items-center bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-md transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
        {projects.map((project) => (
          <div key={project.id} className={`flex items-center gap-2 p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow group ${project.locked ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200'}`}>
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
                    className="w-full p-1 text-xs border border-slate-300 rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
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
                          className={`w-full p-1 text-xs border border-slate-300 rounded outline-none ${project.locked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500'}`}
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
              className="text-slate-300 hover:text-red-500 transition-colors p-1 self-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        
        {projects.length === 0 && (
          <div className="text-center text-slate-400 py-10 italic">
            No projects added yet.
          </div>
        )}
      </div>
    </div>
  );
};