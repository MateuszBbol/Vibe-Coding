import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Colors, Spacing } from '@/constants/theme';
import { getFeatureErrorMessage, logFeatureError } from '@/features/errors';
import { confirmRecipeAction } from '@/features/recipes/confirmRecipeAction';
import { fetchActiveShoppingList } from '@/features/shopping/data';
import { deleteRecipe, fetchRecipe, addRecipeToActiveList } from '@/features/recipes/data';
import { isValidRecipeId, recipeQueryKeys, recipeRoutes } from '@/features/recipes/routes';
import { useRecipeHousehold } from '@/features/recipes/household';
import { stepIngredients } from '@/features/recipes/stepIngredients';
import { RecipeCard, RecipeError, RecipeFrame, RecipeMessage } from '@/features/recipes/RecipeUI';
import { formatShoppingItemQuantity } from '@/features/shopping/format';
import { getShoppingCategory } from '@/features/shopping/categories';
import { strings } from '@/localization';
import { supabase } from '@/lib/supabase/client';

export default function RecipeDetailsRoute() {
  const params = useLocalSearchParams<{
    recipeId?: string | string[];
    householdId?: string | string[];
  }>();
  const recipeId = Array.isArray(params.recipeId) ? params.recipeId[0] : params.recipeId;
  const validRecipeId = isValidRecipeId(recipeId);
  const { household, userId, query: householdQuery } = useRecipeHousehold();
  const householdId = household?.id;
  const queryClient = useQueryClient();
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.recipes;
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const addRequestPending = useRef(false);
  const recipeQuery = useQuery({
    queryKey: recipeQueryKeys.detail(householdId ?? '', recipeId ?? ''),
    queryFn: () => fetchRecipe(householdId ?? '', recipeId ?? ''),
    enabled: Boolean(householdId && validRecipeId),
  });
  const listQuery = useQuery({
    queryKey: ['active-shopping-list', userId, householdId],
    queryFn: () => fetchActiveShoppingList(householdId ?? ''),
    enabled: Boolean(userId && householdId && validRecipeId),
  });
  const returnToRecipes = () => {
    const requestedHouseholdId = Array.isArray(params.householdId)
      ? params.householdId[0]
      : params.householdId;
    const targetHouseholdId = householdId ?? requestedHouseholdId;
    router.dismissTo(targetHouseholdId ? recipeRoutes.list(targetHouseholdId) : '/recipes');
  };

  useEffect(() => {
    if (recipeQuery.isError) {
      logFeatureError('[recipes] load recipe details failed', recipeQuery.error, {
        householdId,
        recipeId,
      });
    }
  }, [householdId, recipeId, recipeQuery.error, recipeQuery.isError]);
  useEffect(() => {
    if (listQuery.isError) {
      logFeatureError('[recipes] load active shopping list failed', listQuery.error, {
        householdId,
        userId,
      });
    }
  }, [householdId, listQuery.error, listQuery.isError, userId]);
  useEffect(() => {
    if (!supabase || !householdId || !validRecipeId) {
      return;
    }
    const client = supabase;
    const channel = client
      .channel(`recipe-detail:${householdId}:${recipeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => {
        void queryClient.invalidateQueries({
          queryKey: recipeQueryKeys.detail(householdId, recipeId),
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_items' }, () => {
        void queryClient.invalidateQueries({
          queryKey: recipeQueryKeys.detail(householdId, recipeId),
        });
        void queryClient.invalidateQueries({ queryKey: recipeQueryKeys.list(householdId) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_steps' }, () => {
        void queryClient.invalidateQueries({
          queryKey: recipeQueryKeys.detail(householdId, recipeId),
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists' }, () => {
        void queryClient.invalidateQueries({
          queryKey: ['active-shopping-list', userId, householdId],
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logFeatureError('[realtime] recipe detail subscription failed', status, {
            householdId,
            recipeId,
          });
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [householdId, recipeId, queryClient, userId, validRecipeId]);

  const isLoading =
    householdQuery.isPending ||
    Boolean(household && validRecipeId && (recipeQuery.isPending || listQuery.isPending));

  const addMutation = useMutation({
    mutationFn: () => addRecipeToActiveList(recipeId ?? ''),
    onSuccess: async (result) => {
      setActionError(null);
      setSuccessMessage(text.addAllSuccess);
      await queryClient.invalidateQueries({ queryKey: ['shopping-items', result.listId] });
    },
    onSettled: () => {
      addRequestPending.current = false;
    },
    onError: (error: unknown) => {
      logFeatureError('[recipes] add ingredients to shopping list failed', error, {
        householdId,
        recipeId,
      });
      setActionError(getFeatureErrorMessage(error));
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteRecipe(householdId ?? '', recipeId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: recipeQueryKeys.list(householdId ?? '') });
      returnToRecipes();
    },
    onError: (error: unknown) => {
      logFeatureError('[recipes] delete recipe failed', error, { householdId, recipeId });
      setActionError(getFeatureErrorMessage(error));
    },
  });

  const confirmAddAll = () => {
    const recipe = recipeQuery.data;
    const list = listQuery.data;
    if (!recipe) {
      return;
    }
    if (!list) {
      setActionError(text.shoppingListRequired);
      setSuccessMessage(null);
      return;
    }
    confirmRecipeAction({
      title: text.addAllConfirmTitle,
      // Users know the list by its own name; the internal shopping list is always "Zakupy".
      message: text.addAllConfirmMessage(recipe.items.length, household?.name ?? list.name),
      cancelLabel: strings.pl.auth.cancel,
      confirmLabel: text.addAll,
      onConfirm: () => {
        if (addRequestPending.current || addMutation.isPending) {
          return;
        }
        addRequestPending.current = true;
        setActionError(null);
        setSuccessMessage(null);
        addMutation.mutate();
      },
    });
  };
  const confirmDelete = () =>
    confirmRecipeAction({
      title: text.deleteConfirmTitle,
      message: text.deleteConfirmMessage,
      cancelLabel: strings.pl.auth.cancel,
      confirmLabel: text.delete,
      onConfirm: () => deleteMutation.mutate(),
    });

  return (
    <RecipeFrame
      title={recipeQuery.data?.name ?? text.title}
      testID={`recipe-details-screen-${recipeId ?? 'unknown'}`}
      section="recipes"
      nestedNav
    >
      {isLoading ? (
        <ActivityIndicator testID="recipe-details-loading" color={colors.accent} size="large" />
      ) : !validRecipeId ? (
        <RecipeMessage testID="recipe-details-error-message">{text.notFound}</RecipeMessage>
      ) : householdQuery.isError || recipeQuery.isError || listQuery.isError ? (
        <RecipeMessage testID="recipe-details-error-message">{text.loadFailed}</RecipeMessage>
      ) : !household ? (
        <RecipeMessage testID="recipe-details-error-message">
          {text.householdUnavailable}
        </RecipeMessage>
      ) : !recipeQuery.data ? (
        <RecipeMessage testID="recipe-details-error-message">{text.notFound}</RecipeMessage>
      ) : (
        <>
          {recipeQuery.data.description ? (
            <Text
              testID="recipe-description"
              style={[styles.description, { color: colors.secondaryText }]}
            >
              {recipeQuery.data.description}
            </Text>
          ) : null}
          {recipeQuery.data.steps.length > 0 ? (
            <RecipeCard testID="recipe-preparation-steps">
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {text.preparationTitle}
              </Text>
              {recipeQuery.data.steps.map((step, index) => (
                <View
                  key={step.id}
                  testID={`recipe-preparation-step-${index}`}
                  style={styles.preparationStep}
                >
                  <Text style={{ color: colors.text }}>
                    {index + 1}. {step.text}
                  </Text>
                  {step.duration_minutes !== null ? (
                    <Text
                      testID={`recipe-preparation-step-${index}-duration`}
                      style={{ color: colors.secondaryText }}
                    >
                      {step.duration_minutes} {text.minutes}
                    </Text>
                  ) : null}
                  {stepIngredients(step, recipeQuery.data?.items ?? []).length ? (
                    <Text
                      testID={`recipe-preparation-step-${index}-ingredients`}
                      style={{ color: colors.secondaryText }}
                    >
                      {text.stepIngredientsShort}{' '}
                      {stepIngredients(step, recipeQuery.data?.items ?? [])
                        .map((item) => item.name)
                        .join(', ')}
                    </Text>
                  ) : null}
                </View>
              ))}
            </RecipeCard>
          ) : null}
          <RecipeCard testID={`recipe-ingredients-${recipeId}`}>
            {recipeQuery.data.items.map((item) => (
              <View
                key={item.id}
                testID={`recipe-ingredient-${item.id}`}
                style={[styles.ingredient, { borderBottomColor: colors.border }]}
              >
                <View style={styles.ingredientName}>
                  <Text
                    testID={`recipe-ingredient-name-${item.id}`}
                    style={[styles.name, { color: colors.text }]}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.category, { color: colors.secondaryText }]}>
                    {getShoppingCategory(item.category).emoji}{' '}
                    {getShoppingCategory(item.category).label}
                  </Text>
                </View>
                <Text
                  testID={`recipe-ingredient-quantity-${item.id}`}
                  style={[styles.quantity, { color: colors.secondaryText }]}
                >
                  {formatShoppingItemQuantity(item.quantity, item.unit)}
                </Text>
              </View>
            ))}
            {recipeQuery.data.items.length === 0 ? (
              <RecipeMessage testID="recipe-no-ingredients-state">
                {text.noIngredients}
              </RecipeMessage>
            ) : null}
          </RecipeCard>
          {actionError ? (
            <RecipeError testID="recipe-action-error-message">{actionError}</RecipeError>
          ) : null}
          {!listQuery.data ? (
            <RecipeMessage testID="recipe-no-active-list-message">
              {text.shoppingListRequired}
            </RecipeMessage>
          ) : null}
          {successMessage ? (
            <Text
              accessibilityRole="alert"
              testID="recipe-action-success-message"
              style={[styles.success, { color: colors.accent }]}
            >
              {successMessage}
            </Text>
          ) : null}
          <View style={styles.actionRow}>
            <RecipeIconAction
              label={text.cookShort}
              accessibilityLabel={text.cook}
              icon={{ ios: 'frying.pan', android: 'skillet', web: 'skillet' }}
              testID={`recipe-cook-button-${recipeId}`}
              color={colors.background}
              backgroundColor={colors.accent}
              captionColor={colors.text}
              disabled={recipeQuery.data.steps.length === 0}
              onPress={() => {
                const recipe = recipeQuery.data;
                if (recipe) {
                  router.push(recipeRoutes.cook(household.id, recipe.id));
                }
              }}
            />
            <RecipeIconAction
              label={text.addAllShort}
              accessibilityLabel={addMutation.isPending ? text.saving : text.addAll}
              icon={{
                ios: 'cart.badge.plus',
                android: 'add_shopping_cart',
                web: 'add_shopping_cart',
              }}
              testID="recipe-add-to-shopping-list-button"
              color={colors.background}
              backgroundColor={colors.accent}
              captionColor={colors.text}
              busy={addMutation.isPending}
              disabled={addMutation.isPending || recipeQuery.data.items.length === 0}
              onPress={confirmAddAll}
            />
            <RecipeIconAction
              label={text.editShort}
              accessibilityLabel={text.edit}
              icon={{ ios: 'pencil', android: 'edit', web: 'edit' }}
              testID={`recipe-edit-button-${recipeId}`}
              color={colors.text}
              backgroundColor={colors.card}
              borderColor={colors.border}
              captionColor={colors.text}
              onPress={() => {
                const recipe = recipeQuery.data;
                if (recipe) {
                  router.push(recipeRoutes.edit(household.id, recipe.id));
                }
              }}
            />
            <RecipeIconAction
              label={text.deleteShort}
              accessibilityLabel={deleteMutation.isPending ? text.saving : text.delete}
              icon={{ ios: 'trash', android: 'delete_outline', web: 'delete_outline' }}
              testID={`recipe-delete-button-${recipeId}`}
              color="#B42318"
              backgroundColor={colors.card}
              borderColor="#B42318"
              captionColor="#B42318"
              busy={deleteMutation.isPending}
              disabled={deleteMutation.isPending}
              onPress={confirmDelete}
            />
          </View>
        </>
      )}
    </RecipeFrame>
  );
}

// A large round icon with a short caption; used for the three recipe actions.
function RecipeIconAction({
  label,
  accessibilityLabel,
  icon,
  testID,
  color,
  backgroundColor,
  borderColor,
  captionColor,
  busy = false,
  disabled = false,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  icon: SymbolViewProps['name'];
  testID: string;
  color: string;
  backgroundColor: string;
  borderColor?: string;
  captionColor: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, busy }}
      aria-disabled={disabled}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}
    >
      <View
        style={[
          styles.actionCircle,
          { backgroundColor, borderColor: borderColor ?? backgroundColor },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={color} size="small" />
        ) : (
          <SymbolView name={icon} tintColor={color} size={28} />
        )}
      </View>
      <Text style={[styles.actionLabel, { color: captionColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: Spacing.two,
  },
  action: { alignItems: 'center', gap: Spacing.one, minWidth: 80 },
  actionCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  description: { fontSize: 15, lineHeight: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  preparationStep: { gap: Spacing.half },
  ingredient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
  },
  ingredientName: { flex: 1, gap: Spacing.half },
  name: { fontSize: 16, fontWeight: '600' },
  category: { fontSize: 12 },
  quantity: { fontSize: 15, marginLeft: Spacing.two },
  success: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
