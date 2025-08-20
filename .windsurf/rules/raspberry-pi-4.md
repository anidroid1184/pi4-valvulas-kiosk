---
trigger: always_on
---

1. General Principles

1.1. The system must be developed using Python 3 as the main language.
1.2. All features must be broken down into micro-goals, each one testable independently.
1.3. No new feature can be integrated unless it has passed its individual tests.
1.4. The entire solution must operate offline and be self-contained in the Raspberry Pi 4B environment.
1.5. Deliverables (source code, databases, documentation, test results) must be versioned and stored.
1.6. Scope is strictly limited to a maximum of 80 valves; scalability beyond this is explicitly excluded.
1.7. The system must be usable by non-technical personnel with minimal training.
1.8. Any scope changes must be documented and treated as new requirements with new costs and timelines.

2. Hardware Validation Rules

2.1. The client must validate and set up the hardware before software deployment begins.
2.2. The screen is a 7-inch IPS HDMI capacitive touchscreen (1024×600 resolution).
2.3. Connections required:

HDMI → Raspberry Pi (video).

USB → Raspberry Pi (touch control).

5V power (if required by the model).

2.4. On first boot, the Raspberry Pi must display video output correctly. If the resolution is not 1024×600, it must be adjusted using raspi-config or configuration files.
2.5. Touch functionality must be confirmed by opening a simple Tkinter Python script with interactive buttons.
2.6. Multitouch must be validated (if supported by the hardware).
2.7. The ArduCam IMX708 camera must be connected and tested for image capture.
2.8. A QR code must be scanned using the camera and decoded successfully before integration with the valve database.
2.9. Hardware confirmation is a mandatory prerequisite for software integration. If the screen or camera fails, development halts until resolved.

3. Software Development Rules
3.1 Database Layer

The system will store information for up to 80 valves.

Database technology: SQLite as the primary database; CSV accepted for import/export.

Each valve entry must include the following fields:

ID (integer, unique).

Name (string).

Use (string, describing function).

Location (string: city, building, area).

QR code (string or image reference).

Photo (path to image file, optimized).

Data must persist across reboots or unexpected shutdowns.

All database operations must be optimized for speed (<2 seconds retrieval time).

3.2 Image Handling

All valve images must be compressed and optimized prior to use.

Resolution must balance clarity and performance (target: <500 KB per image).

Images must load in less than 2 seconds on the Raspberry Pi.

3.3 QR Scanning Module

Must use pyzbar or OpenCV to decode QR codes.

Recognition must occur in less than 2 seconds under normal lighting.

Each QR code must correspond uniquely to one valve record in the database.

If no match is found, the system must show a clear error message.

3.4 Manual Search Module

Users must be able to browse valves manually on the touchscreen.

A searchable list must be displayed, with filters by name or ID.

Search results must display instantly, with a maximum delay of 2 seconds.

Each valve selected must open a detail view with photo, name, use, and location.

3.5 User Interface (UI)

UI must be built using Tkinter in fullscreen (kiosk mode).

Main screens required:

Home Screen / Menu.

QR Scan Result.

Manual Search List.

Valve Detail Page.

Map/Diagram View (optional, depending on client-provided data).

Navigation must be clear, requiring no more than 3 taps for any action.

Font size and button size must be suitable for touchscreen use by non-technical staff.

3.6 Kiosk Mode

The application must auto-start on Raspberry Pi boot.

System must run in fullscreen, with no access to desktop or OS menus.

No user login or authentication is required; system must be open-access.

If the application crashes, it must auto-restart without user intervention.

4. Testing Rules
4.1 Unit Testing

Each software module (QR scan, DB query, UI navigation) must include at least one unit test.

Tests must confirm correct input/output behavior.

4.2 Integration Testing

Full flow must be tested: Camera → QR Scan → Database Query → UI Display.

Database updates (CSV import) must appear instantly in UI.

4.3 Performance Testing

Response time for any interaction (QR scan, search, image display) must be <2 seconds.

Stress test: navigation across 80 valves must remain smooth and stable.

Memory usage must remain within Raspberry Pi 4B (4 GB RAM) limits.

4.4 Acceptance Testing

Client must confirm:

Each scanned QR displays the correct valve.

Manual search finds the correct valve consistently.

System boots automatically into kiosk mode.

Final acceptance requires on-site client testing and written confirmation.

5. Documentation Rules

5.1 Technical Documentation

Must describe architecture, dependencies, installation, and configuration.

Must include explanation of libraries used (e.g., tkinter, opencv, sqlite3).

Must include troubleshooting steps for hardware (camera/screen).

5.2 User Manual

Simple instructions for:

Starting the system (booting Raspberry Pi).

Scanning a valve via QR code.

Searching manually for a valve.

Understanding valve detail pages.

Must be written in simple, non-technical language.

5.3 Testing Report

All unit, integration, and acceptance tests must be logged.

Failures must be documented with date, cause, and resolution.

6. Maintenance Rules

6.1. Maintenance period is limited to 2 weeks after delivery.
6.2. Support is corrective only: fixing bugs or failures.
6.3. Enhancements, feature requests, or scope changes require new agreements.
6.4. No internet or remote updates are planned; updates must be installed manually on-site.
6.5. Security is limited to kiosk isolation; no user authentication will be added unless specified in new requirements.

7. Client Responsibilities

Provide complete list of valves with data and photos in CSV format before development begins.

Provide the Raspberry Pi 4B, the touchscreen, and the camera for testing.

Validate hardware connections (screen, touch, camera) before integration.

Report any hardware failures immediately.

Participate in acceptance testing at the end of the project.

8. Developer Responsibilities

Deliver software strictly within agreed scope (QR scan + manual search + valve details).

Ensure performance (<2 seconds response).

Deliver clean, documented, and tested source code.

Provide both technical and user documentation.

Support client during 2-week post-delivery corrective period.

9. Risk Management Rules

Hardware incompatibility (screen/camera) is client’s responsibility to resolve.

Delays in client data delivery (photos, CSV) may cause project delays.

Software risks (QR library failure, Tkinter bugs) must be documented and mitigated with alternatives.

The system is not scalable; future expansion requires a new project.

10. Final Acceptance Criteria

The system must scan and recognize QR codes correctly, in <2 seconds.

The manual search must retrieve valves correctly, with instant results.

The UI must display valve details (photo, name, location, use) clearly.

The application must auto-start in kiosk mode with no user intervention.

Technical documentation, user manual, and test report must be delivered.

Client must provide final approval after testing in real environment.