export const APP_NAME = "DRRM";
export const APP_TAGLINE = "Disaster Rescue Reporting & Monitoring";

export const LDRRMO_HOTLINE = "+639000000000";

export const SAFETY_NOTICE =
  "Submitting a report does not guarantee immediate rescue. " +
  "For life-threatening emergencies, call the LDRRMO hotline.";

export const ROLES = {
  resident: "resident",
  dispatcher: "dispatcher",
  rescueTeam: "rescueTeam",
  dmo: "dmo",
  admin: "admin",
};

export const ROLE_LABELS = {
  resident: "Resident / Reporter",
  dispatcher: "Dispatcher",
  rescueTeam: "Rescue Team",
  dmo: "Disaster Management Officer",
  admin: "Administrator",
};

export const STAFF_ROLES = [
  ROLES.dispatcher,
  ROLES.rescueTeam,
  ROLES.dmo,
  ROLES.admin,
];

export const WEB_ROLES = [
  ROLES.admin,
  ROLES.dispatcher,
  ROLES.rescueTeam,
  ROLES.dmo,
];

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
  config: "config",
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
