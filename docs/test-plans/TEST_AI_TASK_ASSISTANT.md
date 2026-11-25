# Test Plan: Emerging Tech AI Assistant No. 1 — Task Quick-Fill & Subtasks

This document provides a comprehensive test plan for **AI Assistant Feature No. 1: Natural Language Task Quick-Fill & Step Breakdown** in ParenTech.

---

## 1. Feature Overview
Located within the universal **New Task / Reminder Modal** (`#newTaskModal`), this assistant helps parents quickly add tasks without manually fiddling with dropdowns, calendar pickers, and time selectors. Additionally, an AI Step Breakdown tool splits overwhelming parenting chores into clean, actionable checklists.

### Key Components
- **Natural Language Parser (`aiParseNaturalTask`)**: Extracts title, dates (e.g. *today*, *tomorrow*, *next Tuesday*), times (e.g. *10am*, *2:30pm*), and categories.
- **Smart Category Predictor (`aiPredictCategory`)**: Identifies whether a task belongs to **Personal**, **Family**, **Household**, or **Pill Reminder**.
- **AI Step Breakdown Generator (`aiGenerateSubtasks`)**: Splits tasks (e.g. *Birthday Party*, *Enrollment*, *Deep Clean*, *Doctor Visit*) into bulleted action steps.
- **Optimized Modal Layout**: Compact padding and margins ensuring the modal fits on standard screens without overflow.

---

## 2. Prerequisites
1. Start the server:
   ```sh
   npm start
   ```
2. Open **`http://localhost:5173`** and navigate to **Tasks** (`pages/tasks.html`) or **Home** (`pages/home.html`).

---

## 3. Test Cases

### TC-TASK-01: Natural Language Parsing with Relative Date & Time
- **Objective**: Verify that typing conversational English auto-populates title, date, time, and category.
- **Steps**:
  1. Click the floating **+ (Task)** button to open `#newTaskModal`.
  2. Locate the purple **AI Quick-Fill** banner at the top.
  3. Type: `Lucas dentist next Tuesday at 10am`
  4. Click the green **Fill** button (or hit <kbd>Enter</kbd>).
- **Expected Results**:
  - [ ] **Task Title**: Auto-fills with `Lucas dentist`.
  - [ ] **Date**: Auto-fills with the upcoming Tuesday's date (`YYYY-MM-DD`).
  - [ ] **Time**: Auto-fills with `10:00`.
  - [ ] **Category**: The **Family** category icon is highlighted/selected.
  - [ ] Toast notification confirms: *"✨ AI Auto-Filled task details!"*.

---

### TC-TASK-02: Household Chore Parsing with Evening Time
- **Objective**: Verify that household tasks and 12-hour/24-hour time notations parse correctly.
- **Steps**:
  1. Open `#newTaskModal`.
  2. In the AI Quick-Fill field, type: `Clean kitchen counters and refrigerator tonight at 8pm`
  3. Click **Fill**.
- **Expected Results**:
  - [ ] **Task Title**: Auto-fills with `Clean kitchen counters and refrigerator`.
  - [ ] **Date**: Auto-fills with today's date.
  - [ ] **Time**: Auto-fills with `20:00`.
  - [ ] **Category**: The **Household** category icon is highlighted.

---

### TC-TASK-03: AI Step Breakdown for Complex Tasks
- **Objective**: Verify that the "AI Steps" button splits complex tasks into structured action checklists.
- **Steps**:
  1. Open `#newTaskModal`.
  2. In **Task Title**, enter: `Organize Lucas 7th Birthday Party`
  3. Beside the "Task Description" label, click the purple **AI Steps** button (`#aiSubtasksBtn`).
- **Expected Results**:
  - [ ] **Task Description** textarea populates with an actionable step-by-step checklist:
    ```markdown
    📋 Action Steps:
    [ ] Set date, budget & guest list
    [ ] Book venue / prepare home & send invitations
    [ ] Order birthday cake, food & party favors
    [ ] Plan games, activities & music playlist
    [ ] Confirm RSVPs & finalize party schedule
    ```
  - [ ] Toast confirms: *"✨ AI generated action steps!"*.

---

### TC-TASK-04: AI Step Breakdown for Appointments & Doctor Visits
- **Steps**:
  1. In **Task Title**, enter: `Annual Pediatric Checkup for Kids`
  2. Click **AI Steps**.
- **Expected Results**:
  - [ ] Checklist generates steps specific to healthcare visits:
    - Verifying appointment schedule & clinic location
    - Gathering immunization records & health cards
    - Listing questions & observations for the doctor
    - Attending appointment & recording notes

---

### TC-TASK-05: Modal Viewport Height & Scrollbar Verification
- **Objective**: Ensure the New Task modal does not overflow or display chunky default scrollbars.
- **Steps**:
  1. Open `#newTaskModal` on a laptop or desktop screen (1080p or 768p).
  2. Inspect the right edge of the modal dialog box.
- **Expected Results**:
  - [ ] The entire modal fits comfortably within the viewport (`max-height: 90vh`).
  - [ ] The bottom **"Create Task"** button is fully visible without needing to scroll down.
  - [ ] If the browser window is resized to be very short, the scrollbar appears as a slim, 5px rounded purple pill matching the theme, with no native Windows scrollbar arrows.
