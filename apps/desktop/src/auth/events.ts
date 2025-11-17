const AUTH_EVENT_NAME = "deeprecall:auth-state-changed" as const;

type AuthEventDetail = {
  reason?: "signin" | "signout" | "refresh" | "manual";
};

export const AUTH_STATE_CHANGED_EVENT = AUTH_EVENT_NAME;

export function emitAuthStateChanged(detail?: AuthEventDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AuthEventDetail>(AUTH_EVENT_NAME, { detail })
  );
}
