import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useQueries } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { hasHouseholdCapacity, householdRoutes } from '@/features/households/routes';
import { useHouseholds } from '@/features/households/useHouseholds';
import {
  HouseholdButton,
  HouseholdFrame,
  HouseholdMessage,
  HouseholdNavigationRow,
} from '@/features/households/HouseholdUI';
import { fetchTodoMembers } from '@/features/todo/data';
import { strings } from '@/localization';

// "Listy" section: choose a list to manage (activate, share, leave/delete), create or join one.
export default function HouseholdsRoute() {
  const { households, membershipsQuery, activeHouseholdId } = useHouseholds();
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.household;
  // Member names come from the same RPC (and cache key) the task section uses; profiles
  // of other users are not readable directly.
  const memberQueries = useQueries({
    queries: households.map((household) => ({
      queryKey: ['todo-household-members', household.id] as const,
      queryFn: () => fetchTodoMembers(household.id),
    })),
  });
  const creatorName = (index: number, ownerId: string): string | null =>
    memberQueries[index]?.data
      ?.find((member) => member.user_id === ownerId)
      ?.display_name?.trim() || null;

  return (
    <HouseholdFrame
      title={text.managementTitle}
      testID="households-management-screen"
      section="lists"
    >
      {membershipsQuery.isPending ? (
        <ActivityIndicator testID="households-list-loading" color={colors.accent} size="large" />
      ) : membershipsQuery.isError ? (
        <>
          <HouseholdMessage testID="households-list-error-message">
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
          {households.map((household, index) => {
            const isActive = household.id === activeHouseholdId;
            return (
              <Pressable
                key={household.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                testID={`household-item-${household.id}`}
                onPress={() => router.push(householdRoutes.details(household.id))}
                style={({ pressed }) => [
                  styles.householdRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: isActive ? colors.accent : colors.border,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <View style={styles.householdText}>
                  <Text style={[styles.name, { color: colors.text }]}>
                    {isActive ? '✓ ' : ''}
                    {household.name}
                  </Text>
                  {isActive ? (
                    <Text style={[styles.active, { color: colors.accent }]}>
                      {text.activeLabel}
                    </Text>
                  ) : null}
                </View>
                {/* Who created the list (falls back to the role while names load). */}
                <View
                  accessible
                  accessibilityLabel={`${text.createdBy}: ${
                    creatorName(index, household.owner_id) ??
                    (household.role === 'owner' ? text.ownerRole : text.memberRole)
                  }`}
                  testID={`household-creator-${household.id}`}
                  style={styles.creator}
                >
                  <SymbolView
                    name={{
                      ios: 'person.crop.circle',
                      android: 'account_circle',
                      web: 'account_circle',
                    }}
                    tintColor={colors.secondaryText}
                    size={16}
                  />
                  <Text numberOfLines={1} style={[styles.role, { color: colors.secondaryText }]}>
                    {creatorName(index, household.owner_id) ??
                      (household.role === 'owner' ? text.ownerRole : text.memberRole)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Text style={[styles.count, { color: colors.secondaryText }]}>
            {text.householdCount(households.length)}
          </Text>
          {/* At the list limit neither creating nor joining is possible, so both are hidden. */}
          {hasHouseholdCapacity(households.length) ? (
            <>
              <HouseholdButton
                label={text.newHousehold}
                testID="household-create-button"
                onPress={() => router.push(householdRoutes.create())}
              />
              <HouseholdNavigationRow
                title={text.joinWithCode}
                testID="navigation-household-invitations"
                showChevron={false}
                onPress={() => router.push(householdRoutes.invitations())}
              />
            </>
          ) : (
            <HouseholdMessage testID="households-limit-message">
              {text.householdLimit}
            </HouseholdMessage>
          )}
        </>
      )}
    </HouseholdFrame>
  );
}

const styles = StyleSheet.create({
  householdRow: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  householdText: { gap: Spacing.half },
  name: { fontSize: 17, fontWeight: '600' },
  active: { fontSize: 13, fontWeight: '600' },
  creator: { flexShrink: 1, maxWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  role: { flexShrink: 1, fontSize: 13 },
  count: { textAlign: 'center', marginVertical: Spacing.one },
});
