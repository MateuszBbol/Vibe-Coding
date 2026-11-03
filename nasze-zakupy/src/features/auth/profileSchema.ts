import { z } from 'zod';

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Wpisz nazwę wyświetlaną.')
  .max(80, 'Nazwa może mieć maksymalnie 80 znaków.');

export const profileSchema = z.object({
  displayName: displayNameSchema,
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
