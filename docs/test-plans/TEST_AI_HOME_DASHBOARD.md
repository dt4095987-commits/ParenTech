# Test Plan: Emerging Tech AI Assistant No. 2 — Home Dashboard Family Briefing

This document provides a comprehensive test plan for **AI Assistant Feature No. 2: AI Daily Family Briefing & Smart Routine Suggestions** on the ParenTech Home Dashboard (`home.html`).

---

## 1. Feature Overview
The **AI Daily Family Briefing** welcomes parents at the top of the Home Dashboard with intelligent, context-aware morning, afternoon, or evening insights. It summarizes today's priorities, suggests the earliest task to begin with, highlights medication reminders, and offers 1-click **Smart Routine Suggestions** tailored for parents.

### Key Components
- **Contextual Greeting & Schedule Synthesis (`renderAIBriefing`)**:
  - Salutation adapts to time of day (*Good morning*, *Good afternoon*, *Good evening*).
  - Addresses the parent by role or name (*Dad*, *Mom*, *Solo Parent*).
  - Calculates pending tasks, prioritizes the earliest commitment by time, and flags medication reminders.
- **Celebratory Zero-State**: Encourages family relaxation when all tasks for the day are checked off.
- **Rotating Parenting & Wellness Tips (`#aiBriefingTipBox`)**: Evidence-based family tips with interactive refresh animation.
- **1-Click Smart Routine Quick Chips (`executeSmartRoutine`)**:
  - 🍳 *Plan Dinner*: Automatically schedules *"Cook Dinner: Chicken Adobo"* at 6:30 PM, which auto-syncs ingredients to the Grocery list!
  - 🎬 *Family Movie Night*: Schedules family time at 7:30 PM.
  - 🧹 *15-Min Tidy-up*: Schedules quick evening tidy-up at 8:00 PM.
  - 📖 *Bedtime Story*: Schedules reading routine at 8:30 PM.
  - 🛒 *Restock Essentials*: Direct shortcut to the Grocery list.

---

## 2. Prerequisites
1. Start the server:
   ```sh
   npm start
   ```
2. Open **`http://localhost:5173/pages/home.html`** in your browser.

---

## 3. Test Cases

### TC-HOME-01: Contextual Greeting & Earliest Task Priority
- **Objective**: Verify that the briefing card dynamically reflects today's pending schedule.
- **Steps**:
  1. Ensure you have 2 or more tasks scheduled for today (e.g. `Lucas Dentist` at `09:00` and `Grocery Run` at `15:00`).
  2. Navigate to **Home** (`pages/home.html`).
  3. Look at the purple **AI Family Briefing** card (`#aiBriefingCard`).
- **Expected Results**:
  - [ ] The greeting matches your time of day and role (e.g., *"Good morning, Dad! ☀️"*).
  - [ ] Text indicates: *"You have 2 tasks scheduled for today. AI recommends starting with 'Lucas Dentist' at 9:00 AM."*.
  - [ ] If one of the tasks is a Pill reminder, an alert note appears: *"💊 Remember to check your scheduled medication."*.

---

### TC-HOME-02: Celebratory All-Tasks-Completed State
- **Objective**: Verify the briefing adapts when all today's tasks are completed.
- **Steps**:
  1. On `pages/home.html`, scroll down to "Today's Tasks".
  2. Click the square checkbox for every task scheduled for today to mark them complete.
  3. Scroll back up to the AI Family Briefing banner.
- **Expected Results**:
  - [ ] The briefing card text updates dynamically:
    *"Great job — all X tasks for today are completed! Enjoy quality family time, or tap a smart routine below to get ahead."*.

---

### TC-HOME-03: Rotating Parenting Tips ("Fresh Tip" Button)
- **Objective**: Verify that the tip button rotates evidence-based family advice.
- **Steps**:
  1. On `#aiBriefingCard`, locate the **"Fresh Tip"** button in the header (`#aiRefreshBriefingBtn`).
  2. Click the button multiple times.
- **Expected Results**:
  - [ ] The refresh icon spins smoothly on click.
  - [ ] The tip text (`#aiBriefingTipText`) cycles through various tips (uninterrupted 1-on-1 time, prepping clothes the night before, mindfulness breaths, bedtime lighting).

---

### TC-HOME-04: 1-Click "Plan Dinner" Routine & Grocery Sync
- **Objective**: Verify that clicking the "Plan Dinner" chip adds the task and triggers the AI Grocery sync.
- **Steps**:
  1. In the **Quick Smart Routines** chip row, click **"Plan Dinner"**.
  2. Check the toast notification.
  3. Look at "Today's Tasks" on the dashboard.
  4. Navigate to **Grocery** (`pages/grocery.html`).
- **Expected Results**:
  - [ ] Toast notification confirms: *"Added 'Cook Dinner: Chicken Adobo' — ingredients synced to Grocery! ✨"*.
  - [ ] "Cook Dinner: Chicken Adobo" appears under Today's Tasks at 6:30 PM.
  - [ ] Navigating to Grocery confirms that chicken, soy sauce, vinegar, garlic, peppercorns, and bay leaves are added to the grocery list.

---

### TC-HOME-05: 1-Click "Family Movie Night" & Duplicate Prevention
- **Steps**:
  1. On `pages/home.html`, click **"Family Movie Night"**.
  2. Check "Today's Tasks": "Family Movie Night" is added at 7:30 PM.
  3. Click **"Family Movie Night"** a second time.
- **Expected Results**:
  - [ ] First click adds the event with a toast confirmation.
  - [ ] Second click alerts: *"'Family Movie Night' is already scheduled for today!"*, preventing duplicates.

---

### TC-HOME-06: Dark Theme & Mobile Viewport
- **Steps**:
  1. Toggle dark mode using the moon icon in the topbar.
  2. Switch to a mobile viewport (< 500px width).
- **Expected Results**:
  - [ ] AI Briefing card adopts dark-theme slate background with violet borders.
  - [ ] Routine chips wrap neatly into multiple rows without overflowing.
