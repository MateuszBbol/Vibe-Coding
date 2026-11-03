import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Colors, Spacing } from '@/constants/theme';
import { HouseholdInvitation } from '@/features/households/HouseholdInvitation';
import { HouseholdSetup } from '@/features/households/HouseholdSetup';
import {
  HouseholdButton,
  HouseholdFrame,
  HouseholdMessage,
} from '@/features/households/HouseholdUI';
import {
  hasHouseholdCapacity,
  householdQueryKeys,
  isValidHouseholdId,
} from '@/features/households/routes';
import { useHouseholds } from '@/features/households/useHouseholds';
import type { Household } from '@/features/households/data';
import { strings } from '@/localization';

function isHouseholdOwner(household: Household, userId: string): boolean {
  return household.role === 'owner' && household.owner_id === userId;
}

export default function HouseholdInvitationsRoute() {
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const requestedHouseholdId = Array.isArray(params.householdId)
    ? params.householdId[0]
    : params.householdId;
  const { userId, households, membershipsQuery, activeHouseholdId, selectActiveHousehold } =
    useHouseholds();
  const queryClient = useQueryClient();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.household;
  const ownedHouseholds = useMemo(
    () => (userId ? households.filter((household) => isHouseholdOwner(household, userId)) : []),
    [households, userId],
  );
  const requestedHousehold = isValidHouseholdId(requestedHouseholdId)
    ? ownedHouseholds.find((household) => household.id === requestedHouseholdId)
    : undefined;
  const preferredHousehold =
    requestedHousehold ??
    ownedHouseholds.find((household) => household.id === activeHouseholdId) ??
    ownedHouseholds[0];
  const effectiveSelectedHouseholdId = ownedHouseholds.some(
    (household) => household.id === selectedHouseholdId,
  )
    ? selectedHouseholdId
    : (preferredHousehold?.id ?? null);
  const selectedHousehold = ownedHouseholds.find(
    (household) => household.id === effectiveSelectedHouseholdId,
  );
  const atMembershipLimit = !hasHouseholdCapacity(households.length);

  const completeJoin = async (householdId: string) => {
    const result = await membershipsQuery.refetch();
    if (!result.data?.some((household) => household.id === householdId)) {
      return;
    }
    await selectActiveHousehold(householdId);
    await queryClient.invalidateQueries({
      queryKey: householdQueryKeys.memberships(userId ?? ''),
    });
    router.back();
  };

  return (
    <HouseholdFrame
      title={text.invitationsTitle}
      testID="households-invitations-screen"
      onBack={() => router.back()}
    >
      {membershipsQuery.isPending ? (
        <ActivityIndicator
          testID="households-invitations-loading"
          color={colors.accent}
          size="large"
        />
      ) : membershipsQuery.isError ? (
        <>
          <HouseholdMessage testID="households-invitations-error-message">
            {text.householdsLoadFailed}
          </HouseholdMessage>
          <HouseholdButton
            label={text.retryHouseholds}
            testID="households-retry-button"
            onPress={() => void membershipsQuery.refetch()}
          />
        </>
      ) : (
        <>
          {atMembershipLimit ? (
            <HouseholdSetup
              userId={userId ?? ''}
              embedded
              hideEmbeddedHeading
              showCreate={false}
              joinDisabled
              joinDisabledMessage={text.joinLimitMessage}
            />
          ) : userId ? (
            <HouseholdSetup
              userId={userId}
              embedded
              hideEmbeddedHeading
              showCreate={false}
              onCompleted={completeJoin}
            />
          ) : null}

          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
            {text.inviteTitle}
          </Text>
          {ownedHouseholds.length === 0 ? (
            <HouseholdMessage testID="households-no-owned-state">
              {text.noOwnedHouseholds}
            </HouseholdMessage>
          ) : (
            <>
              <Text style={[styles.description, { color: colors.secondaryText }]}>
                {text.chooseInvitationHousehold}
              </Text>
              <View style={styles.householdChoices}>
                {ownedHouseholds.map((household) => {
                  const selected = household.id === effectiveSelectedHouseholdId;
                  return (
                    <Pressable
                      key={household.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      testID={`household-invitation-select-${household.id}`}
                      onPress={() => setSelectedHouseholdId(household.id)}
                      style={({ pressed }) => [
                        styles.householdChoice,
                        {
                          backgroundColor: selected ? colors.accentSoft : colors.card,
                          borderColor: selected ? colors.accent : colors.border,
                          opacity: pressed ? 0.72 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.householdName, { color: colors.text }]}>
                        {household.name}
                        {household.id === activeHouseholdId ? ` · ${text.activeLabel}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedHousehold ? (
                <HouseholdInvitation key={selectedHousehold.id} household={selectedHousehold} />
              ) : null}
            </>
          )}
        </>
      )}
    </HouseholdFrame>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 20 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two },
  householdChoices: { gap: Spacing.one },
  householdChoice: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
  },
  householdName: { fontSize: 15, fontWeight: '600' },
});
