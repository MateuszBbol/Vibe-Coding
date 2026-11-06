import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  Vibration,
  View,
} from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { logFeatureError } from '@/features/errors';
import { formatTimer, readCookProgress, saveCookProgress } from '@/features/recipes/cookProgress';
import { fetchRecipe } from '@/features/recipes/data';
import type { RecipeStep } from '@/features/recipes/data';
import { useRecipeHousehold } from '@/features/recipes/household';
import { recipeQueryKeys, recipeRoutes } from '@/features/recipes/routes';
import { stepIngredients } from '@/features/recipes/stepIngredients';
import { RecipeCard, RecipeFrame, RecipeMessage } from '@/features/recipes/RecipeUI';
import { formatShoppingItemQuantity } from '@/features/shopping/format';
import { strings } from '@/localization';

const KEEP_AWAKE_TAG = 'recipe-cook';

type TimerState =
  | { status: 'idle' }
  | { status: 'running'; endsAt: number }
  | { status: 'paused'; remainingMs: number }
  | { status: 'done' };

// Countdown for a step with a duration. Runs only while the cooking screen is open.
function StepTimer({ minutes, testID }: { minutes: number; testID: string }) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.recipes;
  const totalMs = minutes * 60 * 1000;
  const [timer, setTimer] = useState<TimerState>({ status: 'idle' });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (timer.status !== 'running') {
      return;
    }
    const interval = setInterval(() => {
      const current = Date.now();
      if (current >= timer.endsAt) {
        setTimer({ status: 'done' });
        Vibration.vibrate(600);
      } else {
        setNow(current);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [timer]);

  const remainingMs =
    timer.status === 'running'
      ? timer.endsAt - now
      : timer.status === 'paused'
        ? timer.remainingMs
        : timer.status === 'done'
          ? 0
          : totalMs;

  const toggle = () => {
    const current = Date.now();
    setNow(current);
    if (timer.status === 'running') {
      setTimer({ status: 'paused', remainingMs: Math.max(0, timer.endsAt - current) });
    } else if (timer.status === 'paused') {
      setTimer({ status: 'running', endsAt: current + timer.remainingMs });
    } else {
      setTimer({ status: 'running', endsAt: current + totalMs });
    }
  };

  const running = timer.status === 'running';
  const label =
    timer.status === 'done'
      ? text.timerDone
      : `${running ? text.timerPause : timer.status === 'paused' ? text.timerResume : text.timerStart} ${formatTimer(remainingMs)}`;

  return (
    <View style={styles.timerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={`${testID}-toggle`}
        onPress={timer.status === 'done' ? () => setTimer({ status: 'idle' }) : toggle}
        style={({ pressed }) => [
          styles.timerButton,
          {
            backgroundColor:
              timer.status === 'done' ? '#B42318' : running ? colors.accent : colors.accentSoft,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <SymbolView
          name={
            timer.status === 'done'
              ? { ios: 'bell.fill', android: 'notifications', web: 'notifications' }
              : running
                ? { ios: 'pause.fill', android: 'pause', web: 'pause' }
                : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }
          }
          tintColor={timer.status === 'done' || running ? colors.background : colors.accent}
          size={16}
        />
        <Text
          testID={`${testID}-label`}
          style={[
            styles.timerText,
            { color: timer.status === 'done' || running ? colors.background : colors.accent },
          ]}
        >
          {label}
        </Text>
      </Pressable>
      {timer.status === 'paused' || timer.status === 'done' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.timerReset}
          testID={`${testID}-reset`}
          onPress={() => setTimer({ status: 'idle' })}
          hitSlop={6}
          style={styles.timerReset}
        >
          <SymbolView
            name={{ ios: 'arrow.counterclockwise', android: 'restart_alt', web: 'restart_alt' }}
            tintColor={colors.secondaryText}
            size={18}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export function RecipeCookScreen({ recipeId }: { recipeId: string }) {
  const { household, userId, query: householdQuery } = useRecipeHousehold();
  const householdId = household?.id;
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.recipes;
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const progressLoaded = useRef(false);
  const recipeQuery = useQuery({
    queryKey: recipeQueryKeys.detail(householdId ?? '', recipeId),
    queryFn: () => fetchRecipe(householdId ?? '', recipeId),
    enabled: Boolean(householdId),
  });
  const steps: RecipeStep[] = recipeQuery.data?.steps ?? [];
  const stepIdsKey = steps.map((step) => step.id).join(',');

  // Keep the screen on while cooking (web support depends on the browser).
  useEffect(() => {
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, []);

  // Restore the ticks saved on this device once the steps are known.
  useEffect(() => {
    if (!userId || !recipeQuery.data) {
      return;
    }
    let active = true;
    readCookProgress(userId, recipeId, stepIdsKey ? stepIdsKey.split(',') : [])
      .then((saved) => {
        if (active) {
          setCheckedIds(saved);
          progressLoaded.current = true;
        }
      })
      .catch((error: unknown) => {
        progressLoaded.current = true;
        logFeatureError('[recipes] restore cooking progress failed', error, { recipeId });
      });
    return () => {
      active = false;
    };
  }, [recipeId, recipeQuery.data, stepIdsKey, userId]);

  const updateChecked = (next: string[]) => {
    setCheckedIds(next);
    if (userId && progressLoaded.current) {
      saveCookProgress(userId, recipeId, next).catch((error: unknown) => {
        logFeatureError('[recipes] save cooking progress failed', error, { recipeId });
      });
    }
  };

  const backToRecipe = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (householdId) {
      router.replace(recipeRoutes.details(householdId, recipeId));
    } else {
      router.replace('/recipes');
    }
  };

  const doneCount = steps.filter((step) => checkedIds.includes(step.id)).length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  const recipe = recipeQuery.data;

  return (
    <RecipeFrame
      title={recipe?.name ?? text.cook}
      testID={`recipe-cook-screen-${recipeId}`}
      onBack={backToRecipe}
      section="recipes"
      nestedNav
    >
      {householdQuery.isPending || (household && recipeQuery.isPending) ? (
        <ActivityIndicator testID="recipe-cook-loading" color={colors.accent} size="large" />
      ) : householdQuery.isError || recipeQuery.isError ? (
        <RecipeMessage testID="recipe-cook-error-message">{text.loadFailed}</RecipeMessage>
      ) : !recipe ? (
        <RecipeMessage testID="recipe-cook-error-message">{text.notFound}</RecipeMessage>
      ) : (
        <>
          <RecipeCard testID="recipe-cook-ingredients">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: ingredientsOpen }}
              testID="recipe-cook-ingredients-toggle"
              onPress={() => setIngredientsOpen((open) => !open)}
              style={styles.ingredientsToggle}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {text.cookIngredients(recipe.items.length)}
              </Text>
              <Text style={[styles.arrow, { color: colors.secondaryText }]}>
                {ingredientsOpen ? '⌃' : '⌄'}
              </Text>
            </Pressable>
            {ingredientsOpen
              ? recipe.items.map((item) => (
                  <View
                    key={item.id}
                    testID={`recipe-cook-ingredient-${item.id}`}
                    style={[styles.ingredient, { borderTopColor: colors.border }]}
                  >
                    <Text style={[styles.ingredientName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={{ color: colors.secondaryText }}>
                      {formatShoppingItemQuantity(item.quantity, item.unit)}
                    </Text>
                  </View>
                ))
              : null}
          </RecipeCard>

          {steps.length === 0 ? (
            <RecipeMessage testID="recipe-cook-no-steps">{text.cookNoSteps}</RecipeMessage>
          ) : (
            <>
              <View style={styles.progressRow}>
                <Text
                  testID="recipe-cook-progress"
                  style={[styles.progressText, { color: colors.text }]}
                >
                  {text.cookProgress(doneCount, steps.length)}
                </Text>
                {doneCount > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    testID="recipe-cook-reset"
                    onPress={() => updateChecked([])}
                    hitSlop={6}
                  >
                    <Text style={[styles.reset, { color: colors.accent }]}>{text.cookReset}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.accent,
                      width: `${(doneCount / steps.length) * 100}%`,
                    },
                  ]}
                />
              </View>

              {steps.map((step, index) => {
                const checked = checkedIds.includes(step.id);
                return (
                  <RecipeCard key={step.id} testID={`recipe-cook-step-${index}`}>
                    <View style={styles.stepRow}>
                      <View style={styles.stepBody}>
                        <Text style={[styles.stepNumber, { color: colors.accent }]}>
                          {text.cookStep(index + 1)}
                        </Text>
                        <Text
                          testID={`recipe-cook-step-${index}-text`}
                          style={[
                            styles.stepText,
                            {
                              color: checked ? colors.secondaryText : colors.text,
                              textDecorationLine: checked ? 'line-through' : 'none',
                            },
                          ]}
                        >
                          {step.text}
                        </Text>
                        {stepIngredients(step, recipe.items).length ? (
                          <View
                            testID={`recipe-cook-step-${index}-ingredients`}
                            style={styles.stepIngredients}
                          >
                            {stepIngredients(step, recipe.items).map((item) => (
                              <View key={item.id} style={styles.stepIngredient}>
                                <Text
                                  style={[
                                    styles.stepIngredientName,
                                    { color: checked ? colors.secondaryText : colors.text },
                                  ]}
                                >
                                  • {item.name}
                                </Text>
                                <Text
                                  style={[
                                    styles.stepIngredientQuantity,
                                    { color: colors.secondaryText },
                                  ]}
                                >
                                  {formatShoppingItemQuantity(item.quantity, item.unit)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        {step.duration_minutes !== null ? (
                          <>
                            <Text style={[styles.duration, { color: colors.secondaryText }]}>
                              {step.duration_minutes} {text.minutes}
                            </Text>
                            {checked ? null : (
                              <StepTimer
                                minutes={step.duration_minutes}
                                testID={`recipe-cook-step-${index}-timer`}
                              />
                            )}
                          </>
                        ) : null}
                      </View>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={text.cookStepDone(index + 1)}
                        accessibilityState={{ checked }}
                        aria-checked={checked}
                        testID={`recipe-cook-step-${index}-checkbox`}
                        onPress={() =>
                          updateChecked(
                            checked
                              ? checkedIds.filter((id) => id !== step.id)
                              : [...checkedIds, step.id],
                          )
                        }
                        hitSlop={8}
                        style={styles.checkboxHit}
                      >
                        <View
                          style={[
                            styles.checkCircle,
                            checked
                              ? { backgroundColor: colors.accent, borderColor: colors.accent }
                              : { borderColor: colors.secondaryText },
                          ]}
                        >
                          {checked ? (
                            <SymbolView
                              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                              tintColor={colors.background}
                              size={18}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    </View>
                  </RecipeCard>
                );
              })}

              {allDone ? (
                <View
                  testID="recipe-cook-done"
                  accessibilityLiveRegion="polite"
                  style={[styles.doneCard, { backgroundColor: colors.accentSoft }]}
                >
                  <Text style={[styles.doneTitle, { color: colors.text }]}>
                    {text.cookDoneTitle}
                  </Text>
                  <Text style={{ color: colors.secondaryText }}>{text.cookDoneDescription}</Text>
                  <Pressable
                    accessibilityRole="button"
                    testID="recipe-cook-back-to-recipe"
                    onPress={() => {
                      // Finished: start the next cooking from scratch.
                      updateChecked([]);
                      backToRecipe();
                    }}
                    style={({ pressed }) => [
                      styles.doneButton,
                      { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={[styles.doneButtonText, { color: colors.background }]}>
                      {text.cookBackToRecipe}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </>
      )}
    </RecipeFrame>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  ingredientsToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: { fontSize: 18 },
  ingredient: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ingredientName: { flex: 1, fontSize: 15 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressText: { fontSize: 15, fontWeight: '600' },
  reset: { fontSize: 14, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  stepBody: { flex: 1, minWidth: 0, gap: Spacing.one },
  stepNumber: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  stepText: { fontSize: 17, lineHeight: 25 },
  duration: { fontSize: 13 },
  stepIngredients: { gap: 2, marginTop: Spacing.one },
  stepIngredient: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  stepIngredientName: { flex: 1, fontSize: 15 },
  stepIngredientQuantity: { fontSize: 14 },
  checkboxHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  timerButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
  },
  timerText: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timerReset: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  doneCard: {
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  doneTitle: { fontSize: 24, fontWeight: '700' },
  doneButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.one,
  },
  doneButtonText: { fontSize: 15, fontWeight: '700' },
});
