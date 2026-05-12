import React, { createContext, useContext, useRef } from 'react';

type TabName = 'Home' | 'Portfolio' | 'TrackFi';

interface TabNavigatorContextValue {
  switchToTab: (tab: TabName) => void;
}

const TabNavigatorContext = createContext<TabNavigatorContextValue>({
  switchToTab: () => {},
});

export function useTabNavigator() {
  return useContext(TabNavigatorContext);
}

interface Props {
  children: React.ReactNode;
  switchToTab: (tab: TabName) => void;
}

export function TabNavigatorProvider({ children, switchToTab }: Props) {
  return (
    <TabNavigatorContext.Provider value={{ switchToTab }}>
      {children}
    </TabNavigatorContext.Provider>
  );
}
