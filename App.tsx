import React, { useState, useEffect, useMemo } from 'react';
import { GlobalConfig, ProjectInput, PhaseName } from './types';
import { DEFAULT_CONFIG, INITIAL_PROJECTS } from './constants';
import { generateSchedule, optimizeSchedule } from './services/scheduleEngine';
import { ProjectList } from './components/ProjectList';
import { ScheduleTable } from './components/ScheduleTable';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { Settings, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [projects, setProjects] = useState<ProjectInput[]>(INITIAL_PROJECTS);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Recalculate schedule whenever config or projects change
  const scheduleData = useMemo(() => {
    return generateSchedule(projects, config);
  }, [projects, config]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const optimizedProjects = optimizeSchedule(projects, config);
      setProjects(optimizedProjects);
      setIsOptimizing(false);
    }, 50);
  };

  const handleCellUpdate = (projectId: string, staffTypeId: string, staffIndex: number, date: string, value: any, type: 'hours' | 'phase') => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;

      const newOverrides = { ...p.overrides } || { phase: {}, staff: {} };
      if (!newOverrides.phase) newOverrides.phase = {};
      if (!newOverrides.staff) newOverrides.staff = {};

      if (type === 'phase') {
         newOverrides.phase[date] = value as PhaseName;
      } else if (type === 'hours') {
         const key = `${staffTypeId}-${staffIndex}`;
         if (!newOverrides.staff[key]) newOverrides.staff[key] = {};
         newOverrides.staff[key][date] = Number(value);
      }

      return { ...p, overrides: newOverrides };
    }));
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">
            AS
          </div>
          <h1 className="text-xl font-bold tracking-tight">AuditScheduler <span className="font-light text-indigo-300">Pro</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-400 mr-4 hidden md:block">
            Planning Year: <span className="text-white font-mono">{config.year}</span>
          </div>
          
          <button 
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-md text-sm font-medium transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Sparkles className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
            {isOptimizing ? 'Optimizing...' : 'Auto-Optimize'}
          </button>

          <button 
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sm transition-all border border-slate-700"
          >
            <Settings className="w-4 h-4" />
            Configure Rules
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left Sidebar: Projects */}
        <aside className="w-96 shrink-0 flex flex-col h-full">
          <ProjectList projects={projects} setProjects={setProjects} currentConfig={config} />
        </aside>

        {/* Main Area: Schedule Table */}
        <section className="flex-1 h-full min-w-0">
          <ScheduleTable data={scheduleData} onCellUpdate={handleCellUpdate} />
        </section>
      </main>

      {/* Configuration Modal */}
      <ConfigurationPanel 
        config={config} 
        setConfig={setConfig} 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
      />
    </div>
  );
};

export default App;