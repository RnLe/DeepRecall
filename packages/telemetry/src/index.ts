export { logger, registerSinks, hijackConsole } from "./logger";
export type { Level, Domain, LogEvent, Sink } from "./logger";

// Auth integration (future)
export {
  deriveActorUid,
  generateSessionId,
  getTelemetryUserContext,
  getTelemetryHeaders,
} from "./auth";
export type { TelemetryUserContext } from "./auth";
