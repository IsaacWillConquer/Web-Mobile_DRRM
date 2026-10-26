export const APP_NAME = "kapIT";
export const APP_TAGLINE = "Disaster Rescue Reporting & Monitoring";
export const APP_TITLE = "kapIT: Disaster Rescue Reporting & Monitoring";

export const APP_DESCRIPTION =
  "A community disaster-response platform. Residents report emergencies from the " +
  "mobile app, while dispatchers, rescue teams, and disaster management officers " +
  "verify, coordinate, and monitor the response from this web dashboard.";

export const DEVELOPERS = "Group 5 · 3J-G1";
export const CREDITS_LINE =
  "IT 305 – Advance Web Development · Bulacan State University";

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

export const TERMS_OF_USE = [
  {
    title: "Acceptable use",
    body:
      "This portal is for authorized staff only (administrator, dispatcher, " +
      "rescue team, and disaster management officer). Submit only genuine, " +
      "accurate information. Do not submit false reports, impersonate others, or " +
      "use the system for any purpose other than disaster response.",
  },
  {
    title: "Accuracy & emergency disclaimer",
    body:
      "Submitting a report does not guarantee immediate rescue. Responders are " +
      "assigned by priority and availability. For life-threatening emergencies, " +
      "call the LDRRMO hotline directly. The system is a coordination aid and is " +
      "not a substitute for official emergency services.",
  },
  {
    title: "Privacy & the Data Privacy Act",
    body:
      "Information you submit, including location and any victim details recorded " +
      "on behalf of others, is used solely to coordinate rescue. Sensitive " +
      "victim/contact details are restricted to authorized responders and are " +
      "handled in line with the Philippines Data Privacy Act of 2012 (RA 10173). " +
      "Do not enter data you are not authorized to share.",
  },
  {
    title: "Data retention & access",
    body:
      "Reports, rescue records, and audit logs are retained to support response, " +
      "monitoring, and reporting, and may be reviewed by administrators. Access is " +
      "controlled by role and enforced by security rules.",
  },
  {
    title: "Liability",
    body:
      "This system is provided as-is for a class project and for community " +
      "response support. The developers and the university are not liable for " +
      "decisions made based on the data shown, or for service interruptions.",
  },
];
