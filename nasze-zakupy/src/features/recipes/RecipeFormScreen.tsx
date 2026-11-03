import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect } from 'react';
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
import { getShoppingCategory } from '@/features/shopping/categories';
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

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{text.ingredients}</Text>
          {fields.map((field, index) => (
            <RecipeIngredientForm
              key={field.id}
              testID={`recipe-ingredient-${field.id}`}
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
  index,
  control,
  remove,
  canRemove,
  disabled,
  setValue,
  errors,
}: IngredientFormProps) {
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
              setValue(`items.${index}.category`, classifyShoppingProduct(name), {
                shouldValidate: true,
              });
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
        render={({ field: { value } }) => {
          const category = getShoppingCategory(value);
          return (
            <Text style={[styles.category, { color: colors.secondaryText }]}>
              {category.emoji} {category.label}
            </Text>
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
});
