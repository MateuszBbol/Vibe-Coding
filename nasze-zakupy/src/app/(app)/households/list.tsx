import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { hasHouseholdCapacity, householdRoutes } from '@/features/households/routes';
import { useHouseholds } from '@/features/households/useHouseholds';
import {
  HouseholdButton,
  HouseholdFrame,
  HouseholdMessage,
} from '@/features/households/HouseholdUI';
import { strings } from '@/localization';

export default function HouseholdListRoute() {
  const { households, membershipsQuery, activeHouseholdId } = useHouseholds();
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.household;

  return (
    <HouseholdFrame
      title={text.listTitle}
      testID="households-list-screen"
      onBack={() => router.back()}
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
          {households.map((household) => {
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
                <Text style={[styles.role, { color: colors.secondaryText }]}>
                  {household.role === 'owner' ? text.ownerRole : text.memberRole}
                </Text>
              </Pressable>
            );
          })}
          <Text style={[styles.count, { color: colors.secondaryText }]}>
            {text.householdCount(households.length)}
          </Text>
          {hasHouseholdCapacity(households.length) ? (
            <HouseholdButton
              label={`+ ${text.newHousehold}`}
              testID="household-create-button"
              onPress={() => router.push(householdRoutes.create())}
            />
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
  role: { fontSize: 13 },
  count: { textAlign: 'center', marginVertical: Spacing.one },
});
