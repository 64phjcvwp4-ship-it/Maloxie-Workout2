import React, { useState } from 'react';
import { MaloxieProvider, useMaloxie } from './context/MaloxieContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import HoloMosaic from './components/HoloMosaic';
import DashboardView from './components/views/DashboardView';
import WorkoutLoggerView from './components/views/WorkoutLoggerView';
import ProgressAnalyticsView from './components/views/ProgressAnalyticsView';
import LibraryAndGoalsView from './components/views/LibraryAndGoalsView';
import CrystalBallAiView from './components/views/CrystalBallAiView';
import { SoapBubbleMaterial } from './components/soap-bubble';
import { MaloxieButton } from './components/ui/MaloxieButton';
import type { WorkspaceTab, WorkoutTemplate } from './types/training';

function MaloxieShell() {
  const {
    user,
    authReady,
    unit,
    toggleUnit,
    signInWithGoogle,
    signOut,
    exportTrainingJson,
    actionError,
    clearActionError,
  } = useMaloxie();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [templateToLoad, setTemplateToLoad] = useState<WorkoutTemplate | null>(null);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string>('');

  const navItems: { id: WorkspaceTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'logger', label: 'Workout Log' },
    { id: 'progress', label: 'Progress' },
    { id: 'library', label: 'Library' },
    { id: 'ai', label: 'Maloxie AI' },
  ];

  return (
    <div className="relative min-h-screen bg-[#08080A] text-[#F5F5F7] flex flex-col">
      {/* Obsidian & Burnished-Amber HoloMosaic Atmospheric Backdrop */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <HoloMosaic
          color="#08080a"
          metalColor="#f4b86a"
          spectrum="warm"
          tileSize={1.15}
          gap={0.07}
          roundness={0.22}
          bevel={0.34}
          scatter={0.28}
          tilt={0.32}
          swirl={0.9}
          ripple={0.48}
          bands={1.2}
          softness={0.58}
          intensity={0.8}
          saturation={0.74}
          glitter={0.18}
          sheen={0.72}
          grain={0.05}
          speed={0.35}
          opacity={0.72}
          mouseInteraction
          mouseStrength={0.7}
          mouseRadius={0.28}
          flipOnClick={false}
          lightMode={false}
        />
      </div>

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#08080A]/65 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Brand mark + wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="inline-flex items-center gap-2.5 text-[21px] font-display font-bold tracking-[-0.035em] text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="inline-flex items-center justify-center w-8 h-6 overflow-hidden shrink-0">
              <img
                src="/assets/aistudio/1795213782478_6c4c1cc1.jpg"
                alt=""
                aria-hidden="true"
                className="w-full h-full object-contain scale-[2.5] invert contrast-[1.45] brightness-110 mix-blend-screen select-none pointer-events-none"
              />
            </span>
            <span>Maloxie</span>
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer border-b-2 ${
                    active
                      ? 'text-white border-[#E89B3C]'
                      : 'text-zinc-400 border-transparent hover:text-zinc-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="shrink-0">
            <MaloxieButton
              variant="primary"
              size="md"
              onClick={() => setActiveTab('logger')}
            >
              Log Workout
            </MaloxieButton>
          </div>
        </div>

        {/* Mobile Nav Strip */}
        <div className="md:hidden border-t border-white/[0.06] px-4 py-2 flex items-center gap-5 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`text-xs whitespace-nowrap shrink-0 py-1 ${
                activeTab === item.id ? 'text-[#F4B86A] font-semibold' : 'text-zinc-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Workspace Utility Strip (below header per Top Bar Contract) */}
      <div className="relative z-10 border-b border-white/[0.05] bg-[#0B0B0E]/45 backdrop-blur-xl">
        <div className="max-w-7xl w-full mx-auto px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="text-zinc-300 font-medium">
              {user
                ? `${user.email} · Cloud Synced`
                : authReady
                  ? 'Guest Workspace (Local Mode)'
                  : 'Initializing Workspace...'}
            </span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <div className="inline-flex rounded-xl bg-white/[0.05] border border-white/[0.07] p-0.5">
              {(['kg', 'lbs'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => toggleUnit(u)}
                  className={`px-2.5 py-0.5 rounded-lg font-mono text-[11px] transition-colors cursor-pointer ${
                    unit === u ? 'bg-[#E89B3C] text-[#09090B] font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <MaloxieButton
              variant="subtle"
              size="xs"
              onClick={exportTrainingJson}
            >
              Export JSON
            </MaloxieButton>
            {user ? (
              <MaloxieButton
                variant="subtle"
                size="xs"
                onClick={signOut}
              >
                Sign Out
              </MaloxieButton>
            ) : (
              <MaloxieButton
                variant="secondary"
                size="xs"
                onClick={signInWithGoogle}
              >
                Sign in with Google
              </MaloxieButton>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="relative z-10 max-w-7xl w-full mx-auto px-6 pt-4">
          <div className="rounded-2xl bg-red-500/10 backdrop-blur-xl border border-red-500/25 p-3.5 text-xs text-red-200 flex items-center justify-between gap-4">
            <span>{actionError}</span>
            <button type="button" onClick={clearActionError} className="underline cursor-pointer">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigate={setActiveTab}
            onAskCrystalBall={(prompt) => {
              setAiInitialPrompt(prompt);
              setActiveTab('ai');
            }}
          />
        )}
        {activeTab === 'logger' && (
          <WorkoutLoggerView
            selectedTemplateToLoad={templateToLoad}
            onClearTemplateToLoad={() => setTemplateToLoad(null)}
          />
        )}
        {activeTab === 'progress' && <ProgressAnalyticsView />}
        {activeTab === 'library' && (
          <LibraryAndGoalsView
            onStartTemplate={(tpl) => {
              setTemplateToLoad(tpl);
              setActiveTab('logger');
            }}
          />
        )}
        {activeTab === 'ai' && (
          <CrystalBallAiView
            initialPrompt={aiInitialPrompt}
            onClearInitialPrompt={() => setAiInitialPrompt('')}
          />
        )}
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-6 px-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
        <span className="inline-flex items-center justify-center w-5 h-4 overflow-hidden shrink-0 opacity-75">
          <img
            src="/assets/aistudio/1795213782478_6c4c1cc1.jpg"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain scale-[2.5] invert contrast-[1.45] brightness-110 mix-blend-screen select-none pointer-events-none"
          />
        </span>
        <span>Maloxie Strength Log &amp; AI Training Studio · {user ? 'Cloud Synced' : 'Local Workspace'}</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SoapBubbleMaterial environment="studio">
        <MaloxieProvider>
          <MaloxieShell />
        </MaloxieProvider>
      </SoapBubbleMaterial>
    </ErrorBoundary>
  );
}
