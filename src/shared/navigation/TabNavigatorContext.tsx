import React, { createContext } from 'react';

import type { TabName } from './TabNavigator';

interface TabNavigatorContextValue {
  switchToTab: (tab: TabName) => void;
}

const TabNavigatorContext = createContext<TabNavigatorContextValue>({
  switchToTab: () => {},
});

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

export type { TabName };
