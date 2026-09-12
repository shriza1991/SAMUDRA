import type { UserContext } from './contracts';

/** UI-only presentation mode. It deliberately does not grant server permissions. */
export type OperationalRole = 'fisher' | 'authority';

/**
 * Context collected by the client and sent only through the canonical
 * ChatRequest.user_context shape. Route/time fields are intentionally absent
 * until their API contract is available.
 */
export type MissionContext = Pick<UserContext, 'origin_harbor' | 'craft_profile'>;

export const DEFAULT_MISSION_CONTEXT: MissionContext = {
  origin_harbor: 'Ratnagiri',
  craft_profile: 'motorized_boat',
};
