import { z } from 'zod';

import { shoppingCategories } from '@/features/shopping/categories';
import type { ShoppingCategoryId } from '@/features/shopping/categories';
import { shoppingUnits } from '@/features/shopping/schemas';

const quantitySchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value.replace(',', '.')))
  .refine((value) => value === null || /^\d+(?:\.\d{1,3})?$/.test(value), {
    message: 'Podaj ilość jako liczbę, np. 1 lub 1,5.',
  })
  .transform((value) => (value === null ? null : Number(value)))
  .pipe(z.number().positive('Ilość musi być większa od zera.').nullable());

const durationMinutesSchema = z
  .string()
  .trim()
  .default('')
  .transform((value) => (value === '' ? null : value))
  .refine((value) => value === null || /^\d+$/.test(value), {
    message: 'Podaj liczbę całkowitych minut nie mniejszą niż zero.',
  })
  .transform((value) => (value === null ? null : Number(value)))
  .pipe(
    z
      .number()
      .int('Czas musi być podany w całych minutach.')
      .min(0, 'Czas nie może być ujemny.')
      .max(2147483647, 'Podana liczba minut jest zbyt duża.')
      .nullable(),
  );

export const recipeItemSchema = z.object({
  name: z.string().trim().min(1, 'Wpisz nazwę produktu.').max(120),
  quantity: quantitySchema,
  unit: z.enum(shoppingUnits).nullable(),
  category: z.enum(
    shoppingCategories.map(({ id }) => id) as [ShoppingCategoryId, ...ShoppingCategoryId[]],
  ),
});

export const recipeSchema = z.object({
  name: z.string().trim().min(1, 'Wpisz nazwę przepisu.').max(120),
  description: z.string().trim().max(2000, 'Opis może mieć maksymalnie 2000 znaków.'),
  steps: z
    .array(
      z.object({
        text: z.string().trim().max(500, 'Punkt może mieć maksymalnie 500 znaków.'),
        duration_minutes: durationMinutesSchema,
      }),
    )
    .max(50, 'Możesz dodać maksymalnie 50 punktów.')
    .transform((steps) =>
      steps
        .filter((step) => step.text.length > 0)
        .map((step, sort_order) => ({ ...step, sort_order })),
    ),
  items: z.array(recipeItemSchema).min(1, 'Dodaj co najmniej jeden składnik.').max(100),
});

export type RecipeFormInput = z.input<typeof recipeSchema>;
export type RecipeFormValues = z.output<typeof recipeSchema>;
