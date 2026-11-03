import { supabase } from '@/lib/supabase/client';

export type Household = {
  id: string;
  name: string;
  owner_id: string;
  role: 'owner' | 'member';
  joined_at: string;
};

function requireSupabase() {
  if (!supabase) {
    throw new Error('Brak konfiguracji Supabase.');
  }
  return supabase;
}

function logHouseholdRpcError(operation: string, error: unknown, token?: string): void {
  if (process.env.NODE_ENV !== 'development' || !error || typeof error !== 'object') {
    return;
  }

  const redactToken = (value: unknown): unknown => {
    if (typeof value !== 'string' || !token) {
      return value;
    }
    return value.split(token).join('[redacted]');
  };
  const details = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  console.error(`[household] ${operation} Supabase RPC failed`, {
    code: redactToken(details.code),
    message: redactToken(details.message),
    details: redactToken(details.details),
    hint: redactToken(details.hint),
  });
}

export async function fetchUserHouseholds(userId: string): Promise<Household[]> {
  const client = requireSupabase();
  const { data: memberships, error: membershipsError } = await client
    .from('household_members')
    .select('household_id, role, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });

  if (membershipsError) {
    throw membershipsError;
  }
  if (!memberships?.length) {
    return [];
  }

  const { data: households, error: householdsError } = await client
    .from('households')
    .select('id, name, owner_id')
    .in(
      'id',
      memberships.map((membership) => membership.household_id),
    );

  if (householdsError) {
    throw householdsError;
  }

  const membershipByHousehold = new Map(
    memberships.map((membership) => [membership.household_id, membership]),
  );
  return (households ?? [])
    .map((household) => {
      const membership = membershipByHousehold.get(household.id);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'member')) {
        throw new Error('Nieprawidłowe członkostwo gospodarstwa.');
      }
      return {
        ...household,
        role: membership.role,
        joined_at: membership.joined_at,
      };
    })
    .sort((left, right) => left.joined_at.localeCompare(right.joined_at));
}

export async function createHousehold(name: string): Promise<Pick<Household, 'id' | 'name'>> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_household', {
    target_name: name,
  });

  if (error) {
    logHouseholdRpcError('create household', error);
    throw error;
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Nie udało się utworzyć gospodarstwa.');
  }
  const created = data[0];
  if (
    !created ||
    typeof created !== 'object' ||
    !('household_id' in created) ||
    !('household_name' in created) ||
    typeof created.household_id !== 'string' ||
    typeof created.household_name !== 'string'
  ) {
    throw new Error('Nie udało się odczytać utworzonego gospodarstwa.');
  }
  return {
    id: created.household_id,
    name: created.household_name,
  };
}

export async function createHouseholdInvitation(
  householdId: string,
  email: string,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_household_invitation', {
    target_household_id: householdId,
    target_email: email,
  });

  if (error) {
    logHouseholdRpcError('create invitation', error);
    throw error;
  }
  if (typeof data !== 'string') {
    throw new Error('Nie udało się utworzyć zaproszenia.');
  }
  return data;
}

export async function acceptHouseholdInvitation(token: string): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('accept_household_invitation', {
    invitation_token: token,
  });

  if (error) {
    logHouseholdRpcError('accept invitation', error, token);
    throw error;
  }
  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    !data[0] ||
    typeof data[0] !== 'object' ||
    !('household_id' in data[0]) ||
    typeof data[0].household_id !== 'string'
  ) {
    throw new Error('Zaproszenie jest nieprawidłowe lub niedostępne.');
  }
  return data[0].household_id;
}

export async function leaveHousehold(householdId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('leave_household', {
    target_household_id: householdId,
  });

  if (error) {
    logHouseholdRpcError('leave household', error);
    throw error;
  }
}

export async function deleteHousehold(
  householdId: string,
  confirmationName: string,
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('delete_household', {
    target_household_id: householdId,
    confirmation_name: confirmationName,
  });

  if (error) {
    throw error;
  }
}
