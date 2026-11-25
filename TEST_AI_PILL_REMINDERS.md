# Test Plan: Emerging Tech AI Assistant No. 3 — Pill & Medication Assistant

This document provides a comprehensive test plan for **AI Assistant Feature No. 3: Smart Dose Scheduler, Presets, and Refill-to-Grocery Sync** on the Pill Reminders page (`pills.html`).

---

## 1. Feature Overview
The **AI Health & Dose Assistant** helps parents organize their family's medication regimens with peace of mind. It translates complex prescription instructions into optimal reminder hours, provides 1-tap pediatric and family medication presets, calculates next dosage times, and syncs medicine refills directly into the family's Grocery shopping list.

### Key Components
- **AI Health Cabinet Card (`#aiCabinetCard`)**:
  - Live counter of active medications (`#aiActivePillsCount`).
  - Next dose time for today (`#aiNextDoseTime`).
  - Rotating pediatric medication safety advice (`#aiPillTipText`).
- **1-Tap Common Presets**: Instant pre-filling for *Kids Multivitamin*, *Vitamin C*, *Paracetamol*, *Daily Probiotic*, and *Calcium + D3*.
- **Natural Language Dose & Schedule Optimizer (`aiOptimizePillSchedule`)**:
  - Parses medicine name, dosage, and meal instructions.
  - Automatically computes multi-dose schedules:
    - 3x daily $\rightarrow$ `08:00`, `13:00`, `19:00`
    - Twice daily $\rightarrow$ `08:00`, `20:00`
    - 4x daily $\rightarrow$ `06:00`, `12:00`, `18:00`, `00:00`
  - Interactive schedule picker chips + "Schedule All Doses" 1-click button.
- **Refill-to-Grocery Sync**:
  - Opt-in checkbox inside `#addPillModal` (`#pillRefillSyncCheck`).
  - 1-Click `🛒 Refill` button (`.btn-pill-refill-icon`) directly on each medication card in the list.

---

## 2. Prerequisites
1. Start the server:
   ```sh
   npm start
   ```
2. Open **`http://localhost:5173/pages/pills.html`** in your browser.

---

## 3. Test Cases

### TC-PILL-01: AI Cabinet Active Counter & Next Dose Time
- **Objective**: Verify that the top AI cabinet accurately counts active medications and determines the next dose.
- **Steps**:
  1. Open `pages/pills.html`.
  2. If no medications exist, note that "Active Medications" displays `0` and "Next Dose Today" displays `None Today`.
  3. Click **"+ Add Pill"** and create a reminder for `Multivitamins` at `08:00`.
- **Expected Results**:
  - [ ] Active Medications displays `1`.
  - [ ] Next Dose Today updates to `8:00 AM`.

---

### TC-PILL-02: Pediatric & Medicine Safety Tip Rotation
- **Objective**: Verify that clicking the "Safety Tip" button cycles pediatric medical tips.
- **Steps**:
  1. On `#aiCabinetCard`, locate the **"Safety Tip"** button (`#aiPillSafetyTipBtn`).
  2. Click it 2–3 times.
- **Expected Results**:
  - [ ] The icon spins with a micro-animation.
  - [ ] The tip text changes (e.g. using oral syringes, calculating doses by child's weight, avoiding calling medicine "candy").

---

### TC-PILL-03: 1-Tap Medication Presets
- **Objective**: Verify that clicking a preset chip opens the modal with pre-filled details.
- **Steps**:
  1. In the **Common Presets** row, click **"Kids Multivitamin"**.
- **Expected Results**:
  - [ ] The **Add Medication Reminder** modal opens automatically.
  - [ ] **Medication Name**: Auto-fills `Kids Daily Multivitamins`.
  - [ ] **Dosage**: Auto-fills `1 chewable tablet (with breakfast)`.
  - [ ] **Time**: Auto-fills `08:00`.
  - [ ] **Date**: Auto-fills with today's date.

---

### TC-PILL-04: Natural Language Multi-Dose Optimization
- **Objective**: Verify that typing instructions automatically splits and suggests daily intervals.
- **Steps**:
  1. Open `#addPillModal`.
  2. In the AI prompt input field (`#aiPillPromptInput`), type:
     `Amoxicillin 500mg 3x daily after meals`
  3. Click the green **Optimize** button (or hit <kbd>Enter</kbd>).
- **Expected Results**:
  - [ ] **Medication Name**: `Amoxicillin`.
  - [ ] **Dosage**: `500mg (after meals)`.
  - [ ] **Time**: Defaults to the first dose: `08:00`.
  - [ ] **Schedule Suggestion Chips**: A row of chips appears displaying:
    `[8:00 AM]`, `[1:00 PM]`, and `[7:00 PM]`.
  - [ ] Clicking any chip updates the Time input field immediately.

---

### TC-PILL-05: 1-Click "Schedule All Doses"
- **Objective**: Verify that all multi-dose reminders can be scheduled at once.
- **Steps**:
  1. Continuing from TC-PILL-04, click the green **"Schedule All 3 Doses"** button (`#btnAiScheduleAllDoses`).
- **Expected Results**:
  - [ ] Modal closes automatically.
  - [ ] Toast notification confirms: *"✨ AI scheduled all 3 doses for Amoxicillin!"*.
  - [ ] The medication list displays 3 reminders for today:
    - `Amoxicillin (Dose 1)` at `8:00 AM`
    - `Amoxicillin (Dose 2)` at `1:00 PM`
    - `Amoxicillin (Dose 3)` at `7:00 PM`

---

### TC-PILL-06: Auto-Refill Checkbox in Modal
- **Objective**: Verify that checking the refill box adds the medicine to the Grocery shopping list.
- **Steps**:
  1. Click **"+ Add Pill"**.
  2. Enter **Medication Name**: `Calcium + Vitamin D`
  3. Check the box: ☑ **Add to Grocery / Pharmacy list for refill**.
  4. Click **Save Reminder**.
  5. Navigate to **Grocery** (`pages/grocery.html`).
- **Expected Results**:
  - [ ] Toast confirms: *"Reminder saved & added to Grocery refill! 💊🛒"*.
  - [ ] In `grocery.html`, `Calcium + Vitamin D (Refill)` appears in the shopping list.

---

### TC-PILL-07: 1-Click Refill Button on Pill Cards
- **Objective**: Verify that clicking the green cart icon on any medication card adds it to Grocery.
- **Steps**:
  1. On `pages/pills.html`, look at any medication card in the list.
  2. Beside the edit and delete buttons, find the green **🛒 Refill** button (`.btn-pill-refill-icon`).
  3. Click the button.
- **Expected Results**:
  - [ ] Toast confirms: *"🛒 Added '[Medication]' to your Grocery list for refill!"*.
  - [ ] Checking `grocery.html` verifies that the medication was added with quantity `1`.

---

### TC-PILL-08: Automated Test Verification
- **Command**:
  ```sh
  npm test
  ```
- **Expected Results**:
  - [ ] All 126 unit and end-to-end integration tests pass with zero errors.
  - [ ] Test `'medication reminders are shared pill-category tasks with current date and preserved dosage'` passes without failure.
