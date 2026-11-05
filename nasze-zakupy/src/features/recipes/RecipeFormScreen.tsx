import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Colors, Spacing } from '@/constants/theme';
import { getFeatureErrorMessage, logFeatureError } from '@/features/errors';
import { getShoppingCategory, shoppingCategories } from '@/features/shopping/categories';
import { classifyShoppingProduct } from '@/features/shopping/productCategories';
import { shoppingUnits } from '@/features/shopping/schemas';
import type { ShoppingUnit } from '@/features/shopping/schemas';
import { fetchRecipe, saveRecipe } from '@/features/recipes/data';
import type { RecipeFormInput, RecipeFormValues } from '@/features/recipes/schemas';
import { recipeSchema } from '@/features/recipes/schemas';
import { isValidRecipeId, recipeQueryKeys, recipeRoutes } from '@/features/recipes/routes';
import { useRecipeHousehold } from '@/features/recipes/household';
import {
  RecipeButton,
  RecipeCard,
  RecipeError,
  RecipeFrame,
  RecipeMessage,
} from '@/features/recipes/RecipeUI';
import { strings } from '@/localization';

type RecipeFormScreenProps = {
  recipeId?: string;
};

const initialForm: RecipeFormInput = {
  name: '',
  description: '',
  steps: [],
  items: [{ name: '', quantity: '', unit: null, category: 'other' }],
};

export function RecipeFormScreen({ recipeId }: RecipeFormScreenProps) {
  const { household, query: householdQuery } = useRecipeHousehold();
  const householdId = household?.id;
  const activeRecipeId = recipeId;
  const validRecipeId = activeRecipeId === undefined || isValidRecipeId(activeRecipeId);
  const queryClient = useQueryClient();
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.recipes;
  const recipeQuery = useQuery({
    queryKey: recipeQueryKeys.detail(householdId ?? '', activeRecipeId ?? ''),
    queryFn: () => fetchRecipe(householdId ?? '', activeRecipeId ?? ''),
    enabled: Boolean(householdId && activeRecipeId && validRecipeId),
  });
  const form = useForm<RecipeFormInput, unknown, RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: initialForm,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  const {
    fields: stepFields,
    append: appendStep,
    move: moveStep,
    remove: removeStep,
  } = useFieldArray({ control: form.control, name: 'steps' });
  const mutation = useMutation({
    mutationFn: (values: RecipeFormValues) =>
      saveRecipe(householdId ?? '', activeRecipeId ?? null, {
        ...values,
        items: values.items.map((item, index) => ({ ...item, sort_order: index })),
      }),
    onSuccess: async (savedRecipeId) => {
      await queryClient.invalidateQueries({ queryKey: recipeQueryKeys.list(householdId ?? '') });
      await queryClient.invalidateQueries({
        queryKey: recipeQueryKeys.detail(householdId ?? '', savedRecipeId),
      });
      if (activeRecipeId) {
        router.back();
      } else {
        router.replace(recipeRoutes.details(householdId ?? '', savedRecipeId));
      }
    },
    onError: (error: unknown) => {
      logFeatureError('[recipes] save recipe failed', error, {
        householdId,
        recipeId: activeRecipeId,
      });
      form.setError('root', { message: getFeatureErrorMessage(error) });
    },
  });

  useEffect(() => {
    if (recipeQuery.isError) {
      logFeatureError('[recipes] load recipe for editing failed', recipeQuery.error, {
        householdId,
        recipeId: activeRecipeId,
      });
    }
  }, [activeRecipeId, householdId, recipeQuery.error, recipeQuery.isError]);
  useEffect(() => {
    const recipe = recipeQuery.data;
    if (!recipe || !activeRecipeId) {
      return;
    }
    form.reset({
      name: recipe.name,
      description: recipe.description ?? '',
      steps: recipe.steps.map(({ text, duration_minutes }) => ({
        text,
        duration_minutes: duration_minutes === null ? '' : String(duration_minutes),
      })),
      items: recipe.items.map((item) => ({
        name: item.name,
        quantity: item.quantity === null ? '' : String(item.quantity),
        unit: item.unit,
        category: item.category,
      })),
    });
  }, [activeRecipeId, form, recipeQuery.data]);

  const save = form.handleSubmit((values) => mutation.mutate(values));
  const title = activeRecipeId ? text.editTitle : text.newTitle;
  const isLoading =
    householdQuery.isPending || Boolean(activeRecipeId && validRecipeId && recipeQuery.isPending);

  return (
    <RecipeFrame
      title={title}
      testID={activeRecipeId ? `recipe-edit-screen-${activeRecipeId}` : 'recipe-create-screen'}
      onBack={() => router.back()}
    >
      {isLoading ? (
        <ActivityIndicator testID="recipe-form-loading" color={colors.accent} size="large" />
      ) : !validRecipeId ? (
        <RecipeMessage testID="recipe-form-error-message">{text.notFound}</RecipeMessage>
      ) : householdQuery.isError ? (
        <RecipeMessage testID="recipe-form-error-message">
          {text.householdUnavailable}
        </RecipeMessage>
      ) : activeRecipeId && (recipeQuery.isError || !recipeQuery.data) ? (
        <RecipeMessage testID="recipe-form-error-message">{text.notFound}</RecipeMessage>
      ) : !household ? (
        <RecipeMessage testID="recipe-form-error-message">
          {text.householdUnavailable}
        </RecipeMessage>
      ) : (
        <>
          <RecipeCard testID="recipe-fields-card">
            <Text style={[styles.label, { color: colors.text }]}>{text.name}</Text>
            <Controller
              control={form.control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  accessibilityLabel={text.name}
                  testID="recipe-name-input"
                  autoCapitalize="sentences"
                  editable={!mutation.isPending}
                  maxLength={120}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={text.namePlaceholder}
                  placeholderTextColor={colors.secondaryText}
                  value={value}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
              )}
            />
            {form.formState.errors.name?.message ? (
              <RecipeError testID="recipe-name-error-message">
                {form.formState.errors.name.message}
              </RecipeError>
            ) : null}
            <Text style={[styles.label, { color: colors.text }]}>{text.description}</Text>
            <Controller
              control={form.control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  accessibilityLabel={text.description}
                  testID="recipe-description-input"
                  editable={!mutation.isPending}
                  maxLength={2000}
                  multiline
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={text.descriptionPlaceholder}
                  placeholderTextColor={colors.secondaryText}
                  value={value}
                  style={[
                    styles.input,
                    styles.description,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
              )}
            />
            {form.formState.errors.description?.message ? (
              <RecipeError testID="recipe-description-error-message">
                {form.formState.errors.description.message}
              </RecipeError>
            ) : null}
          </RecipeCard>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{text.preparationTitle}</Text>
          {stepFields.map((field, index) => (
            <RecipeCard key={field.id} testID={`recipe-step-${index}`}>
              <View style={styles.stepHeader}>
                <Text style={[styles.label, { color: colors.text }]}>{index + 1}.</Text>
                <View style={styles.stepActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={text.moveStepUp}
                    testID={`recipe-step-${index}-move-up-button`}
                    disabled={mutation.isPending || index === 0}
                    onPress={() => moveStep(index, index - 1)}
                  >
                    <Text style={[styles.remove, { color: colors.text }]}>↑</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={text.moveStepDown}
                    testID={`recipe-step-${index}-move-down-button`}
                    disabled={mutation.isPending || index === stepFields.length - 1}
                    onPress={() => moveStep(index, index + 1)}
                  >
                    <Text style={[styles.remove, { color: colors.text }]}>↓</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    testID={`recipe-step-${index}-remove-button`}
                    disabled={mutation.isPending}
                    onPress={() => removeStep(index)}
                  >
                    <Text style={[styles.remove, { color: '#B42318' }]}>{text.removeStep}</Text>
                  </Pressable>
                </View>
              </View>
              <Controller
                control={form.control}
                name={`steps.${index}.text`}
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextInput
                    accessibilityLabel={`${text.preparationStep} ${index + 1}`}
                    testID={`recipe-step-${index}-input`}
                    editable={!mutation.isPending}
                    maxLength={500}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder={text.preparationStepPlaceholder}
                    placeholderTextColor={colors.secondaryText}
                    value={value}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                  />
                )}
              />
              <View style={styles.stepDurationRow}>
                <Controller
                  control={form.control}
                  name={`steps.${index}.duration_minutes`}
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextInput
                      accessibilityLabel={`${text.stepDuration} ${index + 1}`}
                      testID={`recipe-step-${index}-duration-input`}
                      editable={!mutation.isPending}
                      keyboardType="number-pad"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder="—"
                      placeholderTextColor={colors.secondaryText}
                      value={value}
                      style={[
                        styles.durationInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                    />
                  )}
                />
                <Text style={{ color: colors.secondaryText }}>{text.minutes}</Text>
              </View>
              {form.formState.errors.steps?.[index]?.duration_minutes?.message ? (
                <RecipeError testID={`recipe-step-${index}-duration-error-message`}>
                  {form.formState.errors.steps[index]?.duration_minutes?.message}
                </RecipeError>
              ) : null}
              {form.formState.errors.steps?.[index]?.text?.message ? (
                <RecipeError testID={`recipe-step-${index}-error-message`}>
                  {form.formState.errors.steps[index]?.text?.message}
                </RecipeError>
              ) : null}
            </RecipeCard>
          ))}
          {form.formState.errors.steps?.message ? (
            <RecipeError testID="recipe-steps-error-message">
              {form.formState.errors.steps.message}
            </RecipeError>
          ) : null}
          <RecipeButton
            secondary
            disabled={mutation.isPending || stepFields.length >= 50}
            label={text.addStep}
            testID="recipe-add-step-button"
            onPress={() => appendStep({ text: '', duration_minutes: '' })}
          />

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{text.ingredients}</Text>
          {fields.map((field, index) => (
            <RecipeIngredientForm
              key={field.id}
              testID={`recipe-ingredient-${field.id}`}
              indexTestID={`recipe-ingredient-category-select-${index}`}
              index={index}
              control={form.control}
              remove={() => remove(index)}
              canRemove={fields.length > 1}
              disabled={mutation.isPending}
              setValue={form.setValue}
              errors={form.formState.errors.items?.[index]}
            />
          ))}
          {form.formState.errors.items?.root?.message ? (
            <RecipeError testID="recipe-ingredients-error-message">
              {form.formState.errors.items.root.message}
            </RecipeError>
          ) : null}
          {form.formState.errors.root?.message ? (
            <RecipeError testID="recipe-save-error-message">
              {form.formState.errors.root.message}
            </RecipeError>
          ) : null}
          <RecipeButton
            secondary
            disabled={mutation.isPending || fields.length >= 100}
            label={text.addIngredient}
            testID="recipe-add-ingredient-button"
            onPress={() => append({ name: '', quantity: '', unit: null, category: 'other' })}
          />
          <RecipeButton
            disabled={mutation.isPending}
            label={mutation.isPending ? text.saving : text.save}
            testID="recipe-save-button"
            onPress={() => void save()}
          />
        </>
      )}
    </RecipeFrame>
  );
}

type IngredientFormProps = {
  testID: string;
  indexTestID: string;
  index: number;
  control: Control<RecipeFormInput, unknown, RecipeFormValues>;
  remove: () => void;
  canRemove: boolean;
  disabled: boolean;
  setValue: UseFormSetValue<RecipeFormInput>;
  errors: FieldErrors<RecipeFormInput['items'][number]> | undefined;
};

function RecipeIngredientForm({
  testID,
  indexTestID,
  index,
  control,
  remove,
  canRemove,
  disabled,
  setValue,
  errors,
}: IngredientFormProps) {
  const [categoryOptionsVisible, setCategoryOptionsVisible] = useState(false);
  const categoryManuallyOverridden = useRef(false);
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.recipes;
  const unitChoices: (ShoppingUnit | null)[] = [null, ...shoppingUnits];
  return (
    <RecipeCard testID={testID}>
      <View style={styles.ingredientHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{index + 1}.</Text>
        {canRemove ? (
          <Pressable
            accessibilityRole="button"
            testID={`${testID}-remove-button`}
            disabled={disabled}
            onPress={remove}
          >
            <Text style={[styles.remove, { color: '#B42318' }]}>{text.removeIngredient}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{text.product}</Text>
      <Controller
        control={control}
        name={`items.${index}.name`}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextInput
            accessibilityLabel={`${text.product} ${index + 1}`}
            testID={`${testID}-name-input`}
            autoCapitalize="sentences"
            editable={!disabled}
            maxLength={120}
            onBlur={onBlur}
            onChangeText={(name) => {
              onChange(name);
              if (!categoryManuallyOverridden.current) {
                setValue(`items.${index}.category`, classifyShoppingProduct(name), {
                  shouldValidate: true,
                });
              }
            }}
            placeholder={text.productPlaceholder}
            placeholderTextColor={colors.secondaryText}
            value={value}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
        )}
      />
      {errors?.name?.message ? (
        <RecipeError testID={`${testID}-name-error-message`}>{errors.name.message}</RecipeError>
      ) : null}
      <Text style={[styles.label, { color: colors.text }]}>{text.quantity}</Text>
      <Controller
        control={control}
        name={`items.${index}.quantity`}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextInput
            accessibilityLabel={`${text.quantity} ${index + 1}`}
            testID={`${testID}-quantity-input`}
            editable={!disabled}
            keyboardType="decimal-pad"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder={text.quantityPlaceholder}
            placeholderTextColor={colors.secondaryText}
            value={value}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
        )}
      />
      {errors?.quantity?.message ? (
        <RecipeError testID={`${testID}-quantity-error-message`}>
          {errors.quantity.message}
        </RecipeError>
      ) : null}
      <Text style={[styles.label, { color: colors.text }]}>{text.unit}</Text>
      <Controller
        control={control}
        name={`items.${index}.unit`}
        render={({ field: { onChange, value } }) => (
          <View style={styles.unitOptions}>
            {unitChoices.map((unit) => {
              const label = unit ?? text.unitNone;
              const selected = value === unit;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled }}
                  testID={`${testID}-unit-option-${unit ?? 'none'}`}
                  disabled={disabled}
                  onPress={() => onChange(unit)}
                  style={[
                    styles.unitOption,
                    {
                      backgroundColor: selected ? colors.accentSoft : colors.background,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      />
      <Text style={[styles.label, { color: colors.text }]}>{text.category}</Text>
      <Controller
        control={control}
        name={`items.${index}.category`}
        render={({ field: { onChange, value } }) => {
          const category = getShoppingCategory(value);
          return (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: categoryOptionsVisible, disabled }}
                testID={indexTestID}
                disabled={disabled}
                onPress={() => setCategoryOptionsVisible((visible) => !visible)}
                style={[
                  styles.categorySelector,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.category, { color: colors.text }]}>
                  {category.emoji} {category.label}
                </Text>
              </Pressable>
              {categoryOptionsVisible ? (
                <View style={styles.categoryOptions}>
                  {shoppingCategories.map((option) => (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: option.id === value, disabled }}
                      testID={`${indexTestID}-option-${option.id}`}
                      disabled={disabled}
                      onPress={() => {
                        categoryManuallyOverridden.current = true;
                        onChange(option.id);
                        setCategoryOptionsVisible(false);
                      }}
                      style={[
                        styles.unitOption,
                        {
                          backgroundColor:
                            option.id === value ? colors.accentSoft : colors.background,
                          borderColor: option.id === value ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.text }}>
                        {option.emoji} {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          );
        }}
      />
    </RecipeCard>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', marginTop: Spacing.one },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    fontSize: 16,
  },
  description: { minHeight: 88, textAlignVertical: 'top', paddingTop: Spacing.two },
  ingredientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remove: { fontSize: 13, fontWeight: '600' },
  unitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  unitOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  category: { fontSize: 15, paddingVertical: Spacing.two },
  categorySelector: { borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.two },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, marginTop: Spacing.one },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: Spacing.one,
  },
  durationInput: {
    width: 72,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.one,
    textAlign: 'center',
  },
});
