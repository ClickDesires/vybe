import type { AlertButton } from 'react-native';

/**
 * React Native Web's Alert does nothing, so map alerts to the browser's dialogs:
 * one button (or none) → window.alert; a cancel + action pair → window.confirm.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    if (actions.length === 0) {
      window.alert(text);
      return;
    }
    if (actions.length === 1 && buttons!.length === 1) {
      window.alert(text);
      actions[0].onPress?.();
      return;
    }
    if (window.confirm(text)) actions[0].onPress?.();
    else buttons?.find((b) => b.style === 'cancel')?.onPress?.();
  },
};
