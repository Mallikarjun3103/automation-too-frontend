# NOAT Frontend

React web app for **NOAT**, Niruthi's internal assistant portal. Employees sign in with email + OTP or face login and get a dashboard of AI tools: email drafting, Jira tickets, HR policies, document generation, CTC calculation, file sharing and email signatures. What each user sees depends on their role.

Built with Create React App (`react-scripts` 5), React 18 and MUI 7. It talks to the NOAT backend API over REST.

## Getting started

Requirements: Node.js 18+ and npm.

```bash
git clone https://github.com/niruthi-climate-and-ecosystems/noat_frontend.git
cd noat_frontend
npm install
```

To work on a specific branch, check it out after cloning (`git checkout <branch>`), or clone it directly with `git clone -b <branch> ...`.

Create a `.env` file in the project root:

```env
# Backend API base URL. Leave off the trailing slash.
REACT_APP_URL=<backend_URL>
```

Then start the dev server:

```bash
npm start
```

The app opens at http://localhost:3000.

> `.env` is read only at startup, so restart `npm start` after you change it. The file is git-ignored; don't commit it.

## Scripts

| Command         | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm start`     | Dev server with hot reload on port 3000       |
| `npm run build` | Production build into `build/`                |
| `npm test`      | Runs tests with Jest (jsdom)                  |

## Environment variables

| Variable        | Required | Description                                                                 |
| --------------- | -------- | --------------------------------------------------------------------------- |
| `REACT_APP_URL` | Yes      | Base URL of the NOAT backend. The code appends paths such as `/admin/users`. |

If `REACT_APP_URL` points to an ngrok URL, `src/ngrokFetch.js` adds the `ngrok-skip-browser-warning` header for you.

**Exception:** `src/components/Chatbot.jsx` (File Sharing) does not use `REACT_APP_URL`. Its backend address (`http://183.82.109.218:8187`) is hardcoded in the file.

## Features by role

| Tool              | Role     | Component            | Backend routes               |
| ----------------- | -------- | -------------------- | ---------------------------- |
| Documents         | HR       | `Documents.jsx`      | `/autofill/*`                |
| CTC Calculator    | HR       | `Ctc.jsx`            | `/ctc/calculate`             |
| Email Assistant   | Employee | `EmailAssistant.jsx` | `/mailbot/*`                 |
| Ticket Generator  | Employee | `JiraTicket.jsx`     | `/jira-bot/*`                |
| Policy Assistant  | Employee | `OnBoard.jsx`        | `/onboard/*`                 |
| File Sharing      | Employee | `Chatbot.jsx`        | separate hardcoded server    |
| Email Signature   | Employee | `EmailSignature.jsx` | `/signature/*`               |
| Admin Panel       | Admin    | `Admin.jsx`          | `/admin/*`                   |

The Dashboard (`Dashboard.jsx`, `DashboardOverview.jsx`) also shows recent tool sessions from `/tool-sessions/*`.

## Authentication

- **Sign up** (`Register.jsx`, `FaceCapture.jsx`): email OTP verification, then face enrolment (`/signup/*`).
- **Login** (`Landing.jsx`, `EmailLogin.jsx`, `FaceFlow.jsx`): email login or face login (`/login/face/*`).
- **Tokens**: `access_token` and `refresh_token` are kept in `localStorage`.
- **Authenticated requests**: `authFetch.jsx` adds the `Authorization: Bearer` header. On a `401` it refreshes the token through `/login/refresh` and retries once. If the refresh fails, it dispatches a `sessionExpired` event.
- **Session screens**: `App.js` listens for `sessionExpired` and `manualLogout` and shows the matching screen, including how long the user was logged in.

## Project structure

```
public/            static assets and index.html used by CRA
src/
  index.js         entry point (loads ngrokFetch, renders App)
  App.js           session-expired / logout handling, renders Landing
  ngrokFetch.js    fetch patch for ngrok-hosted backends
  components/      pages and tools (see tables above)
  styles/          per-feature CSS
  assets/          icons and images
Dockerfile         multi-stage build: Node 18 build, then served by nginx
Jenkinsfile        CI/CD pipeline for production deploys
```

> `index.html` in the project root, `src/main.jsx` and `src/App.jsx` are leftovers from Vite. CRA ignores them; the real entry points are `public/index.html` and `src/index.js`.

## Deployment

Production deploys go through Jenkins (`Jenkinsfile`):

1. Builds the Docker image `noat_frontend_production:prod`, passing `REACT_APP_URL` from the Jenkins credential of the same name as a build arg.
2. Stops and removes the old container.
3. Runs the new container on port **3016**, with nginx serving the build on port 80 inside the container.

To build and run it yourself:

```bash
docker build --build-arg REACT_APP_URL=https://your-backend -t noat_frontend .
docker run -d -p 3016:80 noat_frontend
```

`REACT_APP_URL` is baked in at build time, so you have to rebuild the image when the backend URL changes.

## Troubleshooting

- **`npm error Missing script: "start"`**: `package.json` has been overwritten, for example by `npm init`. Restore it with `git restore package.json package-lock.json`.
- **App served under a path like `/niruthi-climate-and-ecosystems/...`**: someone added a `homepage` field to `package.json`. Remove it.
- **API calls go to `undefined/...`**: `.env` is missing, or `npm start` hasn't been restarted since you edited it.
