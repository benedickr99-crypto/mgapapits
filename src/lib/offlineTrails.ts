import { RoutePoint, CheckpointItem } from "./routeTypes";

export interface OfflineTrailRecord {
  trailKey: string;
  trailName: string;
  mountain: string;
  location: string;
  jumpOffName: string;
  jumpOffCoord: RoutePoint;
  destinationName: string;
  destinationCoord: RoutePoint;
  points: RoutePoint[];
  checkpoints: CheckpointItem[];
  distanceKm: number;
  duration: string;
  difficulty: string;
  safetyReminders: string[];
  downloadedAt: string;
  version: string;
}

const STORAGE_PREFIX = "nnnp_offline_trail_";
const ALL_OFFLINE_INDEX_KEY = "nnnp_offline_trails_index";

/**
 * Saves a trail route and metadata to local offline storage
 */
export function saveTrailForOffline(data: OfflineTrailRecord): boolean {
  try {
    const key = `${STORAGE_PREFIX}${data.trailKey}`;
    localStorage.setItem(key, JSON.stringify(data));

    // Update index list
    const indexStr = localStorage.getItem(ALL_OFFLINE_INDEX_KEY);
    const index: string[] = indexStr ? JSON.parse(indexStr) : [];
    if (!index.includes(data.trailKey)) {
      index.push(data.trailKey);
      localStorage.setItem(ALL_OFFLINE_INDEX_KEY, JSON.stringify(index));
    }
    return true;
  } catch (err) {
    console.error("Failed to save trail offline:", err);
    return false;
  }
}

/**
 * Retrieves a locally saved trail
 */
export function getOfflineTrail(trailKey: string): OfflineTrailRecord | null {
  try {
    const key = `${STORAGE_PREFIX}${trailKey}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineTrailRecord;
  } catch (err) {
    console.warn("Failed to load offline trail:", err);
    return null;
  }
}

/**
 * Checks if a trail is downloaded and available offline
 */
export function isTrailAvailableOffline(trailKey: string): boolean {
  try {
    const key = `${STORAGE_PREFIX}${trailKey}`;
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Removes a downloaded trail from offline storage
 */
export function removeOfflineTrail(trailKey: string): boolean {
  try {
    const key = `${STORAGE_PREFIX}${trailKey}`;
    localStorage.removeItem(key);

    const indexStr = localStorage.getItem(ALL_OFFLINE_INDEX_KEY);
    if (indexStr) {
      const index: string[] = JSON.parse(indexStr);
      const filtered = index.filter((k) => k !== trailKey);
      localStorage.setItem(ALL_OFFLINE_INDEX_KEY, JSON.stringify(filtered));
    }
    return true;
  } catch (err) {
    console.error("Failed to delete offline trail:", err);
    return false;
  }
}

/**
 * Returns all downloaded trails currently in offline storage
 */
export function getAllOfflineTrails(): OfflineTrailRecord[] {
  try {
    const indexStr = localStorage.getItem(ALL_OFFLINE_INDEX_KEY);
    if (!indexStr) return [];
    const index: string[] = JSON.parse(indexStr);
    const records: OfflineTrailRecord[] = [];
    for (const key of index) {
      const trail = getOfflineTrail(key);
      if (trail) records.push(trail);
    }
    return records;
  } catch (err) {
    console.warn("Failed to get all offline trails:", err);
    return [];
  }
}
