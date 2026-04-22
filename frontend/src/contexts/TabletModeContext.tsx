import { createContext, useContext, useState } from 'react';

interface TabletModeContextType {
  tabletMode: boolean;
  toggleTabletMode: () => void;
}

const TabletModeContext = createContext<TabletModeContextType>({
  tabletMode: false,
  toggleTabletMode: () => {},
});

export const TabletModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [tabletMode, setTabletMode] = useState(() => {
    return localStorage.getItem('gati_tablet_mode') === 'true';
  });

  const toggleTabletMode = () => {
    setTabletMode(prev => {
      const next = !prev;
      localStorage.setItem('gati_tablet_mode', String(next));
      return next;
    });
  };

  return (
    <TabletModeContext.Provider value={{ tabletMode, toggleTabletMode }}>
      {children}
    </TabletModeContext.Provider>
  );
};

export const useTabletMode = () => useContext(TabletModeContext);
