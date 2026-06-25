import React, { useEffect, useMemo, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import KuraCardScreen from '../../features/card/screens/KuraCardScreen';
import DiscoverScreen from '../../features/crypto/screens/DiscoverScreen';
import PortfolioScreen from '../../features/crypto/screens/PortfolioScreen';
import TrackFiScreen from '../../features/trackfi/screens/TrackFiScreen';
import { TabNavigatorProvider } from './TabNavigatorContext';
import { useTheme } from '../theme/ThemeContext';
import { useHeaderStore } from '../store/useHeaderStore';
import { features } from '../../config/features';

const Stack = createNativeStackNavigator();

export type TabName = 'Home' | 'Discover' | 'Portfolio' | 'TrackFi';
export type InvestmentCategory = 'Transaction' | 'Stock' | 'Crypto' | 'DeFi';

interface TabOption {
  name: TabName;
  icon: string;
  labelKey: string;
}

const TABS: TabOption[] = [
  { name: 'Home',      icon: 'home-outline',        labelKey: 'nav.home'      },
  { name: 'Discover',  icon: 'compass-outline',     labelKey: 'nav.discover'  },
  { name: 'Portfolio', icon: 'pie-chart-outline',   labelKey: 'nav.portfolio' },
  { name: 'TrackFi',   icon: 'trending-up-outline', labelKey: 'nav.trackFi'   },
];

export default function TabNavigator() {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const { t } = useTranslation();
  const setScrolled = useHeaderStore((s) => s.setScrolled);

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => tab.name !== 'TrackFi' || features.trackFi),
    [],
  );

  useEffect(() => {
    if (activeTab === 'TrackFi' && !features.trackFi) {
      setActiveTab('Home');
    }
  }, [activeTab]);

  const handleSelectTab = (name: TabName) => {
    setScrolled(false);
    setActiveTab(name);
  };

  const ScreenComponent = useMemo(() => {
    switch (activeTab) {
      case 'Home':
        return KuraCardScreen;
      case 'Discover':
        return DiscoverScreen;
      case 'Portfolio':
        return PortfolioScreen;
      case 'TrackFi':
        return TrackFiScreen;
      default:
        return KuraCardScreen;
    }
  }, [activeTab]);

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
              name={tab.icon as any}
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
    <TabNavigatorProvider switchToTab={handleSelectTab}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="TabContent">
            {() => <ScreenComponent />}
          </Stack.Screen>
        </Stack.Navigator>

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
