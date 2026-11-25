# Test Plan: Emerging Tech AI Assistant No. 5 — ParenAI Universal Topbar Assistant

This document provides a comprehensive test plan for **AI Assistant Feature No. 5: ParenAI Universal Topbar Search & Command Bar** accessible from every page in ParenTech.

---

## 1. Feature Overview
**Ask ParenAI** upgrades the global topbar search bar (`#topbarSearchInput`) into an intelligent, always-available command bar across all organizer pages (`home.html`, `calendar.html`, `grocery.html`, `tasks.html`, `pills.html`, `profile.html`, `faqs.html`, `help.html`, `report-problem.html`).

### Key Capabilities
- **Universal Shortcut & Mobile Trigger**:
  - Desktop: Press <kbd>Ctrl</kbd> + <kbd>K</kbd> (or <kbd>Cmd</kbd> + <kbd>K</kbd>) or click the **Ask ParenAI** pill inside the topbar search box from any page.
  - Mobile ($\le 768\text{px}$): Tap the magic-wand sparkle button in the top-right header (`#mobileCopilotBtn`) to open the floating ParenAI bar.
- **5 Intelligent Intent Modes**:
  1. **Natural Grocery Commands**: Parses multi-item grocery additions with quantities (e.g., *"Add milk and 2 eggs to grocery"*, *"buy bread, butter"*) and adds them safely with duplicate protection.
  2. **Natural Task & Cooking Scheduling**: Uses NLP date/time/category parsing (e.g., *"Remind me to call grandma at 4pm"*, *"cook chicken adobo tonight"*) — automatically syncing recipe ingredients to Grocery when a dish is detected.
  3. **Smart Medication Scheduling**: Parses prescriptions & multi-dose instructions (e.g., *"Amoxicillin 500mg 3x daily"*) into spaced pill reminders.
  4. **Conversational Q&A Answers**: Answers questions directly inside the ParenAI dropdown (*"What are my tasks for today?"*, *"What's in my grocery list?"*, *"Any schedule conflicts?"*, *"My pills today"*).
  5. **Global Live Search & Quick Actions**: Searches across tasks, medications, grocery items, pages, and quick actions (e.g., *"dark mode"*, *"plan weekend"*), while preserving local live list filtering on Grocery, Tasks, Pills, FAQs, and Help pages.

---

## 2. Prerequisites
1. Start the server:
   ```sh
   npm start
   ```
2. Sign in and open any organizer page, such as **`http://localhost:5173/pages/home.html`**.

---

## 3. Test Cases

### TC-PAI-01: Keyboard Shortcut & Starter Prompt Palette
- **Objective**: Verify that pressing `Ctrl+K` (or clicking the search bar) opens the **Ask ParenAI** dropdown with starter suggestions.
- **Steps**:
  1. From any page (e.g. `home.html` or `profile.html`), press <kbd>Ctrl</kbd>+<kbd>K</kbd> (or click `#aiCopilotTriggerBtn`).
  2. Observe the dropdown beneath the search input.
- **Expected Results**:
  - [ ] `#topbarSearchInput` receives focus immediately.
  - [ ] `#aiCopilotDropdown` opens displaying 4 clickable **Try Asking ParenAI** prompt chips and **Quick Jump** links.
  - [ ] Pressing <kbd>Escape</kbd> or clicking outside closes the dropdown cleanly.

---

### TC-PAI-02: Add Multiple Items to Grocery from Any Page
- **Objective**: Verify natural grocery command parsing and 1-Enter execution from outside the Grocery page.
- **Steps**:
  1. Open `pages/home.html` (or `calendar.html`).
  2. Type in the topbar search input: `Add milk and 2 eggs to grocery`
  3. Observe the **ParenAI Action Ready** card in the dropdown.
  4. Press <kbd>Enter</kbd> (or click the card).
- **Expected Results**:
  - [ ] Live preview shows: `Add Milk, 2× Eggs` • *ParenAI Grocery*.
  - [ ] Pressing <kbd>Enter</kbd> shows toast: `🛒 ParenAI added Milk, Eggs to Grocery!`.
  - [ ] Navigate to `pages/grocery.html` and confirm `Milk` (Qty 1) and `Eggs` (Qty 2) appear on the shopping list.

---

### TC-PAI-03: Natural Language Reminder Creation (Cross-Feature Sync)
- **Objective**: Verify creating a task or reminder from **Ask ParenAI** strips conversational prefixes and auto-categorizes properly.
- **Steps**:
  1. Focus `#topbarSearchInput` and type: `Remind me to call grandma at 4pm`
  2. Observe the preview card, then press <kbd>Enter</kbd>.
  3. Next, type: `cook chicken adobo tonight` and press <kbd>Enter</kbd>.
- **Expected Results**:
  - [ ] First command previews: `Create "Call grandma"` • *Family Tasks • Today at 4:00 PM*.
  - [ ] Second command creates `Cook chicken adobo` at `7:00 PM` AND auto-syncs Chicken Adobo ingredients to Grocery!

---

### TC-PAI-04: Schedule Multi-Dose Medication via Topbar
- **Objective**: Verify medication dosage parsing directly from the global search bar.
- **Steps**:
  1. Focus `#topbarSearchInput` and type: `Amoxicillin 500mg 3x daily`
  2. Press <kbd>Enter</kbd>.
- **Expected Results**:
  - [ ] Preview displays: `Schedule Amoxicillin (500mg)` • `8:00 AM, 1:00 PM, 7:00 PM`.
  - [ ] Pressing <kbd>Enter</kbd> saves all 3 doses into Pill Reminders and displays confirmation toast.

---

### TC-PAI-05: Conversational Q&A & Live Global Search
- **Objective**: Verify asking questions displays real-time answers right inside the dropdown without leaving the current page.
- **Steps**:
  1. Type: `What are my tasks for today?`
  2. Type: `Any schedule conflicts?`
  3. Type: `What's in my grocery list?`
- **Expected Results**:
  - [ ] Each query displays a **ParenAI Answer** box with real task/grocery/conflict counts and clickable rows to inspect or jump to the corresponding page.
  - [ ] Pressing <kbd>Enter</kbd> on a Q&A query keeps the answer visible rather than showing an error toast.

---

### TC-PAI-06: Preserved Page Filtering & Quick Commands
- **Objective**: Verify existing page-specific search filtering and quick theme/navigation actions continue working cleanly.
- **Steps**:
  1. Go to `pages/tasks.html` and type a task keyword in `#topbarSearchInput` — confirm the task list filters live.
  2. Go to `pages/faqs.html` and type an FAQ keyword — confirm unrelated FAQ cards hide live, and pressing <kbd>Enter</kbd> opens the match.
  3. Type `dark mode` in the topbar and press <kbd>Enter</kbd> — confirm the theme toggles smoothly.
  4. Shrink browser width below `768px` and verify `#mobileCopilotBtn` opens the floating ParenAI input cleanly.

---

## 4. Regression & Verification Command
Run static syntax checks and the automated test suite:
```sh
npm run check
npm test
```
