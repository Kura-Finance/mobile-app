import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import KuraCardScreen from '../../features/card/screens/KuraCardScreen';
import InvestScreen from '../../features/crypto/screens/InvestScreen';
import BorrowScreen from '../../features/borrow/screens/BorrowScreen';
import PortfolioScreen from '../../features/crypto/screens/PortfolioScreen';
import TrackFiScreen from '../../features/trackfi/screens/TrackFiScreen';
import { TabNavigatorProvider } from './TabNavigatorContext';
import { useTheme } from '../theme/ThemeContext';
import { useHeaderStore } from '../store/useHeaderStore';
import { features } from '../../config/features';
import { setTrackFiHeaderHandlers } from '../../features/trackfi/navigation/trackFiHeaderHandlers';

export type TabName = 'Home' | 'Invest' | 'Borrow' | 'Portfolio' | 'TrackFi';
export type InvestmentCategory = 'Transaction' | 'Stock' | 'Crypto' | 'DeFi';

interface TabOption {
  name: TabName;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
}

const TAB_SCREENS: Record<TabName, React.ComponentType> = {
  Home: KuraCardScreen,
  Invest: InvestScreen,
  Borrow: BorrowScreen,
  Portfolio: PortfolioScreen,
  TrackFi: TrackFiScreen,
};

const TABS: TabOption[] = [
  { name: 'Home',      icon: 'home-outline',       labelKey: 'nav.home'      },
  { name: 'Invest',    icon: 'stats-chart-outline', labelKey: 'nav.invest'    },
  { name: 'Borrow',    icon: 'arrow-down-circle-outline', labelKey: 'nav.borrow' },
  { name: 'Portfolio', icon: 'pie-chart-outline',  labelKey: 'nav.portfolio' },
  { name: 'TrackFi',   icon: 'trending-up-outline', labelKey: 'nav.trackFi'   },
];

export default function TabNavigator() {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const setScrolled = useHeaderStore((s) => s.setScrolled);
  const setHeaderContent = useHeaderStore((s) => s.setHeaderContent);
  const setTrackFiToolbar = useHeaderStore((s) => s.setTrackFiToolbar);

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => {
      if (tab.name === 'TrackFi' && !features.trackFi) return false;
      if (tab.name === 'Borrow' && !features.morphoEarn) return false;
      return true;
    }),
    [],
  );

  /** Mount each tab once visited so TrackFi passkey state survives tab switches. */
  const [mountedTabs, setMountedTabs] = useState<Set<TabName>>(() => new Set(['Home']));

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'TrackFi' && !features.trackFi) {
      setActiveTab('Home');
    } else if (activeTab === 'Borrow' && !features.morphoEarn) {
      setActiveTab('Home');
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'Portfolio') {
      setHeaderContent(t('nav.portfolio'), t('crypto.portfolioSubtitle'));
    } else if (activeTab === 'Invest') {
      setHeaderContent(t('nav.invest'), t('crypto.investSubtitle'));
    } else if (activeTab === 'Borrow') {
      setHeaderContent(t('crypto.borrow'), t('crypto.borrowSubtitle'));
    } else if (activeTab !== 'TrackFi') {
      setHeaderContent(null, null);
    }

    if (activeTab !== 'TrackFi') {
      setTrackFiToolbar(null);
      setTrackFiHeaderHandlers(null);
    }
  }, [activeTab, setHeaderContent, setTrackFiToolbar, t]);

  const handleSelectTab = (name: TabName) => {
    setScrolled(false);
    setActiveTab(name);
  };

  const renderTabItems = () => (
    <View style={styles.tabContainer}>
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => handleSelectTab(tab.name)}
            style={[
              styles.tabButton,
              { backgroundColor: isActive ? colors.primarySoft : 'transparent' },
            ]}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={isActive ? colors.primary : colors.text}
            />
            <Text
              style={[
                styles.tabText,
                { color: isActive ? colors.primary : colors.text, fontWeight: isActive ? '600' : '400' },
              ]}
              numberOfLines={1}
            >
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <TabNavigatorProvider activeTab={activeTab} switchToTab={handleSelectTab}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1 }}>
          {Array.from(mountedTabs).map((tabName) => {
            const Screen = TAB_SCREENS[tabName];
            const isActive = activeTab === tabName;
            return (
              <View
                key={tabName}
                style={{ flex: 1, display: isActive ? 'flex' : 'none' }}
                pointerEvents={isActive ? 'auto' : 'none'}
              >
                <Screen />
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.wrapper,
            { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: 'transparent' },
          ]}
        >
          {isLiquidGlassSupported ? (
            <LiquidGlassView
              effect="regular"
              colorScheme={scheme}
              tintColor="rgba(139, 92, 246, 0.05)"
              style={styles.capsuleShape}
            >
              {renderTabItems()}
            </LiquidGlassView>
          ) : (
            <View style={[styles.capsuleShape, styles.fallbackCapsule, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
              {renderTabItems()}
            </View>
          )}
        </View>
      </View>
    </TabNavigatorProvider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 8,
    alignItems: 'center',
  },
  capsuleShape: {
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  fallbackCapsule: {
    backgroundColor: '#1A1A24',
    borderWidth: 1,
    borderColor: 'rgba(139, 139, 149, 0.3)',
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 9,
    marginTop: 2,
  },
});
