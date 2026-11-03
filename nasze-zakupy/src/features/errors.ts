import { strings } from '@/localization';

type DiagnosticError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

export function logFeatureError(
  operation: string,
  error: unknown,
  context: Record<string, string | null | undefined> = {},
): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const diagnostic: Record<string, string | null | undefined> = { ...context };
  if (error && typeof error === 'object') {
    const details = error as DiagnosticError;
    for (const field of ['code', 'message', 'details', 'hint'] as const) {
      const value = details[field];
      if (typeof value === 'string' || value === null) {
        diagnostic[field] = value;
      }
    }
  } else if (typeof error === 'string') {
    diagnostic.message = error;
  }

  console.error(operation, diagnostic);
}

export function getFeatureErrorMessage(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';
  const text = strings.pl.featureErrors;

  if (message.includes('authentication required')) {
    return text.deleteAuthRequired;
  }
  if (message.includes('household not found')) {
    return text.deleteNotFound;
  }
  if (message.includes('household unavailable') || message.includes('no accessible household')) {
    return strings.pl.recipes.householdUnavailable;
  }
  if (message.includes('only the household owner can delete')) {
    return text.deleteOwnerOnly;
  }
  if (message.includes('household confirmation does not match')) {
    return text.deleteConfirmationMismatch;
  }
  if (
    message.includes('network request failed') ||
    message.includes('fetch failed') ||
    message.includes('network error')
  ) {
    return strings.pl.auth.noInternet;
  }
  if (message.includes('no account exists for this email')) {
    return text.accountNotFound;
  }
  if (message.includes('invitation is invalid or unavailable')) {
    return text.invitationInvalid;
  }
  if (message.includes('already belongs to another household')) {
    return text.alreadyInAnotherHousehold;
  }
  if (message.includes('already a household member')) {
    return text.alreadyMember;
  }
  if (message.includes('household limit reached')) {
    return text.householdLimit;
  }
  if (message.includes('household owner cannot leave')) {
    return text.ownerCannotLeave;
  }
  if (message.includes('last household member cannot leave')) {
    return text.lastHouseholdMember;
  }
  if (message.includes('cannot invite your own account')) {
    return text.cannotInviteYourself;
  }
  return text.actionFailed;
}
