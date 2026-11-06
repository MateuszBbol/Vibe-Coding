import { router, useLocalSearchParams } from 'expo-router';

import { RecipeCookScreen } from '@/features/recipes/RecipeCookScreen';
import { isValidRecipeId } from '@/features/recipes/routes';
import { RecipeFrame, RecipeMessage } from '@/features/recipes/RecipeUI';
import { strings } from '@/localization';

// "Przyrządź": cooking mode for one recipe.
export default function CookRecipeRoute() {
  const params = useLocalSearchParams<{ recipeId?: string | string[] }>();
  const recipeId = Array.isArray(params.recipeId) ? params.recipeId[0] : params.recipeId;

  if (!isValidRecipeId(recipeId)) {
    return (
      <RecipeFrame title={strings.pl.recipes.cook} onBack={() => router.back()}>
        <RecipeMessage testID="recipe-cook-error-message">
          {strings.pl.recipes.notFound}
        </RecipeMessage>
      </RecipeFrame>
    );
  }

  return <RecipeCookScreen recipeId={recipeId} />;
}
