import raw from "../../../data/road_to_december_data.json";
import type { SeasonData } from "./types";

// Single import point for the seeded season data (/data/road_to_december_data.json).
// The Train/Fuel/Analytics/Rules modules that need read-only program content
// (targets, meals, diagnosis cards, etc.) read it from here; user-entered
// data (logs, weigh-ins, settings) always comes from the database instead.
export const seasonData = raw as unknown as SeasonData;

export default seasonData;
