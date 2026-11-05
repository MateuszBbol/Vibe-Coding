import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Colors, Spacing } from '@/constants/theme';
import { confirmRecipeAction } from '@/features/recipes/confirmRecipeAction';
import { getFeatureErrorMessage, logFeatureError } from '@/features/errors';
import { removeHouseholdCache } from '@/features/households/cache';
import { deleteHousehold, leaveHousehold } from '@/features/households/data';
import type { Household } from '@/features/households/data';
import { getHouseholdAction, isHouseholdNameConfirmationValid } from '@/features/households/delete';
import { resolveHouseholdAfterDeletion } from '@/features/households/selection';
import {
  householdQueryKeys,
  householdRoutes,
  isValidHouseholdId,
} from '@/features/households/routes';
import {
  HouseholdButton,
  HouseholdFrame,
  HouseholdMessage,
} from '@/features/households/HouseholdUI';
import {
  createShoppingList,
  deleteShoppingList,
  fetchActiveShoppingList,
} from '@/features/shopping/data';
import type { ShoppingList } from '@/features/shopping/data';
import { useHouseholds } from '@/features/households/useHouseholds';
import { strings } from '@/localization';

export default function HouseholdDetailsRoute() {
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const householdId = Array.isArray(params.householdId)
    ? params.householdId[0]
    : params.householdId;

  if (!isValidHouseholdId(householdId)) {
    return (
      <HouseholdFrame
        title={strings.pl.household.managementTitle}
        testID={`household-details-screen-${householdId ?? 'invalid'}`}
        onBack={() => router.back()}
      >
        <HouseholdMessage testID="household-details-error-message">
          {strings.pl.household.householdNotFound}
        </HouseholdMessage>
      </HouseholdFrame>
    );
  }

  return <ValidHouseholdDetails householdId={householdId} />;
}

function ValidHouseholdDetails({ householdId }: { householdId: string }) {
  const { userId, households, membershipsQuery, activeHouseholdId, selectActiveHousehold } =
    useHouseholds();
  const queryClient = useQueryClient();
  const [confirmationStep, setConfirmationStep] = useState(false);
  const [confirmationName, setConfirmationName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.household;
  const household = households.find((entry) => entry.id === householdId);
  const action = household && userId ? getHouseholdAction(household, userId) : null;
  const activeListQueryKey = ['active-shopping-list', userId, householdId] as const;
  const shoppingListQuery = useQuery({
    queryKey: activeListQueryKey,
    queryFn: () => fetchActiveShoppingList(householdId),
    enabled: Boolean(userId && household),
  });
  const createShoppingListMutation = useMutation({
    mutationFn: () => createShoppingList(householdId),
    onSuccess: async (createdList) => {
      queryClient.setQueryData(activeListQueryKey, createdList);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: activeListQueryKey });
    },
    onError: (error: unknown) => {
      logFeatureError('[shopping list] create from details failed', error, {
        userId,
        householdId,
      });
      setActionError(getFeatureErrorMessage(error));
    },
  });
  const deleteShoppingListMutation = useMutation({
    mutationFn: (shoppingListId: string) => deleteShoppingList(shoppingListId),
    onSuccess: async (_result, deletedListId) => {
      if (userId) {
        await queryClient.cancelQueries({
          queryKey: ['shopping-items', deletedListId],
          exact: true,
        });
        queryClient.removeQueries({
          queryKey: ['shopping-items', deletedListId],
          exact: true,
        });
      }
      queryClient.setQueryData<ShoppingList | null>(activeListQueryKey, null);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: activeListQueryKey });
      router.replace(householdRoutes.list());
    },
    onError: (error: unknown, deletedListId) => {
      logFeatureError('[shopping list] delete from details failed', error, {
        userId,
        householdId,
        listId: deletedListId,
      });
      setActionError(getFeatureErrorMessage(error));
    },
  });
  useEffect(() => {
    if (shoppingListQuery.isError) {
      logFeatureError('[shopping list] load from details failed', shoppingListQuery.error, {
        userId,
        householdId,
      });
    }
  }, [householdId, shoppingListQuery.error, shoppingListQuery.isError, userId]);

  const finishRemoval = async () => {
    if (!userId || !household) {
      return;
    }
    await removeHouseholdCache(queryClient, userId, household.id);
    await queryClient.cancelQueries({ queryKey: householdQueryKeys.memberships(userId) });
    const remaining = (
      queryClient.getQueryData<Household[]>(householdQueryKeys.memberships(userId)) ?? []
    ).filter((entry) => entry.id !== household.id);
    queryClient.setQueryData(householdQueryKeys.memberships(userId), remaining);
    const activeId = queryClient.getQueryData<string | null>(
      householdQueryKeys.activeSelection(userId),
    );
    const nextHouseholdId = resolveHouseholdAfterDeletion(
      activeId ?? household.id,
      household.id,
      remaining,
    );
    await selectActiveHousehold(nextHouseholdId);
    setConfirmationStep(false);
    setConfirmationName('');
    void queryClient
      .invalidateQueries({ queryKey: householdQueryKeys.memberships(userId) })
      .catch((error: unknown) => {
        logFeatureError('[household] refresh after membership removal failed', error, {
          userId,
          householdId,
        });
      });
    router.back();
  };

  const leave = async () => {
    if (!household || isWorking) {
      return;
    }
    setIsWorking(true);
    try {
      await leaveHousehold(household.id);
      await finishRemoval();
    } catch (error) {
      logFeatureError('[household] leave failed', error, { userId, householdId });
      setActionError(getFeatureErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const remove = async () => {
    if (
      !household ||
      action !== 'delete' ||
      isWorking ||
      !isHouseholdNameConfirmationValid(confirmationName, household.name)
    ) {
      return;
    }
    setIsWorking(true);
    try {
      await deleteHousehold(household.id, confirmationName.trim());
      await finishRemoval();
    } catch (error) {
      logFeatureError('[household] delete failed', error, { userId, householdId });
      setActionError(getFeatureErrorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const confirmLeave = () => {
    Alert.alert(text.leaveConfirmTitle, text.leaveConfirmDescription, [
      { text: strings.pl.auth.cancel, style: 'cancel' },
      { text: text.leaveButton, style: 'destructive', onPress: () => void leave() },
    ]);
  };
  const confirmDelete = () => {
    if (!household) {
      return;
    }
    Alert.alert(text.deleteConfirmTitle(household.name), text.deleteConfirmDescription, [
      { text: strings.pl.auth.cancel, style: 'cancel' },
      {
        text: text.continueDelete,
        style: 'destructive',
        onPress: () => {
          setActionError(null);
          setConfirmationName('');
          setConfirmationStep(true);
        },
      },
    ]);
  };
  const confirmDeleteShoppingList = () => {
    const shoppingList = shoppingListQuery.data;
    if (!shoppingList) {
      return;
    }
    setActionError(null);
    confirmRecipeAction({
      title: text.deleteShoppingListConfirmTitle,
      message: text.deleteShoppingListConfirmMessage(shoppingList.name),
      cancelLabel: strings.pl.auth.cancel,
      confirmLabel: text.deleteShoppingListButton,
      onConfirm: () => deleteShoppingListMutation.mutate(shoppingList.id),
    });
  };

  return (
    <HouseholdFrame
      title={household?.name ?? text.managementTitle}
      testID={`household-details-screen-${householdId}`}
      onBack={() => router.back()}
    >
      {membershipsQuery.isPending ? (
        <ActivityIndicator testID="household-details-loading" color={colors.accent} size="large" />
      ) : membershipsQuery.isError ? (
        <>
          <HouseholdMessage testID="household-details-error-message">
            {text.householdsLoadFailed}
          </HouseholdMessage>
          <HouseholdButton
            label={text.retryHouseholds}
            testID="households-retry-button"
            onPress={() => void membershipsQuery.refetch()}
          />
        </>
      ) : !household || !action ? (
        <HouseholdMessage testID="household-details-error-message">
          {text.householdNotFound}
        </HouseholdMessage>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.meta, { color: colors.secondaryText }]}>
              {household.id === activeHouseholdId ? text.activeLabel : text.inactiveLabel}
            </Text>
            <Text style={[styles.meta, { color: colors.secondaryText }]}>
              {action === 'delete' ? text.ownerRole : text.memberRole}
            </Text>
          </View>
          {household.id !== activeHouseholdId ? (
            <HouseholdButton
              label={text.setActiveHousehold}
              testID="household-set-active-button"
              onPress={() => void selectActiveHousehold(household.id)}
            />
          ) : null}
          {action === 'delete' ? (
            <HouseholdButton
              label={text.openInvitations}
              testID="household-open-invitations-button"
              onPress={() => router.push(householdRoutes.invitations(household.id))}
            />
          ) : null}
          {shoppingListQuery.isPending ? (
            <ActivityIndicator
              testID="shopping-list-details-loading"
              color={colors.accent}
              size="small"
            />
          ) : shoppingListQuery.isError ? (
            <HouseholdMessage testID="shopping-list-details-error-message">
              {text.shoppingListLoadFailed}
            </HouseholdMessage>
          ) : shoppingListQuery.data ? (
            <HouseholdButton
              label={
                deleteShoppingListMutation.isPending
                  ? text.deletingShoppingList
                  : text.deleteShoppingListButton
              }
              testID="shopping-delete-list-button"
              destructive
              disabled={deleteShoppingListMutation.isPending}
              onPress={confirmDeleteShoppingList}
            />
          ) : (
            <>
              <HouseholdMessage testID="shopping-list-empty-state">
                {text.noShoppingList}
              </HouseholdMessage>
              <HouseholdButton
                label={
                  createShoppingListMutation.isPending
                    ? text.creatingShoppingList
                    : text.createShoppingList
                }
                testID="shopping-list-create-button"
                disabled={createShoppingListMutation.isPending}
                onPress={() => createShoppingListMutation.mutate()}
              />
            </>
          )}
          {actionError ? (
            <Text
              accessibilityRole="alert"
              testID="household-action-error-message"
              style={styles.error}
            >
              {actionError}
            </Text>
          ) : null}
          {action === 'leave' ? (
            <HouseholdButton
              label={text.leaveButton}
              testID="household-leave-button"
              destructive
              disabled={isWorking}
              onPress={confirmLeave}
            />
          ) : confirmationStep ? (
            <View style={[styles.deleteCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {text.deleteSectionTitle}
              </Text>
              <Text style={[styles.description, { color: colors.secondaryText }]}>
                {text.deleteWarning}
              </Text>
              <Text style={[styles.description, { color: colors.text }]}>
                {text.confirmHouseholdName(household.name)}
              </Text>
              <TextInput
                accessibilityLabel={text.confirmationInputLabel}
                testID="household-delete-confirmation-input"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isWorking}
                onChangeText={(value) => {
                  setActionError(null);
                  setConfirmationName(value);
                }}
                placeholder={household.name}
                placeholderTextColor={colors.secondaryText}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={confirmationName}
              />
              <HouseholdButton
                label={isWorking ? text.deletingHousehold : text.deletePermanently}
                testID="household-delete-confirm-button"
                destructive
                disabled={
                  isWorking || !isHouseholdNameConfirmationValid(confirmationName, household.name)
                }
                onPress={() => void remove()}
              />
              <HouseholdButton
                label={strings.pl.auth.cancel}
                testID="household-delete-cancel-button"
                disabled={isWorking}
                onPress={() => {
                  setConfirmationStep(false);
                  setConfirmationName('');
                }}
              />
            </View>
          ) : (
            <HouseholdButton
              label={text.deleteHouseholdButton}
              testID="household-delete-button"
              destructive
              disabled={isWorking}
              onPress={confirmDelete}
            />
          )}
        </>
      )}
    </HouseholdFrame>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  meta: { fontSize: 15, lineHeight: 21 },
  deleteCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 21 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  error: { color: '#B42318', fontSize: 14, lineHeight: 20 },
});
