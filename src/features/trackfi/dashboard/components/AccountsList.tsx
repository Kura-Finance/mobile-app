import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Account } from '../../../../shared/store/useFinanceStore';
import { useAppStore } from '../../../../shared/store/useAppStore';
import { useFinanceStore } from '../../../../shared/store/useFinanceStore';
import { useWalletSync } from '../../../../shared/hooks/useWalletSync';
import ConnectAccountModal from '../../../../shared/components/ConnectAccountModal';
import PlaidLinkModal from '../../../../shared/components/PlaidLinkModal';
import ExchangeLinkModal from '../../../../shared/components/ExchangeLinkModal';
import CurrencyDisplay from '../../../../shared/components/CurrencyDisplay';
import { isStablecoin } from '../../../../shared/utils/stablecoinUtils';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

interface AccountsListProps {
  accounts: Account[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  totalBalance: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = 118; // 卡片高度
const CARD_OVERLAP = 80; // 重叠距离
const CONTAINER_HEIGHT = Math.round(SCREEN_HEIGHT * 0.28); // 容器高度

export default function AccountsList({
  accounts,
  selectedAccountId,
  onSelectAccount,
  totalBalance,
}: AccountsListProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showPlaidModal, setShowPlaidModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const plaidLinkToken = useAppStore((state: any) => state.plaidLinkToken);
  
  // Web3 Wallet - 直接获取连接状态
  const { isConnected, address, openWallet } = useWalletSync();
  const investments = useFinanceStore((state) => state.investments);
  
  // Calculate Stablecoin (USDC, USDT, USDC.B, USDT.E, etc.) balance
  const stablecoinBalance = investments
    .filter((inv) => isStablecoin(inv.symbol))
    .reduce((sum, inv) => sum + (inv.holdings * inv.currentPrice), 0);

  // 默认滚动到最底部
  useEffect(() => {
    setTimeout(() => {
      // 计算总高度：所有卡片（包括 Overview 和可能的 Web3）
      const totalCards = accounts.length + 1 + (isConnected ? 1 : 0); // accounts + Overview + Web3 (optional)
      const totalHeight = CARD_HEIGHT + ((totalCards - 1) * CARD_OVERLAP);
      const scrollPosition = Math.max(0, totalHeight - CONTAINER_HEIGHT);
      scrollViewRef.current?.scrollTo({ y: scrollPosition, animated: false });
    }, 0);
  }, [accounts.length, isConnected]);

  return (
    <>
      {/* 帳戶卡片容器 - 可垂直滾動 */}
      <View style={{ height: CONTAINER_HEIGHT, marginBottom: 0, marginTop: 0, marginHorizontal: 16, backgroundColor: colors.background, overflow: 'hidden' }}>
        <ScrollView
          ref={scrollViewRef}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: CARD_HEIGHT / 2, minHeight: CONTAINER_HEIGHT + 1 }}
          nestedScrollEnabled={true}
        >
          {/* Connect Account 卡片 - 第一個渲染，zIndex 最低，被其他卡片覆蓋 */}
          <TouchableOpacity
            onPress={() => setShowConnectModal(true)}
            activeOpacity={0.9}
            style={{
              borderRadius: 16,
              marginTop: 0,
              zIndex: 0,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: colors.borderStrong,
              borderStyle: 'dashed',
              shadowColor: 'transparent',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0,
              shadowRadius: 0,
              elevation: 0,
            }}
          >
            <View
              style={{ height: CARD_HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 16, backgroundColor: 'transparent' }}
            >
              {/* Top Row: Connect Account Text (left) and Plus (right) */}
              <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                {/* Left Container - Connect Account Text */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: colors.textMuted, fontWeight: '600' }}>{t('dashboard.connectPlaid')}</Text>
                </View>
                {/* Right Container - Plus Icon */}
                <View style={{ marginTop: -12 }}>
                  <Text style={{ fontSize: 28, color: colors.text, fontWeight: '600', marginLeft: 8 }}>+</Text>
                </View>
              </View>

              {/* Bottom: Add Account (left) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.28 }}>{t('investments.addAccount')}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 帳戶卡片 - 從高 index 開始渲染（排序在上面） */}
          {[...accounts].reverse().map((account, index) => {
            const isSelected = selectedAccountId === account.id;
            const balanceValue = account.type === 'credit' ? -account.balance : account.balance;
            // 第一个卡片无负margin，之后的卡片都用负margin实现重叠
            const marginTop = -CARD_OVERLAP;
            
            // 根据索引交替使用不同的颜色主题，和前端一样
            const accentColors = isSelected 
              ? ([colors.primary, colors.primaryDark] as const)
              : (index % 2 === 0 ? ([colors.surface, colors.surface] as const) : ([colors.background, colors.background] as const));

            return (
              <TouchableOpacity
                key={account.id}
                onPress={() => onSelectAccount(account.id)}
                activeOpacity={0.9}
                style={{
                  borderRadius: 16,
                  marginTop,
                  zIndex: index + 1,
                  overflow: 'hidden',
                  borderWidth: 2,
                  borderColor: colors.surface,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 18 },
                  shadowOpacity: 0.35,
                  shadowRadius: 40,
                  elevation: 5,
                }}
              >
                <LinearGradient 
                  colors={accentColors}
                  style={{ height: CARD_HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 16, shadowColor: isSelected ? colors.primary : 'transparent', shadowOffset: { width: 0, height: 10 }, shadowOpacity: isSelected ? 0.4 : 0, shadowRadius: 40, elevation: isSelected ? 5 : 0 }}
                >
                  {/* Top Row: Account name (left) and Balance (right) */}
                  <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    {/* Left Container - Account Name */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: isSelected ? colors.textInverse : colors.textMuted, fontWeight: '600' }} numberOfLines={1}>
                        {account.name}
                      </Text>
                    </View>
                    {/* Right Container - Balance */}
                    <View>
                      <CurrencyDisplay
                        value={balanceValue}
                        fontSize={18}
                        color={isSelected ? colors.textInverse : colors.text}
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                  </View>

                  {/* Bottom: Type label (left) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                    <Text style={{ fontSize: 11, color: isSelected ? colors.textInverse : colors.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.28 }}>
                      {account.type === 'credit'
                        ? t('accounts.creditCard')
                        : account.type === 'saving'
                          ? t('accounts.savings')
                          : account.type === 'crypto'
                            ? t('investments.crypto')
                            : t('accounts.checking')}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}

          {/* Web3 Wallet Card - 如果連接了 */}
          {isConnected && address && (
            <TouchableOpacity
              onPress={openWallet}
              activeOpacity={0.9}
              style={{
                borderRadius: 16,
                marginTop: -CARD_OVERLAP,
                zIndex: accounts.length + 1,
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: colors.surface,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 18 },
                shadowOpacity: 0.35,
                shadowRadius: 40,
                elevation: 5,
              }}
            >
              <LinearGradient 
                colors={[colors.surface, colors.surface]}
                style={{ height: CARD_HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 16 }}
              >
                {/* Top Row: Address (left) and Stablecoin (right) */}
                <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  {/* Left Container - Wallet Address (First 5 chars) */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: colors.textMuted, fontWeight: '600' }} numberOfLines={1}>
                      {address.slice(0, 5)}...
                    </Text>
                  </View>
                  {/* Right Container - Stablecoin Balance */}
                  <View>
                    <CurrencyDisplay
                      value={stablecoinBalance}
                      fontSize={18}
                      color={colors.text}
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                </View>

                {/* Bottom: Web3 Wallet label (left) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.28 }}>
                    {t('dashboard.web3Wallet')}
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Overview 卡片 - 最後渲染（排序在底部），但 zIndex 最高（圖層在最上面） */}
          <TouchableOpacity
            onPress={() => onSelectAccount('all')}
            activeOpacity={0.9}
            style={{
              borderRadius: 16,
              marginTop: -CARD_OVERLAP,
              zIndex: accounts.length + (isConnected ? 2 : 1),
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: colors.surface,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 18 },
              shadowOpacity: 0.35,
              shadowRadius: 40,
              elevation: 5,
            }}
          >
            <LinearGradient 
              colors={selectedAccountId === 'all' ? ([colors.primary, colors.primaryDark] as const) : ([colors.surface, colors.surface] as const)}
              style={{ height: CARD_HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 16, shadowColor: selectedAccountId === 'all' ? colors.primary : 'transparent', shadowOffset: { width: 0, height: 10 }, shadowOpacity: selectedAccountId === 'all' ? 0.4 : 0, shadowRadius: 40, elevation: selectedAccountId === 'all' ? 5 : 0 }}
            >
              {/* Top Row: Overview (left) and Total Balance (right) */}
              <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                {/* Left Container - Overview Text */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: selectedAccountId === 'all' ? colors.textInverse : colors.textMuted, fontWeight: '600' }}>{t('dashboard.overview')}</Text>
                </View>
                {/* Right Container - Total Balance */}
                <View>
                  <CurrencyDisplay
                    value={totalBalance}
                    fontSize={18}
                    color={selectedAccountId === 'all' ? colors.textInverse : colors.text}
                    style={{ marginLeft: 8 }}
                  />
                </View>
              </View>

              {/* Bottom: All Accounts (left) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                <Text style={{ fontSize: 11, color: selectedAccountId === 'all' ? colors.textInverse : colors.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.28 }}>{t('dashboard.allAccounts')}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Connect Account Modal */}
      <ConnectAccountModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onPlaidPress={() => setShowPlaidModal(true)}
        onWeb3Press={() => {
          // Web3 wallet connection is handled directly by AppKit modal
          // No additional modal needed
        }}
        onExchangePress={() => setShowExchangeModal(true)}
      />

      {/* Plaid Link Modal */}
      <PlaidLinkModal
        isVisible={showPlaidModal}
        linkToken={plaidLinkToken}
        onClose={() => setShowPlaidModal(false)}
        onSuccess={() => setShowPlaidModal(false)}
      />

      {/* Exchange Link Modal */}
      <ExchangeLinkModal
        isOpen={showExchangeModal}
        onClose={() => setShowExchangeModal(false)}
        onSuccess={() => {
          // Exchange account connected successfully
          // You can add additional logic here if needed
        }}
      />
    </>
  );
}
