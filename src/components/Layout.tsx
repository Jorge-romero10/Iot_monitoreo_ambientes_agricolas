import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { DarkModeProvider, useDarkMode } from './DarkModeContext';

export const Layout: React.FC<{ 
  children: React.ReactNode
  isOnline?: boolean
  statusHint?: string
}> = ({ children, isOnline, statusHint }) => {
  return (
    <DarkModeProvider>
      <LayoutContent isOnline={isOnline} statusHint={statusHint}>{children}</LayoutContent>
    </DarkModeProvider>
  );
};

const LayoutContent: React.FC<{ 
  children: React.ReactNode
  isOnline?: boolean
  statusHint?: string
}> = ({ children, isOnline, statusHint }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { darkMode, toggleDarkMode } = useDarkMode();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'dark' : ''}`}>
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header 
          toggleSidebar={toggleSidebar} 
          darkMode={darkMode} 
          toggleDarkMode={toggleDarkMode}
          isOnline={isOnline}
          statusHint={statusHint}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
};