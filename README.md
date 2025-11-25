ETL QA Agent

A lightweight internal tool that allows analysts and engineers to validate ETL outputs, run Python code, simulate Delta Lake updates, and perform QA checks — all inside a browser-first notebook-style environment powered by Pyodide, with Jira/API authentication, SharePoint export, and a modern themed UI.

✨ Key Features
Notebook-Style Execution (In-Browser)

Create, edit, reorder, clone, delete, and run Python code cells

Output renders inside each cell

All execution handled locally using Pyodide

Auto-saves notebook state to LocalStorage

Authentication Layer

Built-in sign-in modal (email/password demo or Jira/API token pair)

UI state changes after sign-in

Delta table update & import/export locked until API token is validated

Session persisted with sessionStorage + localStorage

Data QA Tools

“Run as New Notebook”

“Update Delta Table” simulation

Import/Export notebook JSON

SharePoint Upload (placeholder / customizable)

Modern UI

Two-theme system:

Light → soft grey shade (YouTube-style modern)

Dark → high-contrast (Spotify/YouTube-style)

Red accent theme (#b81d1d) stays consistent

Smooth micro-animations

Glass-morphism surfaces

Minimal toolbar for each cell

Floating toasts for status updates

Accessible modals & focus trapping

📁 Project Structure
/css
  tokens.css         (design tokens + themes)
  layout.css         (page layout, sidebar, positions)
  components.css     (buttons, modals, navbar, toasts)
  inputs.css         (floating labels, focus states)

 /js
  ui.js              (theme toggler + toasts + nav effects)
  auth-demo.js       (sign-in modal + Jira/API validation)
  wiring.js          (cells, execution engine, runner wiring)
  runner.js          (Pyodide runner)
  dragdrop.js        (cell reordering)

index.html           (main UI)

🧠 How It Works
1. Notebook Logic

The browser:

Builds a runnable notebook dynamically

Stores each cell in LocalStorage

Executes Python inside Pyodide using Runner.runCellCode

2. Authentication Flow

Sign in (email/password or Jira/API pair)

Enables:

Run All

Run As New Notebook

API Token validation enables:

Update Delta

Import

Export

Sign-out resets UI state

3. Delta Simulation

The project includes a DeltaSim mock:

Accepts JSON rows

Performs local "upsert"

Stores versioned table in LocalStorage

4. UI & Themes

Theme toggler switches between <html data-theme="light|dark">

tokens.css provides semantic colors like:

--bg

--surface

--muted

--text

Buttons & modals use red accent tokens

🚀 Getting Started
1. Clone
git clone https://example.com/etl-qa-agent.git
cd etl-qa-agent

2. No backend required

Because everything runs entirely in the browser, simply open:

index.html


in your browser.

3. Demo Credentials
Purpose	Username / Key	Password / Token
Email Login	vishal@project.com	project123
Jira Login	vishal-jira	vishal-token
🧪 Usage Overview
Running Code

Click ▶ Run on any cell

Or click Run All after signing in

Output appears in the .cell-output container

Adding Cells

Use ＋ Add cell at bottom of each cell

Or Add-Between if enabled

Export / Import

Export saves to JSON

Import restores a full notebook

Both require API token validation

📦 SharePoint Integration (Optional)

A placeholder button is included:

Replace logic in wiring.js → uploadBtn handler

Integrate your internal SharePoint API

🔧 Customization
Styling

Modify:

tokens.css for theme changes

inputs.css for floating labels

components.css for modals/buttons

layout.css for sidebar/grid

Authentication

Edit auth-demo.js:

const DEMO_EMAIL = "vishal@project.com";
const DEMO_PW    = "project123";
const DEMO_JIRA  = "vishal-jira";
const DEMO_TOKEN = "vishal-token";

Runner

Replace Pyodide with your internal execution engine if needed.

📘 License

Internal CIBC project — not for external distribution.
