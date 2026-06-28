import React, { createContext, useContext } from 'react';

import type { TabName } from './TabNavigator';

interface TabNavigatorContextValue {
  activeTab: TabName;
  switchToTab: (tab: TabName) => void;
}

const TabNavigatorContext = createContext<TabNavigatorContextValue>({
  activeTab: 'Home',
  switchToTab: () => {},
});

export function useTabNavigator(): TabNavigatorContextValue {
  return useContext(TabNavigatorContext);
}

interface Props {
  children: React.ReactNode;
  activeTab: TabName;
  switchToTab: (tab: TabName) => void;
}

export function TabNavigatorProvider({ children, activeTab, switchToTab }: Props) {
  return (
    <TabNavigatorContext.Provider value={{ activeTab, switchToTab }}>
      {children}
    </TabNavigatorContext.Provider>
  );
}

export type { TabName };
