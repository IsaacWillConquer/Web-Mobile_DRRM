# Development of a Web and Mobile-Based Disaster Rescue Reporting and Monitoring System

**Course:** IT 305 – Advance Web Development (Final Student Output)
**School:** Bulacan State University, College of Information and Communications Technology
**Sections:** BSIT 3J G1 / BSIT 3J G2
**Grouping:** Minimum 4, maximum 5 members
**Period Timeline:** October 12 – 30, 2026
**Submission Date:** November 2, 2026

---

## 1. Project Overview

A web and mobile system that lets residents report emergencies and disasters (floods, fires, earthquakes, landslides, and other calamities) through a mobile app or website. Authorized responders and administrators can receive, monitor, prioritize, and manage rescue requests in real time.

The system aims to improve communication between affected individuals, rescue teams, and disaster management offices so emergency personnel can respond more efficiently.

## 2. General Objective

To develop a web- and mobile-based system that provides an efficient, accessible, and centralized platform for disaster reporting, rescue request management, emergency monitoring, and coordination between affected residents and authorized rescue personnel.

## 3. Specific Objectives

- Allow users to submit disaster and emergency reports through a website or mobile application.
- Capture the reporter's location using GPS or a manually selected map location.
- Allow users to upload photos and provide descriptions of incidents.
- Enable administrators to verify, classify, and prioritize incoming reports.
- Provide rescue teams with assigned rescue requests and incident locations.
- Display disaster incidents on an interactive map.
- Allow users to monitor the status of their rescue requests.
- Send notifications and updates to reporters, administrators, and responders.
- Maintain records of incidents, rescue operations, and response outcomes.
- Generate reports and statistics to support disaster preparedness and response planning.

## 4. User Roles and Permissions

| Role | Permissions |
|---|---|
| **Resident / Reporter** | Submit reports, provide incident locations, upload supporting evidence, track submitted requests |
| **Administrator / Dispatcher** | Verify reports, determine priority, assign rescue teams, manage accounts, monitor incidents |
| **Rescue Team** | Receive assignments, access authorized incident information, update response status, record outcomes |
| **Disaster Management Officer** | Review incident trends, monitor overall operations, generate disaster management reports per assigned permissions |

## 5. Functional Requirements

| ID | Requirement | Description |
|---|---|---|
| FR-01 | User Authentication | The system shall allow authorized users to register and log in securely. |
| FR-02 | Disaster Reporting | Users shall be able to report floods, fires, earthquakes, and other emergencies. |
| FR-03 | Location Tracking | The system shall capture GPS coordinates or accept a manually selected location. |
| FR-04 | Image Upload | Users shall be able to attach photos to reports when available. |
| FR-05 | Report Management | Administrators shall be able to review, verify, update, and classify reports. |
| FR-06 | Emergency Prioritization | The system shall support prioritizing incidents based on urgency and risk. |
| FR-07 | Rescue Assignment | Administrators or authorized dispatchers shall assign incidents to rescue teams. |
| FR-08 | Status Monitoring | Users and authorized personnel shall be able to view applicable report statuses. |
| FR-09 | Notifications | The system shall notify relevant users about report acknowledgments, assignments, and status changes. |
| FR-10 | Incident Mapping | The system shall display reported incidents on an interactive map. |
| FR-11 | Rescue Records | Responders shall be able to record rescue activities and outcomes. |
| FR-12 | Report Generation | Administrators shall be able to generate incident summaries and operational statistics. |
| FR-13 | Audit Trail | The system shall record important actions, status changes, and administrative activities. |
| FR-14 | Duplicate Detection | The system should flag potentially duplicate reports for administrative review. |
| FR-15 | Report Verification | The system shall distinguish verified reports from unverified or pending reports. |

## 6. Proposed Technology Stack

Suggested options for a student project or initial operational prototype. The final stack should be chosen based on the team's skills, hosting resources, connectivity, and maintenance capabilities.

| Component | Suggested Technology |
|---|---|
| Web Frontend | HTML, CSS, JavaScript, React, or Vue |
| Mobile Application | Flutter or React Native |
| Backend API | Node.js with Express, Laravel, or Django |
| Database | PostgreSQL with PostGIS, or MySQL |
| Maps and GPS | OpenStreetMap with Leaflet, or a suitable mapping service |
| Push Notifications | Firebase Cloud Messaging |
| Authentication | Secure session-based or token-based authentication |
| Image Storage | Protected object storage or secured server storage |
| Hosting | Cloud hosting or an appropriately secured local government server |
| Reporting | Dashboard charts and downloadable CSV or PDF reports |

## 7. Sample System Workflow

1. Resident opens the web or mobile app
2. Submit disaster report
3. Capture location and incident details
4. Save report in database
5. Notify authorized dispatcher
6. Verify and prioritize report
7. **Report valid?**
   - **No:** Flag for review or reject with reason
   - **Yes:** Assign rescue team → Notify rescue team → Respond to incident → Update rescue status → Record outcome → Close incident and update statistics

### Suggested Report Statuses

1. Submitted
2. Under Verification
3. Verified
4. Awaiting Assignment
5. Team Assigned
6. Rescue in Progress
7. Resolved
8. Closed

Additional statuses such as **Rejected**, **Duplicate**, or **Cancelled** may be included with appropriate permissions and audit records.

## 8. Security and Emergency Safety Requirements

- Require authentication for administrative and responder functions.
- Apply role-based access controls and secure communications using HTTPS.
- Protect sensitive victim information and restrict disclosure of precise locations.
- Validate uploaded images and other files for size, type, and security.
- Keep backups and establish a disaster recovery plan.
- Log changes to report priority, assignment, and incident status.
- Clearly communicate whether a report was successfully submitted.
- Provide alternative reporting instructions when internet connectivity or the system is unavailable.
- Display a warning that submitting a report through the app does not automatically guarantee immediate rescue.
- Coordinate the platform with official emergency dispatch procedures and existing emergency hotlines.

**Philippines deployment:** review against applicable privacy and data protection requirements, including the **Data Privacy Act of 2012**, and coordinate with the relevant local disaster risk reduction and management office (**LDRRMO**).

## 9. Scope of the System

The system consists of three main interfaces.

### A. Mobile Application — Residents and Reporters
- User registration and login
- Emergency and disaster reporting
- GPS location capture
- Photo uploads and incident descriptions
- Rescue request tracking
- Emergency notifications
- Contact information and victim details

### B. Web-Based Admin Dashboard
- View and verify disaster reports
- Manage user accounts and responder accounts
- Monitor incidents on a map
- Prioritize emergency cases
- Assign rescue teams
- Track response progress
- Generate incident and rescue operation reports

### C. Responder Interface — Rescue Teams
- View assigned incidents
- Access incident location and victim information
- Accept or acknowledge rescue assignments
- Update rescue status
- Record the number of people rescued
- Submit operation notes and completion reports

## 10. Sample Interface (Reference Mockups)

**Mobile screens:** Splash / Login, Report Submission, Incident Map & List, Report Tracking, Notifications, User Profile.

**Web screens:** Admin Dashboard, Incident Details (Admin View), Responder Interface (Team View), Rescue Operation Update.

---

*Note: the original document numbers two sections as "6" (Technology Stack and Sample System Workflow) and two as "8" (Scope of the System and Sample Interface). They are renumbered 1–10 here.*
