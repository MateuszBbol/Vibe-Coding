import {
  addTodoItem,
  deleteTodoItem,
  fetchTodoItems,
  fetchTodoMembers,
  formatDateForStorage,
  formatTodoDueDate,
  normalizeTodoDueDate,
  parseTodoDate,
  updateTodoItem,
} from './data';
import type { TodoItem } from './data';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockQuery = {
  delete: jest.fn(),
  eq: jest.fn(),
  maybeSingle: jest.fn(),
  order: jest.fn(),
  select: jest.fn(),
  then: jest.fn(),
};

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('todo data operations', () => {
  let mockResult: { data: unknown; error: unknown };
  const task: TodoItem = {
    id: 'todo-1',
    household_id: 'household-1',
    title: 'Dentysta',
    completed: false,
    due_date: null,
    created_at: '2026-11-05T00:00:00.000Z',
    updated_at: '2026-11-05T00:00:00.000Z',
    created_by: 'user-1',
    assignees: [],
  };

  beforeEach(() => {
    mockResult = { data: [], error: null };
    mockFrom.mockReset().mockReturnValue(mockQuery);
    mockRpc.mockReset().mockResolvedValue({ data: null, error: null });
    mockQuery.delete.mockReset().mockReturnValue(mockQuery);
    mockQuery.eq.mockReset().mockReturnValue(mockQuery);
    mockQuery.maybeSingle.mockReset().mockImplementation(() => Promise.resolve(mockResult));
    mockQuery.order.mockReset().mockReturnValue(mockQuery);
    mockQuery.select.mockReset().mockReturnValue(mockQuery);
    mockQuery.then.mockImplementation(
      (
        resolve: (value: { data: unknown; error: unknown }) => unknown,
        reject: ((reason: unknown) => unknown) | undefined,
      ) => Promise.resolve(mockResult).then(resolve, reject),
    );
  });

  it('accepts empty deadlines and validates calendar dates', () => {
    expect(normalizeTodoDueDate('')).toBeNull();
    expect(normalizeTodoDueDate('  ')).toBeNull();
    expect(normalizeTodoDueDate('2026-11-05')).toBe('2026-11-05');
    expect(() => normalizeTodoDueDate('2026-02-30')).toThrow('RRRR-MM-DD');
    expect(() => normalizeTodoDueDate('05-11-2026')).toThrow('RRRR-MM-DD');
  });

  it('keeps date formatting local and uses relative labels for today and tomorrow', () => {
    const today = new Date(2026, 10, 5, 12);
    expect(formatDateForStorage(today)).toBe('2026-11-05');
    expect(parseTodoDate('2026-11-05').getDate()).toBe(5);
    expect(formatTodoDueDate('2026-11-05', today)).toBe('Dzisiaj');
    expect(formatTodoDueDate('2026-11-06', today)).toBe('Jutro');
    expect(formatTodoDueDate('2026-11-12', today)).toBe('12 lis');
  });

  it('fetches task and assignment rows for the household', async () => {
    mockResult = { data: [], error: null };
    await expect(fetchTodoItems('household-1')).resolves.toEqual([]);

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'todo_items');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'todo_item_assignees');
    expect(mockQuery.eq).toHaveBeenCalledWith('household_id', 'household-1');
    expect(mockQuery.order).toHaveBeenNthCalledWith(1, 'completed', { ascending: true });
    expect(mockQuery.order).toHaveBeenNthCalledWith(2, 'due_date', {
      ascending: true,
      nullsFirst: false,
    });
  });

  it('fetches only the current household members through the scoped RPC', async () => {
    const members = [{ user_id: 'user-2', display_name: 'Alex' }];
    mockRpc.mockResolvedValueOnce({ data: members, error: null });
    await expect(fetchTodoMembers('household-1')).resolves.toEqual(members);
    expect(mockRpc).toHaveBeenCalledWith('fetch_todo_household_members', {
      target_household_id: 'household-1',
    });
  });

  it('creates tasks with or without a due date and selected assignees atomically', async () => {
    await addTodoItem('household-1', '  Odebrać paczkę  ', '', ['user-2']);
    expect(mockRpc).toHaveBeenLastCalledWith('create_todo_item', {
      target_household_id: 'household-1',
      target_title: 'Odebrać paczkę',
      target_due_date: null,
      target_user_ids: ['user-2'],
    });

    await addTodoItem('household-1', 'Dentysta', '2026-11-12', []);
    expect(mockRpc).toHaveBeenLastCalledWith('create_todo_item', {
      target_household_id: 'household-1',
      target_title: 'Dentysta',
      target_due_date: '2026-11-12',
      target_user_ids: [],
    });
  });

  it('updates task fields and assignees through one RPC and surfaces failures', async () => {
    await updateTodoItem('household-1', task, {
      title: 'Dentysta',
      dueDate: '2026-11-12',
      completed: true,
      assigneeIds: ['user-2'],
    });
    expect(mockRpc).toHaveBeenCalledWith('update_todo_item', {
      target_household_id: 'household-1',
      target_item_id: 'todo-1',
      target_title: 'Dentysta',
      target_due_date: '2026-11-12',
      target_completed: true,
      target_user_ids: ['user-2'],
      target_expected_updated_at: '2026-11-05T00:00:00.000Z',
    });

    const backendError = new Error('RPC failed');
    mockRpc.mockResolvedValueOnce({ data: null, error: backendError });
    await expect(addTodoItem('household-1', 'Task', '', [])).rejects.toThrow('RPC failed');

    mockResult = { data: null, error: backendError };
    await expect(fetchTodoItems('household-1')).rejects.toThrow();
  });

  it('deletes only the household task and reports missing rows', async () => {
    mockResult = { data: { id: 'todo-1' }, error: null };
    await deleteTodoItem('household-1', 'todo-1');
    expect(mockQuery.delete).toHaveBeenCalledTimes(1);
    expect(mockQuery.eq).toHaveBeenNthCalledWith(1, 'household_id', 'household-1');
    expect(mockQuery.eq).toHaveBeenNthCalledWith(2, 'id', 'todo-1');

    mockResult = { data: null, error: null };
    await expect(deleteTodoItem('household-1', 'missing')).rejects.toThrow(
      'Nie znaleziono zadania',
    );
  });
});
