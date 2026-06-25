import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { KuraApiError } from '../../../lib/api/errors';
import { WAITLIST_PRODUCTS } from '../../../lib/api/waitlist';
import { useWaitlistJoin } from '../../waitlist/hooks/useWaitlistJoin';

export function useDinariWaitlistJoin() {
  const { t } = useTranslation();
  const waitlist = useWaitlistJoin(WAITLIST_PRODUCTS.DINARI);

  const handleJoin = useCallback(async () => {
    if (!waitlist.hasRealEmail) {
      Alert.alert(t('waitlist.emailRequiredTitle'), t('waitlist.emailRequiredBody'));
      return;
    }
    if (waitlist.joined) {
      Alert.alert(t('crypto.dinariWaitlistJoinedTitle'), t('crypto.dinariWaitlistJoinedBody'));
      return;
    }
    try {
      await waitlist.join();
      Alert.alert(t('crypto.dinariWaitlistJoinedTitle'), t('crypto.dinariWaitlistJoinedBody'));
    } catch (error) {
      if (error instanceof Error && error.message === 'WAITLIST_UNAVAILABLE') {
        Alert.alert(t('waitlist.unavailableTitle'), t('waitlist.unavailableBody'));
        return;
      }
      if (error instanceof KuraApiError && error.isRateLimited()) {
        Alert.alert(t('waitlist.rateLimitTitle'), t('waitlist.rateLimitBody'));
        return;
      }
      const message =
        error instanceof KuraApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : t('waitlist.errorGeneric');
      Alert.alert(t('waitlist.errorTitle'), message);
    }
  }, [waitlist, t]);

  return { ...waitlist, handleJoin };
}
