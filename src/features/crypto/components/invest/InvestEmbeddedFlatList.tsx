import React from 'react';
import { FlatList, type FlatListProps } from 'react-native';

import { INVEST_LIST_ROW_HEIGHT } from './investListMetrics';

const DEFAULT_INITIAL_RENDER = 20;

export interface InvestEmbeddedFlatListProps<T> {
  data: T[];
  keyExtractor: FlatListProps<T>['keyExtractor'];
  renderItem: FlatListProps<T>['renderItem'];
  /** Fixed row height enables getItemLayout; omit for section dividers / mixed rows. */
  rowHeight?: number;
  initialNumToRender?: number;
  ListFooterComponent?: FlatListProps<T>['ListFooterComponent'];
  ListEmptyComponent?: FlatListProps<T>['ListEmptyComponent'];
}

/** FlatList tuned for Invest/Earn/Stocks lists nested inside a parent ScrollView. */
export default function InvestEmbeddedFlatList<T>({
  data,
  keyExtractor,
  renderItem,
  rowHeight = INVEST_LIST_ROW_HEIGHT,
  initialNumToRender = DEFAULT_INITIAL_RENDER,
  ListFooterComponent,
  ListEmptyComponent,
}: InvestEmbeddedFlatListProps<T>) {
  const fixedLayout = rowHeight > 0;

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      scrollEnabled={false}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={initialNumToRender}
      windowSize={8}
      removeClippedSubviews
      getItemLayout={
        fixedLayout
          ? (_, index) => ({
            length: rowHeight,
            offset: rowHeight * index,
            index,
          })
          : undefined
      }
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
}
