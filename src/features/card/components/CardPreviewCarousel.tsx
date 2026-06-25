import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { CARD_HEIGHT, type CardOverlay } from './VirtualCard';
import MetalCard from './MetalCard';
import StandardCard from './StandardCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** Page width within Card Manager content padding (20 × 2). */
export const CARD_CAROUSEL_PAGE_WIDTH = SCREEN_WIDTH - 40;

export type CardPreviewPage = 'virtual' | 'metal';

interface Props {
  virtualProps: {
    masked: boolean;
    showDetails?: boolean;
    last4?: string;
    overlay?: CardOverlay;
    showChevron?: boolean;
  };
  onPageChange?: (page: CardPreviewPage) => void;
}

const PAGES: CardPreviewPage[] = ['virtual', 'metal'];

export default function CardPreviewCarousel({ virtualProps, onPageChange }: Props) {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / CARD_CAROUSEL_PAGE_WIDTH);
      const clamped = Math.max(0, Math.min(PAGES.length - 1, index));
      setActiveIndex(clamped);
      onPageChange?.(PAGES[clamped]);
    },
    [onPageChange],
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.scroller}
        contentContainerStyle={styles.scrollerContent}
      >
        <View style={[styles.page, { width: CARD_CAROUSEL_PAGE_WIDTH }]}>
          <StandardCard
            masked={virtualProps.masked}
            showDetails={virtualProps.showDetails}
            last4={virtualProps.last4}
          />
        </View>
        <View style={[styles.page, { width: CARD_CAROUSEL_PAGE_WIDTH }]}>
          <MetalCard />
        </View>
      </ScrollView>
      <View style={styles.dots}>
        {PAGES.map((page, i) => (
          <View
            key={page}
            style={[
              styles.dot,
              {
                backgroundColor: i === activeIndex ? colors.primary : colors.border,
                width: i === activeIndex ? 16 : 6,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: CARD_CAROUSEL_PAGE_WIDTH,
    alignSelf: 'center',
  },
  scroller: {
    height: CARD_HEIGHT,
    backgroundColor: 'transparent',
  },
  scrollerContent: {
    alignItems: 'center',
  },
  page: {
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
