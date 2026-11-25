# ParenTech — Emerging Tech AI Assistants Master Test Suite

This master test suite documents all emerging technology AI assistants implemented across the ParenTech family organizer platform.

---

## 📑 Test Plans Directory

| No. | Feature Name | Target Page(s) | Documentation & Test Plan |
|---|---|---|---|
| **0** | **AI Cooking & Recipe-to-Grocery Auto-Sync** | `grocery.html`, `tasks.html` | [TEST_AI_GROCERY_ASSISTANT.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_GROCERY_ASSISTANT.md) |
| **1** | **AI Natural Task Quick-Fill & Step Breakdown** | `#newTaskModal` (all pages) | [TEST_AI_TASK_ASSISTANT.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_TASK_ASSISTANT.md) |
| **2** | **AI Daily Family Briefing & 1-Click Smart Routines** | `home.html` | [TEST_AI_HOME_DASHBOARD.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_HOME_DASHBOARD.md) |
| **3** | **AI Smart Dose Scheduler & Refill-to-Grocery Sync** | `pills.html`, `#addPillModal` | [TEST_AI_PILL_REMINDERS.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_PILL_REMINDERS.md) |
| **4** | **AI Calendar View Assistant** | `calendar.html`, `#aiWeekendModal` | [TEST_AI_CALENDAR_ASSISTANT.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_CALENDAR_ASSISTANT.md) |
| **5** | **ParenAI Universal Topbar Search & Command Bar** | All App Pages (`.topbar-search`) | [TEST_AI_TOPBAR_COPILOT.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_TOPBAR_COPILOT.md) |

---

## 🚀 Quick Start for Testing

### 1. Launch the Application Server
Run the local Node.js server from the workspace root:
```sh
npm start
```
Open **[http://localhost:5173](http://localhost:5173)** in Google Chrome, Microsoft Edge, or Firefox.

### 2. Run Automated Regression Suite
Execute the automated test suite to verify that all 126 backend, domain, UI, and integration tests pass:
```sh
npm test
```
To run static syntax verification:
```sh
npm run check
```

---

## 🧪 Summary of AI Features Implemented

### 1. Grocery Section (`grocery.html`)
- **Problem Solved**: Parents often plan meals but forget to write down every individual cooking ingredient.
- **AI Solution**: Whenever a cooking task is created (e.g. *"Cook Chicken Adobo for dinner"*), the AI assistant automatically detects the dish and populates the Grocery shopping list with fresh ingredients.
- **Details**: [TEST_AI_GROCERY_ASSISTANT.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_GROCERY_ASSISTANT.md)

### 2. Tasks & New Task Modal (`tasks.html`)
- **Problem Solved**: Creating tasks on mobile or desktop with multiple pickers (Date, Time, Category) takes too many taps, and large chores feel overwhelming.
- **AI Solution**: Parents can type conversational natural language (*"Lucas dentist next Tuesday at 10am"*), and the AI auto-fills the title, calculates the date, sets the time, and auto-selects the category. The **AI Steps** button splits complex tasks into actionable checklists.
- **Details**: [TEST_AI_TASK_ASSISTANT.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_TASK_ASSISTANT.md)

### 3. Home Dashboard (`home.html`)
- **Problem Solved**: Busy parents need a clear, reassuring daily overview when they open the app in the morning.
- **AI Solution**: The **AI Daily Family Briefing** synthesizes the day's commitments, highlights the earliest task, provides evidence-based parenting advice, and offers 1-click **Smart Routines** (*Plan Dinner*, *Movie Night*, *15-Min Tidy-up*, *Bedtime Story*).
- **Details**: [TEST_AI_HOME_DASHBOARD.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_HOME_DASHBOARD.md)

### 4. Pill & Medication Reminders (`pills.html`)
- **Problem Solved**: Family prescriptions have tricky multi-dose frequencies, and running out of essential medicine creates stressful emergencies.
- **AI Solution**: Translates instructions like *"Amoxicillin 500mg 3x daily after meals"* into optimal intervals (`8:00 AM`, `1:00 PM`, `7:00 PM`), provides 1-tap pediatric presets, and offers an **Auto-Refill to Grocery** sync to keep the medicine cabinet stocked.
- **Details**: [TEST_AI_PILL_REMINDERS.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_PILL_REMINDERS.md)

### 5. Calendar View & Family Schedule (`calendar.html`)
- **Problem Solved**: Juggling school, chores, work, and kids' activities leads to accidental double-booking, overpacked days, and parent burnout.
- **AI Solution**: **ParenAI Calendar** monitors monthly workload, detects time slot conflicts on the same day, issues high-load burnout warnings ($\ge 4$ tasks), provides 1-click **Quick Family Ideas**, and features a 1-click **AI Weekend Family Activity Planner** that computes upcoming weekend dates, schedules curated 2-day itineraries, and auto-syncs cooking ingredients to Grocery.
- **Details**: [TEST_AI_CALENDAR_ASSISTANT.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_CALENDAR_ASSISTANT.md)

### 6. ParenAI Universal Topbar Search & Command Bar (All App Pages)
- **Problem Solved**: Having to navigate back and forth between Grocery, Tasks, Pills, and Calendar just to add an item, schedule a quick call, or check tomorrow's schedule wastes precious time.
- **AI Solution**: Turns the persistent topbar search bar (`#topbarSearchInput`, <kbd>Ctrl+K</kbd>) into **Ask ParenAI**, a universal command bar that adds groceries (*"Add milk and 2 eggs to grocery"*), schedules tasks (*"Remind me to call grandma at 4pm"*), schedules pill doses (*"Amoxicillin 500mg 3x daily"*), answers schedule questions (*"What are my tasks for tomorrow?"*), and performs live global search across pages.
- **Details**: [TEST_AI_TOPBAR_COPILOT.md](file:///c:/Users/Daniela%20Ann/Desktop/ParenTech/TEST_AI_TOPBAR_COPILOT.md)

---

## ✅ Master Verification Checklist

- [ ] **Grocery AI**: Chicken Adobo, Sinigang, and Spaghetti auto-sync ingredients cleanly.
- [ ] **Task AI**: Natural language relative dates (today, tomorrow, next week) and times parse properly.
- [ ] **Task AI**: AI Step Breakdown generates realistic checklists without errors.
- [ ] **Modal UI**: New Task Modal fits in standard laptop displays without vertical overflow or scrollbars.
- [ ] **Home AI**: Greeting, task prioritization, and rotating parenting tips render properly.
- [ ] **Home AI**: 1-Click "Plan Dinner" schedules dinner and syncs ingredients into Grocery.
- [ ] **Pill AI**: 1-Tap Presets (Multivitamin, Vitamin C, etc.) pre-fill the medication modal.
- [ ] **Pill AI**: Multi-dose schedules (3x daily) suggest 8am, 1pm, 7pm intervals and can be scheduled at once.
- [ ] **Pill AI**: Refill button on medication cards adds the medicine to Grocery with one click.
- [ ] **Calendar AI**: Detects same-time clashes and raises `⚠️ Time Conflict Alert`.
- [ ] **Calendar AI**: Warns when $\ge 4$ commitments cause high workload with `⚠️ Busy Day Alert`.
- [ ] **Calendar AI**: 1-Click "Plan Weekend" creates 4 balanced family events across Saturday/Sunday and auto-syncs recipe items to Grocery.
- [ ] **Calendar AI**: Quick Idea chips (Park Walk, Study Hour, Family Dinner, Quick Chores) add events directly to the selected date.
- [ ] **ParenAI Topbar**: `Ctrl+K` / focus opens **Ask ParenAI** dropdown from any page with starter prompt chips.
- [ ] **ParenAI Topbar**: Natural commands (*"Add milk and 2 eggs to grocery"*, *"Remind me to call grandma at 4pm"*, *"Amoxicillin 500mg 3x daily"*) preview and execute on `Enter`.
- [ ] **ParenAI Topbar**: Conversational questions (*"What are my tasks for today?"*, *"Any schedule conflicts?"*) display live in-dropdown answers.
- [ ] **Automated Tests**: `npm test` passes all automated tests with zero regressions.
