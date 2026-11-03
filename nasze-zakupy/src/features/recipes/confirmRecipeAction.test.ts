import { Alert } from 'react-native';
import { confirmRecipeAction } from './confirmRecipeAction';

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'web' },
}));

describe('confirmRecipeAction', () => {
  const options = {
    title: 'Dodać składniki do listy?',
    message: 'Czy dodać 1 składnik do listy Zakupy?',
    cancelLabel: 'Anuluj',
    confirmLabel: 'Dodaj',
  };
  let originalConfirm: typeof globalThis.confirm;

  beforeEach(() => {
    originalConfirm = globalThis.confirm;
    Alert.alert = jest.fn();
  });

  afterEach(() => {
    if (originalConfirm) {
      globalThis.confirm = originalConfirm;
    } else {
      delete (globalThis as { confirm?: typeof globalThis.confirm }).confirm;
    }
  });

  it('runs the add action after accepting the web confirmation', () => {
    const onConfirm = jest.fn();
    globalThis.confirm = jest.fn(() => true);

    confirmRecipeAction({ ...options, onConfirm });

    expect(globalThis.confirm).toHaveBeenCalledWith(
      'Dodać składniki do listy?\n\nCzy dodać 1 składnik do listy Zakupy?',
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does not run the add action when the web confirmation is cancelled', () => {
    const onConfirm = jest.fn();
    globalThis.confirm = jest.fn(() => false);

    confirmRecipeAction({ ...options, onConfirm });

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
