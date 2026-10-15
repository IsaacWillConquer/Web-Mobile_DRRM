export const APP_NAME = "DRRM";
export const APP_TAGLINE = "Disaster Rescue Reporting & Monitoring";

export const ROLES = {
  resident: "resident",
  dispatcher: "dispatcher",
  rescueTeam: "rescueTeam",
  dmo: "dmo",
};

export const ROLE_LABELS = {
  resident: "Resident / Reporter",
  dispatcher: "Administrator / Dispatcher",
  rescueTeam: "Rescue Team",
  dmo: "Disaster Management Officer",
};

export const COLLECTIONS = {
  users: "users",
  reports: "reports",
  reportContacts: "reportContacts",
  clusters: "clusters",
  teams: "teams",
  assignments: "assignments",
  rescueRecords: "rescueRecords",
  notifications: "notifications",
  logs: "logs",
};

export const REPORT_STATUSES = [
  "Submitted",
  "Under Verification",
  "Verified",
  "Awaiting Assignment",
  "Team Assigned",
  "Rescue in Progress",
  "Resolved",
  "Closed",
  "Rejected",
  "Duplicate",
  "Cancelled",
];

export const PRIORITIES = ["low", "medium", "high"];

export const DISASTER_TYPES = [
  "Flood",
  "Fire",
  "Earthquake",
  "Landslide",
  "Typhoon",
  "Storm Surge",
  "Other",
];
