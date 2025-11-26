import React, { useState, useEffect, useMemo } from 'react';
import { GlobalConfig, ProjectInput, PhaseName, PhaseConfig } from './types';
import { DEFAULT_CONFIG, INITIAL_PROJECTS, TEAMS } from './constants';
import { generateSchedule, optimizeSchedule } from './services/scheduleEngine';
import { ProjectList } from './components/ProjectList';
import { TeamMemberList } from './components/TeamMemberList';
import { SkillList } from './components/SkillList';
import { ScheduleTable, ViewMode } from './components/ScheduleTable';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { Calendar, Filter, LayoutGrid, Users, Award } from 'lucide-react';

const App: React.FC = () => {
  const [config, setConfig] = useState<GlobalConfig>(DEFAULT_CONFIG);
  const [projects, setProjects] = useState<ProjectInput[]>(INITIAL_PROJECTS);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('project');

  // Filter State (UI only)
  const [fromDate, setFromDate] = useState('2024-12-31');
  const [toDate, setToDate] = useState('2026-03-30');
  const [selectedTeam, setSelectedTeam] = useState('All Teams');

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

      // Deep copy override structure to ensure immutability
      const currentOverrides = p.overrides || {};
      const newOverrides: any = { 
        phase: { ...(currentOverrides.phase || {}) },
        staff: { ...(currentOverrides.staff || {}) }
      };

      if (type === 'phase') {
         newOverrides.phase[date] = value as PhaseName;
      } else if (type === 'hours') {
         const key = `${staffTypeId}-${staffIndex}`;
         // Ensure the specific staff member's record is also a new object copy
         newOverrides.staff[key] = { ...(newOverrides.staff[key] || {}) };
         newOverrides.staff[key][date] = Number(value);
      }

      return { ...p, overrides: newOverrides };
    }));
  };

  const handleAssignmentChange = (projectId: string, oldStaffTypeId: string, newStaffTypeId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;

      // Ensure we have a config to edit (fallback to default phases if project's are missing)
      const currentPhases = p.phasesConfig && p.phasesConfig.length > 0 
          ? p.phasesConfig 
          : JSON.parse(JSON.stringify(config.phases));

      const newPhases = currentPhases.map((phase: PhaseConfig) => {
        const allocations = [...phase.staffAllocation];
        const oldAllocIndex = allocations.findIndex(a => a.staffTypeId === oldStaffTypeId);
        
        if (oldAllocIndex === -1) return phase;

        const oldAlloc = allocations[oldAllocIndex];
        const newAllocIndex = allocations.findIndex(a => a.staffTypeId === newStaffTypeId);

        if (newAllocIndex !== -1) {
            // Merge percentages if target already exists in this phase
            allocations[newAllocIndex] = {
                ...allocations[newAllocIndex],
                percentage: allocations[newAllocIndex].percentage + oldAlloc.percentage
            };
            // Remove the old allocation entry
            allocations.splice(oldAllocIndex, 1);
        } else {
            // Simply swap the Staff Type ID
            allocations[oldAllocIndex] = {
                ...oldAlloc,
                staffTypeId: newStaffTypeId
            };
        }
        
        return { ...phase, staffAllocation: allocations };
      });

      // Cleanup overrides for the old staff type to prevent ghost data
      let newOverrides = p.overrides;
      if (p.overrides?.staff) {
          const staffOverrides = { ...p.overrides.staff };
          let hasChanges = false;
          
          Object.keys(staffOverrides).forEach(key => {
              if (key.startsWith(oldStaffTypeId + '-')) {
                  delete staffOverrides[key];
                  hasChanges = true;
              }
          });
          
          if (hasChanges) {
            newOverrides = { ...p.overrides, staff: staffOverrides };
          }
      }

      return { ...p, phasesConfig: newPhases, overrides: newOverrides };
    }));
  };

  const renderSidebar = () => {
      switch(viewMode) {
          case 'skill':
              return <SkillList config={config} setConfig={setConfig} />;
          case 'member':
              return <TeamMemberList config={config} setConfig={setConfig} />;
          case 'project':
          default:
              return (
                <ProjectList 
                    projects={projects} 
                    setProjects={setProjects} 
                    currentConfig={config} 
                    onOptimize={handleOptimize}
                    isOptimizing={isOptimizing}
                    onConfigure={() => setIsConfigOpen(true)}
                />
              );
      }
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

        {/* View Mode Tabs */}
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button 
                onClick={() => setViewMode('project')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'project' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
            >
                <LayoutGrid className="w-3.5 h-3.5" />
                By Project
            </button>
            <button 
                onClick={() => setViewMode('member')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'member' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
            >
                <Users className="w-3.5 h-3.5" />
                By Member
            </button>
            <button 
                onClick={() => setViewMode('skill')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'skill' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
            >
                <Award className="w-3.5 h-3.5" />
                By Skill
            </button>
        </div>
        
        {/* Right Side Actions / Filters */}
        <div className="flex items-center gap-3">
            {/* Date Filters Group */}
            <div className="hidden md:flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                <div className="flex items-center gap-2 px-2 border-r border-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs text-slate-400 font-medium">From:</span>
                    <input 
                        type="date" 
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="bg-transparent text-xs text-white focus:outline-none w-[110px] [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 cursor-pointer"
                    />
                </div>
                <div className="flex items-center gap-2 px-2">
                    <span className="text-xs text-slate-400 font-medium">To:</span>
                    <input 
                        type="date" 
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="bg-transparent text-xs text-white focus:outline-none w-[110px] [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 cursor-pointer"
                    />
                </div>
            </div>

            {/* Team Filter */}
            <div className="flex items-center">
                <div className="relative">
                    <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select 
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-slate-600 transition-all cursor-pointer appearance-none min-w-[120px]"
                    >
                        <option value="All Teams">All Teams</option>
                        {TEAMS.map(team => (
                            <option key={team} value={team}>{team}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left Sidebar */}
        <aside className="w-96 shrink-0 flex flex-col h-full">
           {renderSidebar()}
        </aside>

        {/* Main Area: Schedule Table */}
        <section className="flex-1 h-full min-w-0">
          <ScheduleTable 
            data={scheduleData} 
            projects={projects}
            config={config}
            onCellUpdate={handleCellUpdate} 
            onAssignmentChange={handleAssignmentChange}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
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