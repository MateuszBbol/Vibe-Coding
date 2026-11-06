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

// Short codes are 8 characters (shown as ABCD-EFGH) from an alphabet without look-alikes
// (no 0/O, 1/I/L). Case, spaces and dashes are ignored. Older 64-character hex codes,
// also when pasted inside a shared message, are still accepted.
const SHORT_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;
const LEGACY_CODE_PATTERN = /[0-9a-f]{64}/g;

export function normalizeInvitationCode(value: string): string {
  const legacy = value.toLowerCase().match(LEGACY_CODE_PATTERN) ?? [];
  if (legacy.length === 1) {
    return legacy[0];
  }
  const compact = value.toUpperCase().replace(/[\s-]/g, '');
  if (SHORT_CODE_PATTERN.test(compact)) {
    return compact;
  }
  // A shared message: pick the single ABCD-EFGH code inside it.
  const shortCodes = value.toUpperCase().match(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/g) ?? [];
  if (shortCodes.length === 1) {
    const candidate = shortCodes[0].replace('-', '');
    if (SHORT_CODE_PATTERN.test(candidate)) {
      return candidate;
    }
  }
  return compact;
}

export const invitationTokenSchema = z
  .string()
  .trim()
  .max(512, 'Wpisz kod zaproszenia.')
  .transform(normalizeInvitationCode)
  .pipe(
    z
      .string()
      .refine(
        (code) => SHORT_CODE_PATTERN.test(code) || /^[0-9a-f]{64}$/.test(code),
        'Wpisz prawidłowy kod zaproszenia.',
      ),
  );

export const invitationTokenFormSchema = z.object({
  token: invitationTokenSchema,
});

export type HouseholdFormInput = z.input<typeof householdFormSchema>;
export type HouseholdFormValues = z.output<typeof householdFormSchema>;
export type InvitationEmailInput = z.input<typeof invitationEmailFormSchema>;
export type InvitationEmail = z.output<typeof invitationEmailFormSchema>;
export type InvitationTokenInput = z.input<typeof invitationTokenFormSchema>;
export type InvitationToken = z.output<typeof invitationTokenFormSchema>;
