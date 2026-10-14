# Build a Face Recognition-Based Employee/Student Attendance PWA

Develop a web-based employee/student attendance application using **React.js, TypeScript, Vite, Tailwind CSS, and MediaPipe Tasks Vision** for face detection and recognition.

The application must support offline operation, persistent attendance records, user registration, and configurable database/API integration.

## 1. Technology Stack

- **Frontend:** React.js, TypeScript, Vite, Tailwind CSS
- **Face Detection & Recognition:** `@mediapipe/tasks-vision` i.e. https://www.npmjs.com/package/@mediapipe/tasks-vision
- **Local Database:** SQLite for initial development
- **Backend/API:** Optional, configurable for future server-side database integration
- **PWA:** Installable Progressive Web App with offline support
- **Camera:** Browser MediaDevices API with front/back camera switching where supported

Use a modular, maintainable architecture with reusable components, type-safe interfaces, and clear separation of UI, face processing, authentication, and data persistence.

## 2. Home Screen and Camera Interface

- Display a live camera preview on the home screen.
- Provide controls to switch between the front-facing and rear-facing cameras when multiple cameras are available.
- Request camera permissions and handle permission denial, unavailable cameras, and camera initialization errors gracefully.
- Detect faces in real time using MediaPipe Tasks Vision.
- Display clear visual feedback for face detection, successful identification, unknown users, and attendance status.
- Provide navigation to user registration, attendance history, and application settings.
- Ensure the interface is responsive and optimized for desktop, tablet, and mobile devices.

## 3. Face Recognition and Attendance Management

- Capture and process the detected face to identify a registered employee or student.
- Validate the identified user against existing database records before marking attendance.
- If the user is registered and successfully identified, record attendance with the following information:
  - Employee/student ID card number
  - Full name
  - Attendance date and timestamp
  - Attendance status
  - Recognition result and relevant metadata
- Validate existing attendance records to prevent duplicate entries within the configured attendance period.
- Display a clear success or failure message after each scan.
- Handle unknown faces, multiple faces in the camera frame, low-confidence matches, and failed recognition attempts.
- Make the attendance validation rules configurable, including whether multiple attendance entries are permitted on the same day.

**Important:** MediaPipe Tasks Vision provides face detection and face-related processing capabilities but does not, by itself, provide a complete identity-recognition system. Implement a suitable face embedding and matching workflow, or integrate a compatible face-recognition model. Use configurable similarity thresholds and test recognition accuracy under different lighting conditions.

## 4. Employee/Student Registration

Provide a dedicated registration workflow with the following steps:

1. **Password verification:** Ask for a registration password. For initial development, use `123456` as the default password. Keep it configurable and make it easy to replace with secure authentication.
2. **Face capture:** Open the camera and capture a suitable face sample. Validate image quality and ensure a face is detected before proceeding.
3. **User details:** Allow the administrator to enter:
   - Employee/student ID card number
   - Full name
   - User type: Employee or Student
4. **Duplicate validation:** Check the database to ensure the ID card number is not already registered.
5. **Face registration:** Generate and store the required face representation linked to the user's unique database record.
6. **Successful registration:** Save the user details and face representation to the database.
7. **Initial attendance:** After successful registration, automatically create an attendance record for the newly registered user, including the date and timestamp.
8. **Confirmation:** Display a registration success message along with the user's details and attendance status.

Handle duplicate IDs, invalid input, unsuccessful face capture, database errors, and interrupted registration attempts appropriately.

## 5. Database and API Configuration

Use SQLite for the initial implementation, with a configurable data-access layer that supports future API integration.

Design the data model to include at least:

- **Users:** Unique ID, ID card number, full name, user type, face representation, registration timestamp, and active status.
- **Attendance:** Unique record ID, user ID, attendance date, timestamp, status, and source.
- **Settings:** Attendance validation rules, recognition threshold, and relevant application configuration.

Requirements:

- Enforce uniqueness for employee/student ID card numbers.
- Add appropriate database indexes for user lookups and attendance validation.
- Use transactions for registration and attendance operations where applicable.
- Prevent duplicate attendance entries through database constraints and application-level validation.
- Abstract data operations behind a repository or service layer so the application can switch between local storage and an API without major frontend changes.
- Support configurable modes such as `sqlite` and `api`, with the API base URL supplied through environment variables.
- Keep database credentials, API secrets, and sensitive configuration out of client-side code.

**SQLite implementation note:** A browser-based application cannot directly use a conventional server-side SQLite database without an appropriate runtime or backend. Choose one of these approaches:

- **Offline-first browser implementation:** Use SQLite compiled to WebAssembly, such as `sql.js` or an equivalent solution, with persistent storage through IndexedDB or another supported persistence mechanism.
- **Backend implementation:** Use a lightweight backend with SQLite and expose REST APIs to the React application.

Select the approach that best supports offline operation while preserving a clear migration path to a centralized database.

## 6. Progressive Web App and Offline Support

The application must be installable as a PWA and remain usable without an internet connection after its initial setup.

Implement:

- A web app manifest with application name, icons, theme colors, and standalone display mode.
- A service worker to cache application assets and required face-processing models.
- Local persistence for registered users, face representations, application settings, and attendance records.
- Offline face recognition and attendance marking when the required models and data are available locally.
- A synchronization mechanism to upload locally recorded attendance to the backend when connectivity is restored, if API mode is enabled.
- Retry handling, synchronization status, and conflict resolution for offline-created records.
- Unique attendance record IDs and idempotent API operations to prevent duplicate records during synchronization.
- Clear indicators for online/offline status and pending synchronization.

Ensure that camera access works in a secure context, such as HTTPS or localhost, and that the application does not depend on a live network connection for its core offline workflow.

## 7. User Interface and Experience

Create a clean, modern, responsive interface using Tailwind CSS.

Include:

- Live camera preview with camera-switching controls
- Face detection and recognition status indicators
- Registration form and guided registration workflow
- Attendance success/error notifications
- Attendance history with date filters and user search
- Registered employee/student list
- Online/offline and synchronization indicators
- Loading states, empty states, and clear error messages

Keep the workflow simple enough for repeated use at a school entrance, office reception, or attendance checkpoint.

## 8. Security, Privacy, and Reliability

- Treat the initial registration password as a development-only credential and make it configurable.
- Do not store passwords in plaintext when moving to a production authentication system.
- Protect face representations and attendance records against unauthorized access.
- Obtain appropriate consent for biometric processing and provide a clear retention and deletion policy.
- Do not treat face detection alone as proof of identity.
- Consider presentation-attack risks, such as using a photograph or video in front of the camera, before deploying the system in a real attendance environment.
- Minimize biometric data collection and avoid retaining raw face images unless necessary.
- Provide database backup, error logging, and recovery mechanisms appropriate to the selected architecture.

## 9. Deliverables and Acceptance Criteria

Provide a complete, runnable project with:

- Source code and a clear folder structure
- Installation and setup instructions
- Environment configuration example
- SQLite database initialization and schema
- MediaPipe face-processing integration
- Face registration and identity-matching implementation
- Attendance creation and duplicate-validation logic
- PWA manifest, service worker, and offline persistence
- Optional backend/API implementation or a clearly defined API contract
- Sample test data and instructions for resetting the database
- Unit tests for registration, user validation, attendance creation, duplicate prevention, and offline synchronization

The implementation is complete when a user can register an employee/student, capture and register their face, identify them through the live camera, validate their existing record, mark attendance with a timestamp, prevent duplicate attendance according to the configured rules, and continue operating offline after the application has been initialized.

**Development priority:** First implement a working offline-first application using SQLite-compatible browser storage and MediaPipe-based face processing. Then add optional API integration and synchronization without changing the core attendance workflow.

### Note - 
To switch nodejs version use nvm i.e. 
```
nvm use 22
```