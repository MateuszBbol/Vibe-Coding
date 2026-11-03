import {
  acceptHouseholdInvitation,
  createHousehold,
  createHouseholdInvitation,
  deleteHousehold,
  leaveHousehold,
} from './data';
import { invitationTokenSchema } from './schemas';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('household invitation RPC flow', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('passes a generated invitation token unchanged from creation through validation to acceptance', async () => {
    const generatedToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    mockRpc.mockResolvedValueOnce({ data: generatedToken, error: null }).mockResolvedValueOnce({
      data: [{ household_id: 'household-id', household_name: 'Nasze Zakupy' }],
      error: null,
    });

    const createdToken = await createHouseholdInvitation('household-id', 'member@example.com');
    const validatedToken = invitationTokenSchema.parse(createdToken);
    await acceptHouseholdInvitation(validatedToken);

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'create_household_invitation', {
      target_household_id: 'household-id',
      target_email: 'member@example.com',
    });
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'accept_household_invitation', {
      invitation_token: generatedToken,
    });
  });

  it('creates a household through the guarded RPC and returns its identity', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ household_id: 'new-household', household_name: 'Dom' }],
      error: null,
    });

    await expect(createHousehold('Dom')).resolves.toEqual({
      id: 'new-household',
      name: 'Dom',
    });
    expect(mockRpc).toHaveBeenCalledWith('create_household', { target_name: 'Dom' });
  });

  it('returns the household id accepted by the invitation RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ household_id: 'joined-household', household_name: 'Dom' }],
      error: null,
    });

    await expect(acceptHouseholdInvitation('a'.repeat(64))).resolves.toBe('joined-household');
  });

  it('leaves a household through its dedicated RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(leaveHousehold('household-1')).resolves.toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith('leave_household', {
      target_household_id: 'household-1',
    });
  });

  it('deletes only the requested household through the confirmation-protected RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(deleteHousehold('household-1', 'Dom')).resolves.toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith('delete_household', {
      target_household_id: 'household-1',
      confirmation_name: 'Dom',
    });
  });
});
