# Test Plan: Emerging Tech AI Assistant No. 4 — AI Calendar View Assistant

This document provides a comprehensive test plan for **AI Assistant Feature No. 4: AI Schedule Health Monitor, Conflict Detection, and Weekend Family Planner** on the Calendar page (`calendar.html`).

---

## 1. Feature Overview
The **AI Calendar View Assistant** serves as an intelligent family schedule coordinator. It analyzes monthly workloads, prevents parental burnout, detects conflicting time slots, offers research-backed time management tips, and generates 1-click curated weekend family itineraries with automatic ingredient sync to the Grocery section.

### Key Components
- **ParenAI Calendar Card (`#aiCalendarCard`)**:
  - **Dynamic Schedule Health Badge (`#aiCalendarHealthBadge`)**:
    - `✨ Balanced Schedule` (green): Evenly spaced events without clashes.
    - `⚠️ Busy Day Alert (N tasks)` (yellow/amber): Triggered when any day in the month has 4 or more scheduled commitments.
    - `⚠️ Time Conflict Alert` (red): Triggered whenever two or more active tasks share the exact same date and time.
  - **Schedule Metrics Row**:
    - **Month Total (`#aiMonthEventsCount`)**: Total tasks scheduled in the currently displayed month.
    - **Busiest Day (`#aiBusiestDayLabel`)**: Identifies which day has the highest task count.
    - **Selected Day Pace (`#aiSelectedDayPill`)**: Displays pace for the clicked calendar date (`Free Day`, `1-2 Light`, `3 Moderate`, `4+ Heavy`).
  - **Contextual AI Advice Box (`#aiCalendarAdviceBox` / `#aiCalendarAdviceText`)**: Offers tailored pacing recommendations or warning details highlighting the conflicting tasks.
  - **Parent Time Tips (`#aiCalendarTipBtn`)**: Rotating parenting and time management advice.
  - **Quick Family Idea Chips (`.ai-calendar-idea-chip`)**:
    - `🌳 Park Walk` (16:30, Family category)
    - `📚 Study Hour` (17:00, Family category)
    - `🍕 Family Dinner` (18:30, Family category)
    - `🧹 Quick Chores` (10:00, Household category)
- **AI Weekend Family Planner Modal (`#aiWeekendModal`)**:
  - Automatically calculates the exact dates for the upcoming Saturday and Sunday.
  - Offers 3 curated 2-day itineraries:
    1. **🏞️ Outdoor Nature & Park Adventure**: Outdoor games, bike rides, scavenger hunt, dinner treat.
    2. **🎨 Cozy Home Baking & Movie (Budget-Friendly)**: Homemade pizza baking, board games, blanket fort, family movie night.
    3. **🏛️ Discovery, Science & Library Day**: Library story hour, science crafts, watercolor art, school prep.
  - **1-Click Scheduling (`.btn-schedule-weekend-plan`)**: Creates all 4 balanced weekend events at once. If any activity involves cooking or baking (e.g. Homemade Pizza), required ingredients automatically populate into the Grocery list.

---

## 2. Prerequisites
1. Start the server:
   ```sh
   npm start
   ```
2. Open **`http://localhost:5173/pages/calendar.html`** in your browser.

---

## 3. Test Cases

### TC-CAL-01: AI Calendar Metrics & Balanced Health Badge
- **Objective**: Verify that the AI card accurately aggregates monthly events and shows a balanced schedule badge when no conflicts exist.
- **Steps**:
  1. Open `pages/calendar.html`.
  2. Observe the **ParenAI Calendar** card beneath the calendar grid.
  3. Verify the **Month Events** counter reflects total active tasks for the current month.
  4. Click on any date on the calendar (e.g. tomorrow).
- **Expected Results**:
  - [ ] Schedule Health Badge displays `✨ Balanced Schedule`.
  - [ ] Contextual advice indicates: *"✨ Balanced Schedule! Your family commitments are evenly paced this month."*
  - [ ] "Selected Day" updates dynamically to reflect the load of the clicked date (e.g. `Free Day` or `1 (Light)`).

---

### TC-CAL-02: AI Time Conflict Detection Alert
- **Objective**: Verify that the AI detects overlapping tasks on the same day and time, and displays a prominent conflict warning.
- **Steps**:
  1. Click **"+ Add Event"** (or use the New Task Modal).
  2. Create Task 1: *"Pediatrician Appointment"*, Date: Today, Time: `14:00`, Category: `family`.
  3. Create Task 2: *"Work Team Sync"*, Date: Today, Time: `14:00`, Category: `personal`.
  4. Observe `#aiCalendarCard`.
- **Expected Results**:
  - [ ] Schedule Health Badge turns red with: `⚠️ Time Conflict Alert`.
  - [ ] Advice Box turns red and explicitly warns:
    *"⚠️ Schedule Clash on [Date]: 'Pediatrician Appointment' and 'Work Team Sync' are both set for 2:00 PM. Consider moving one!"*
  - [ ] Editing or rescheduling one of the tasks removes the conflict alert and restores balanced status.

---

### TC-CAL-03: AI Heavy Load & Burnout Prevention Alert
- **Objective**: Verify that the AI detects days with $\ge 4$ commitments and issues a busy day alert.
- **Steps**:
  1. Pick a specific date (e.g. Friday).
  2. Add 4 different tasks for that date at different hours (e.g. `09:00`, `11:00`, `15:00`, `18:00`).
  3. Observe `#aiCalendarCard`.
- **Expected Results**:
  - [ ] Schedule Health Badge displays: `⚠️ Busy Day Alert`.
  - [ ] "Busiest Day" metric displays the date along with `(4 tasks)`.
  - [ ] Advice Box turns amber with warning:
    *"⚠️ Heavy Load on [Date]: You have 4 commitments scheduled. Spreading chores across the week helps avoid parental burnout!"*

---

### TC-CAL-04: Rotating Parent Time Management Tips
- **Objective**: Verify that clicking the "Parent Time Tip" button cycles actionable family scheduling advice.
- **Steps**:
  1. Click the **"Tip"** button (`#aiCalendarTipBtn`) with the lightbulb icon in the top right of `#aiCalendarCard`.
  2. Click it 2–3 times.
- **Expected Results**:
  - [ ] The lightbulb icon performs a smooth spin animation.
  - [ ] The advice box displays helpful tips (e.g. grouping errands geographically, keeping a zero-schedule downtime night, adding 15-minute buffers).

---

### TC-CAL-05: 1-Click Quick Family Idea Chips
- **Objective**: Verify that clicking any Quick Idea chip adds the event to the currently selected calendar date.
- **Steps**:
  1. Click on a specific day in the calendar grid (e.g. this Sunday).
  2. In the **Quick Family Ideas** row on `#aiCalendarCard`, click **"🌳 Park Walk"**.
- **Expected Results**:
  - [ ] A success toast appears: *"Added 'Afternoon Family Park Walk' on [Selected Date]! ✨"*.
  - [ ] The task appears in the **Tasks for [Date]** sidebar list at `4:30 PM`.
  - [ ] The calendar date cell receives the purple event dot (`.has-event`).

---

### TC-CAL-06: 1-Click AI Weekend Family Activity Planner & Grocery Auto-Sync
- **Objective**: Verify that the Weekend Family Planner opens, computes upcoming weekend dates, and schedules 4 activities with recipe ingredient synchronization.
- **Steps**:
  1. On `#aiCalendarCard`, click the purple **"✨ Plan Weekend"** button (`#aiPlanWeekendBtn`).
  2. Verify that the modal header displays the upcoming Saturday and Sunday dates.
  3. Review the 3 curated itineraries.
  4. On **"🎨 Cozy Home Baking & Movie"**, click **"Schedule"** (`.btn-schedule-weekend-plan`).
- **Expected Results**:
  - [ ] The modal closes and a toast notification confirms:
    *"🎉 Scheduled '🎨 Cozy Home Baking & Movie (Budget-Friendly)' for this weekend!"*.
  - [ ] 2 events are scheduled on Saturday (`10:00 AM Homemade Pizza Baking`, `2:30 PM Board Games`).
  - [ ] 2 events are scheduled on Sunday (`10:30 AM Blanket Fort`, `5:00 PM Movie Night`).
  - [ ] Navigate to `pages/grocery.html`.
  - [ ] Notice that pizza baking ingredients (e.g., *Pizza Dough*, *Tomato Sauce*, *Mozzarella Cheese*, *Olive Oil*) were automatically added to the Grocery shopping list via AI recipe detection!

---

### TC-CAL-07: Full Year Calendar View & Dark Theme Verification
- **Objective**: Verify that the AI assistant remains consistent when toggling between standard and full-year views, and scales cleanly in dark mode.
- **Steps**:
  1. In `pages/calendar.html`, click **"View All Months"** (`#calendarViewAllBtn`).
  2. Confirm the 12-month full calendar renders properly below the AI card.
  3. Toggle theme between light, dark, and system modes.
- **Expected Results**:
  - [ ] All AI card containers, badges, advice boxes, and modal cards render with high-contrast text and theme-appropriate backgrounds.
  - [ ] No layout breaks or horizontal scrollbars.

---

## 4. Regression & Verification Command
To verify that all unit, domain, validation, API, and UI tests remain passing:
```sh
npm test
```
To verify static JavaScript syntax:
```sh
npm run check
```
