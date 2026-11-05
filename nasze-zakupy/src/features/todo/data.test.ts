import {
  addTodoItem,
  deleteTodoItem,
  fetchTodoItems,
  normalizeTodoDueDate,
  updateTodoItem,
} from './data';

const mockFrom = jest.fn();
const mockQuery = {
  delete: jest.fn(),
  eq: jest.fn(),
  insert: jest.fn(),
  maybeSingle: jest.fn(),
  order: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
  then: jest.fn(),
};

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('todo data operations', () => {
  let mockResult: { data: unknown; error: unknown };

  beforeEach(() => {
    mockResult = { data: [], error: null };
    mockFrom.mockReset().mockReturnValue(mockQuery);
    mockQuery.delete.mockReset().mockReturnValue(mockQuery);
    mockQuery.eq.mockReset().mockReturnValue(mockQuery);
    mockQuery.insert.mockReset().mockReturnValue(mockQuery);
    mockQuery.maybeSingle.mockReset().mockImplementation(() => Promise.resolve(mockResult));
    mockQuery.order.mockReset().mockReturnValue(mockQuery);
    mockQuery.select.mockReset().mockReturnValue(mockQuery);
    mockQuery.update.mockReset().mockReturnValue(mockQuery);
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

  it('fetches household tasks with pending items first and upcoming deadlines next', async () => {
    mockResult = { data: [], error: null };
    await expect(fetchTodoItems('household-1')).resolves.toEqual([]);

    expect(mockFrom).toHaveBeenCalledWith('todo_items');
    expect(mockQuery.eq).toHaveBeenCalledWith('household_id', 'household-1');
    expect(mockQuery.order).toHaveBeenNthCalledWith(1, 'completed', { ascending: true });
    expect(mockQuery.order).toHaveBeenNthCalledWith(2, 'due_date', {
      ascending: true,
      nullsFirst: false,
    });
  });

  it('creates tasks with and without a deadline', async () => {
    await addTodoItem('household-1', 'user-1', '  Odebrać paczkę  ', '');
    expect(mockQuery.insert).toHaveBeenLastCalledWith({
      household_id: 'household-1',
      title: 'Odebrać paczkę',
      due_date: null,
      created_by: 'user-1',
    });

    await addTodoItem('household-1', 'user-1', 'Dentysta', '2026-11-12');
    expect(mockQuery.insert).toHaveBeenLastCalledWith({
      household_id: 'household-1',
      title: 'Dentysta',
      due_date: '2026-11-12',
      created_by: 'user-1',
    });
  });

  it('updates, completes and deletes a task, surfacing missing-row and backend errors', async () => {
    mockResult = { data: { id: 'todo-1' }, error: null };
    await updateTodoItem('household-1', 'todo-1', {
      title: 'Dentysta',
      dueDate: '',
    });
    expect(mockQuery.update).toHaveBeenCalledWith({ title: 'Dentysta', due_date: null });
    expect(mockQuery.eq).toHaveBeenNthCalledWith(1, 'household_id', 'household-1');
    expect(mockQuery.eq).toHaveBeenNthCalledWith(2, 'id', 'todo-1');

    await updateTodoItem('household-1', 'todo-1', {
      title: 'Dentysta',
      dueDate: '2026-11-12',
      completed: true,
    });
    expect(mockQuery.update).toHaveBeenLastCalledWith({
      title: 'Dentysta',
      due_date: '2026-11-12',
      completed: true,
    });

    await deleteTodoItem('household-1', 'todo-1');
    expect(mockQuery.delete).toHaveBeenCalledTimes(1);

    mockResult = { data: null, error: null };
    await expect(deleteTodoItem('household-1', 'missing')).rejects.toThrow(
      'Nie znaleziono zadania',
    );

    const backendError = new Error('RPC failed');
    mockResult = { data: null, error: backendError };
    await expect(fetchTodoItems('household-1')).rejects.toBe(backendError);
  });
});
