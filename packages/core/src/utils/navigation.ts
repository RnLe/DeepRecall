/**
 * Navigation abstraction
 * This allows us to swap between Next.js router and React Router for SPAs
 */

export interface Router {
  push: (path: string) => void;
  replace: (path: string) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch?: (path: string) => void;
}

export interface NavigationContext {
  router: Router;
  pathname: string;
  searchParams: URLSearchParams;
}

// This will be implemented differently in each app
export let navigationContext: NavigationContext | null = null;

export function setNavigationContext(ctx: NavigationContext) {
  navigationContext = ctx;
}

export function useNavigation(): NavigationContext {
  if (!navigationContext) {
    throw new Error("Navigation context not initialized");
  }
  return navigationContext;
}

export function navigate(path: string) {
  if (!navigationContext) {
    throw new Error("Navigation context not initialized");
  }
  navigationContext.router.push(path);
}
