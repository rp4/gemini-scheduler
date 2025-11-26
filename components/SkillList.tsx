
import React, { useState } from 'react';
import { GlobalConfig } from '../types';
import { Plus, Trash2, Award, Search } from 'lucide-react';

interface SkillListProps {
  config: GlobalConfig;
  setConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
}

export const SkillList: React.FC<SkillListProps> = ({ config, setConfig }) => {
  const [newSkill, setNewSkill] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddSkill = () => {
    if (!newSkill.trim()) return;
    if (config.skills.includes(newSkill.trim())) return;

    setConfig({
      ...config,
      skills: [...config.skills, newSkill.trim()].sort()
    });
    setNewSkill('');
  };

  const removeSkill = (skillToRemove: string) => {
    setConfig({
      ...config,
      skills: config.skills.filter(s => s !== skillToRemove)
    });
  };

  const filteredSkills = config.skills.filter(s => 
    s.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-600" />
          Skills Library
        </h2>
      </div>

      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search skills..." 
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
            <input 
                type="text" 
                placeholder="Add new skill..." 
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
            />
            <button 
                onClick={handleAddSkill}
                disabled={!newSkill.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
            >
                <Plus className="w-5 h-5" />
            </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1 min-h-0">
        {filteredSkills.map((skill) => (
          <div 
            key={skill} 
            className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg hover:border-indigo-200 hover:shadow-sm transition-all group"
          >
             <span className="text-sm text-slate-700">{skill}</span>
             <button
                onClick={() => removeSkill(skill)}
                className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove Skill"
             >
                <Trash2 className="w-3.5 h-3.5" />
             </button>
          </div>
        ))}
        {filteredSkills.length === 0 && (
            <div className="p-4 text-center text-slate-400 text-xs italic">
                No skills found.
            </div>
        )}
      </div>
    </div>
  );
};
