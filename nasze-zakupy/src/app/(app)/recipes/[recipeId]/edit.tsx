import { router, useLocalSearchParams } from 'expo-router';

import { RecipeFormScreen } from '@/features/recipes/RecipeFormScreen';
import { isValidRecipeId } from '@/features/recipes/routes';
import { RecipeFrame, RecipeMessage } from '@/features/recipes/RecipeUI';
import { strings } from '@/localization';

export default function EditRecipeRoute() {
  const params = useLocalSearchParams<{ recipeId?: string | string[] }>();
  const recipeId = Array.isArray(params.recipeId) ? params.recipeId[0] : params.recipeId;

  if (!isValidRecipeId(recipeId)) {
    return (
      <RecipeFrame title={strings.pl.recipes.editTitle} onBack={() => router.back()}>
        <RecipeMessage testID="recipe-form-error-message">
          {strings.pl.recipes.notFound}
        </RecipeMessage>
      </RecipeFrame>
    );
  }

  return <RecipeFormScreen recipeId={recipeId} />;
}
