import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Colors } from '@/constants/theme';
import { logFeatureError } from '@/features/errors';
import { recipeQueryKeys, recipeRoutes } from '@/features/recipes/routes';
import { fetchRecipes } from '@/features/recipes/data';
import { useRecipeHousehold } from '@/features/recipes/household';
import { RecipeButton, RecipeCard, RecipeFrame, RecipeMessage } from '@/features/recipes/RecipeUI';
import { strings } from '@/localization';
import { supabase } from '@/lib/supabase/client';

export default function RecipesRoute() {
  const { household, query: householdQuery } = useRecipeHousehold();
  const queryClient = useQueryClient();
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.recipes;
  const householdId = household?.id;
  const recipesQuery = useQuery({
    queryKey: recipeQueryKeys.list(householdId ?? ''),
    queryFn: () => fetchRecipes(householdId ?? ''),
    enabled: Boolean(householdId),
  });

  useEffect(() => {
    if (householdQuery.isError) {
      logFeatureError('[recipes] load accessible household failed', householdQuery.error);
    }
  }, [householdQuery.error, householdQuery.isError]);
  useEffect(() => {
    if (recipesQuery.isError) {
      logFeatureError('[recipes] load recipes failed', recipesQuery.error, { householdId });
    }
  }, [householdId, recipesQuery.error, recipesQuery.isError]);
  useEffect(() => {
    const client = supabase;
    if (!client || !householdId) {
      return;
    }
    const channel = client
      .channel(`recipes:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['recipes', householdId] });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logFeatureError('[realtime] recipes subscription failed', status, { householdId });
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [householdId, queryClient]);

  const openNewRecipe = () => {
    if (householdId) {
      router.push(recipeRoutes.create(householdId));
    }
  };

  return (
    <RecipeFrame title={text.title} testID="recipes-list-screen" section="recipes">
      {householdQuery.isPending || Boolean(household && recipesQuery.isPending) ? (
        <ActivityIndicator
          accessibilityLabel={text.loading}
          testID="recipes-list-loading"
          color={colors.accent}
          size="large"
        />
      ) : householdQuery.isError || !household ? (
        <RecipeMessage testID="recipes-error-message">{text.householdUnavailable}</RecipeMessage>
      ) : recipesQuery.isError ? (
        <>
          <RecipeMessage testID="recipes-error-message">{text.loadFailed}</RecipeMessage>
          <RecipeButton
            label={text.retry}
            testID="recipes-retry-button"
            onPress={() => void recipesQuery.refetch()}
          />
        </>
      ) : (
        <>
          <RecipeButton label={text.create} testID="recipes-add-button" onPress={openNewRecipe} />
          {recipesQuery.data?.length ? (
            recipesQuery.data.map((recipe) => (
              <Pressable
                key={recipe.id}
                accessibilityRole="button"
                testID={`recipe-open-${recipe.id}`}
                onPress={() => router.push(recipeRoutes.details(household.id, recipe.id))}
              >
                <RecipeCard testID={`recipe-item-${recipe.id}`}>
                  <Text
                    testID={`recipe-name-${recipe.id}`}
                    style={[styles.recipeName, { color: colors.text }]}
                  >
                    {recipe.name}
                  </Text>
                  <Text style={[styles.count, { color: colors.secondaryText }]}>
                    {text.ingredientCount(recipe.items_count)}
                  </Text>
                </RecipeCard>
              </Pressable>
            ))
          ) : (
            <RecipeMessage testID="recipes-empty-state">{text.empty}</RecipeMessage>
          )}
        </>
      )}
    </RecipeFrame>
  );
}

const styles = StyleSheet.create({
  recipeName: { fontSize: 17, fontWeight: '700' },
  count: { fontSize: 14 },
});
