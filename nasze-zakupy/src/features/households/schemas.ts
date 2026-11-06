import { z } from 'zod';

export const householdNameSchema = z
  .string()
  .trim()
  .min(1, 'Wpisz nazwę grupy.')
  .max(80, 'Nazwa może mieć maksymalnie 80 znaków.');

export const householdFormSchema = z.object({
  name: householdNameSchema,
});

export const invitationEmailSchema = z
  .string()
  .trim()
  .email('Wpisz prawidłowy adres e-mail.')
  .max(254, 'Adres e-mail jest za długi.')
  .transform((email) => email.toLowerCase());

export const invitationEmailFormSchema = z.object({
  email: invitationEmailSchema,
});

export const invitationTokenSchema = z
  .string()
  .trim()
  .max(512, 'Wklej kod zaproszenia.')
  .transform((value) => {
    const normalized = value.toLowerCase();
    const tokens = normalized.match(/[0-9a-f]{64}/g) ?? [];
    return tokens.length === 1 ? tokens[0] : normalized;
  })
  .pipe(z.string().regex(/^[0-9a-f]{64}$/, 'Wpisz prawidłowy kod zaproszenia.'));

export const invitationTokenFormSchema = z.object({
  token: invitationTokenSchema,
});

export type HouseholdFormInput = z.input<typeof householdFormSchema>;
export type HouseholdFormValues = z.output<typeof householdFormSchema>;
export type InvitationEmailInput = z.input<typeof invitationEmailFormSchema>;
export type InvitationEmail = z.output<typeof invitationEmailFormSchema>;
export type InvitationTokenInput = z.input<typeof invitationTokenFormSchema>;
export type InvitationToken = z.output<typeof invitationTokenFormSchema>;
