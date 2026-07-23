// Single source of truth for job/skill categories.
// Must match the "job" values the price model was trained on
// (see backend/model/price_model.pkl / india_job_pricing_dataset.csv).
export const SKILLS = [
  "Plumber", "Electrician", "Painter", "Mason", "Carpenter", "Driver",
  "Helper", "AC Technician", "Welder", "Gardener", "Cook", "Security Guard",
  "Cleaner / Sweeper", "Tailor", "Beautician", "Delivery Boy",
  "Caretaker / Nurse", "Tutor / Teacher", "Mechanic", "Tiler",
  "Waterproofing Expert", "Glass / Aluminium Worker", "Lift Technician",
  "CCTV Technician", "Solar Panel Technician",
];

// Must match the "difficulty" values the price model was trained on.
export const DIFFICULTIES = ["Easy", "Medium", "Hard"];
