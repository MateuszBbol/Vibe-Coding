import { Alert, Platform } from 'react-native';

type ConfirmRecipeActionOptions = {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function confirmRecipeAction({
  title,
  message,
  cancelLabel,
  confirmLabel,
  onConfirm,
}: ConfirmRecipeActionOptions): void {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, onPress: onConfirm },
  ]);
}
