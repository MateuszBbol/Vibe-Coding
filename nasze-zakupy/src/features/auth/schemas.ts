import { z } from 'zod';

import { strings } from '@/localization';

export const emailSchema = z
  .string()
  .trim()
  .email(strings.pl.auth.emailInvalid)
  .transform((email) => email.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, strings.pl.auth.passwordRequired),
});

export type LoginFormInput = z.input<typeof loginSchema>;
export type LoginFormValues = z.output<typeof loginSchema>;
