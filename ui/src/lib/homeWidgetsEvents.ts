export const OPEN_HOME_WIDGETS = 'devlane:open-home-widgets';

export type OpenHomeWidgetsPayload = unknown;

export function dispatchOpenHomeWidgets(payload?: OpenHomeWidgetsPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_HOME_WIDGETS, { detail: payload }));
}
