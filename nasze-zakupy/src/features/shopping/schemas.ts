import { z } from 'zod';
import { shoppingCategories } from './categories';

export const shoppingUnits = ['szt.', 'kg', 'g', 'l', 'ml', 'opak.'] as const;
export type ShoppingUnit = (typeof shoppingUnits)[number];
export type ShoppingCategoryValue = (typeof shoppingCategories)[number]['id'];

const quantitySchema = z
  .string()
  .trim()
  .min(1, 'Wpisz ilość produktu.')
  .transform((quantity) => quantity.replace(',', '.'))
  .refine((quantity) => /^\d+(?:\.\d{1,3})?$/.test(quantity), {
    message: 'Podaj ilość jako liczbę, np. 1 lub 1,5.',
  })
  .transform(Number)
  .pipe(z.number().positive('Ilość musi być większa od zera.').max(999999999.999));

export const shoppingItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Wpisz nazwę produktu.')
    .max(120, 'Nazwa może mieć maksymalnie 120 znaków.'),
  quantity: quantitySchema,
  unit: z
    .enum(shoppingUnits)
    .nullable()
    .optional()
    .transform((unit) => unit ?? null),
  category: z
    .string()
    .refine((category): category is ShoppingCategoryValue =>
      shoppingCategories.some((supportedCategory) => supportedCategory.id === category),
    )
    .nullable()
    .optional()
    .transform((category) => category ?? null),
});

export type ShoppingItemInput = z.input<typeof shoppingItemSchema>;
export type ShoppingItemValues = z.output<typeof shoppingItemSchema>;
