# Test Plan: Emerging Tech AI Assistant — Grocery Recipe Sync

This document provides a comprehensive test plan for the **AI Cooking & Recipe-to-Grocery Auto-Sync Assistant** in ParenTech.

---

## 1. Feature Overview
The Grocery AI Assistant bridges family meal planning with grocery shopping. When a parent creates a task related to cooking (e.g., *"Cook Chicken Adobo for dinner"*), or enters a dish prompt into the Grocery section, the AI automatically extracts the required ingredients and adds them directly into the family's Grocery shopping list.

### Key Components
- **Auto-Sync from Task Creation**: Detects cooking intentions in task titles/descriptions (`aiDetectCookingDish`).
- **Grocery AI Prompt Bar**: Allows direct natural language dish entry on `grocery.html`.
- **1-Tap Quick Recipe Chips**: Preset family favorites (*Chicken Adobo*, *Sinigang*, *Spaghetti*, *Beef Bulalo*, *Fluffy Pancakes*, *Cheesy Omelet*).
- **Recent AI Detections Feed**: Real-time audit log of detected dishes, ingredients, and quantities added (`#aiRecentDetectionsList`).
- **Duplicate Prevention**: Prevents duplicate grocery items from cluttering the list.

---

## 2. Prerequisites
1. Start the local server:
   ```sh
   npm start
   ```
2. Open your browser at: **`http://localhost:5173`**
3. Log into your account (or use demo mode).

---

## 3. Test Cases

### TC-GROC-01: Auto-Sync from New Task Creation
- **Objective**: Verify that adding a cooking task automatically populates the Grocery list with ingredients.
- **Steps**:
  1. Navigate to **Tasks** (`pages/tasks.html`) or **Home** (`pages/home.html`).
  2. Click the floating **+ (Task)** button to open `#newTaskModal`.
  3. Enter:
     - **Title**: `Cook Chicken Adobo for dinner`
     - **Description**: `Prep ingredients around 5:30pm`
     - **Date**: Today's date
     - **Time**: `18:00`
     - **Category**: Household
  4. Click **Create Task**.
  5. Check the toast notification: It should read: *"✨ AI Assistant: Added 6 Adobo ingredients to your Grocery List!"*.
  6. Navigate to **Grocery** (`pages/grocery.html`).
- **Expected Results**:
  - [ ] Chicken Adobo ingredients appear in the grocery list (Chicken, Soy Sauce, Vinegar, Garlic, Black Peppercorns, Bay Leaves).
  - [ ] Under "Recent AI Cooking Detections", a new card displays "Chicken Adobo" with a "+6 added" pill.

---

### TC-GROC-02: Direct Prompt Input on Grocery Page
- **Objective**: Verify that typing a dish directly into the AI prompt bar on the Grocery page adds the ingredients.
- **Steps**:
  1. Navigate to **Grocery** (`pages/grocery.html`).
  2. Locate the purple **AI Recipe-to-Grocery Assistant** card at the top.
  3. In the input field (`#aiCookingDishInput`), type: `Sinigang na Baboy`
  4. Click the green **Auto-Add** button (or hit <kbd>Enter</kbd>).
- **Expected Results**:
  - [ ] Toast notification confirms: *"✨ AI Assistant: Added Sinigang ingredients to your Grocery List!"*.
  - [ ] Pork belly/ribs, Tamarind base, Kangkong, Radish, Tomatoes, Green chili appear on the grocery list.
  - [ ] The recent detections list increments its count.

---

### TC-GROC-03: 1-Tap Quick Recipe Chips
- **Objective**: Verify that tapping preset recipe chips adds ingredients instantly.
- **Steps**:
  1. On `pages/grocery.html`, locate the **Popular Family Dishes** chip row.
  2. Click the **Spaghetti** chip.
- **Expected Results**:
  - [ ] Toast displays confirmation of added ingredients.
  - [ ] Pasta noodles, ground meat, tomato sauce, and cheese appear on the list.
  - [ ] The grocery item counter updates accordingly.

---

### TC-GROC-04: Duplicate Ingredient Handling
- **Objective**: Verify that ingredients already present in the grocery list are not duplicated.
- **Steps**:
  1. Ensure `Garlic` is already on your Grocery list.
  2. Trigger another recipe that uses garlic (e.g., tap **Cheesy Omelet** or enter **Chicken Adobo** again).
- **Expected Results**:
  - [ ] The AI only adds missing ingredients.
  - [ ] If all ingredients are already present, the toast informs: *"✨ AI Assistant: All ingredients for [Dish] are already in your Grocery List!"*.
  - [ ] No duplicate grocery items are created.

---

### TC-GROC-05: Fallback for Custom / Unlisted Dishes
- **Objective**: Verify graceful AI fallback when a user enters an unlisted or custom dish.
- **Steps**:
  1. In the Grocery AI prompt bar, enter: `Cook Vegetable Stir Fry`
  2. Click **Auto-Add**.
- **Expected Results**:
  - [ ] The AI generates intelligent staple cooking ingredients (Main Protein/Base, Fresh Garlic & Onion, Cooking Oil / Butter, Seasonings & Spices).
  - [ ] All generated staples are added to the grocery list cleanly.

---

### TC-GROC-06: Dark Mode & Responsive Layout
- **Steps**:
  1. Click the moon/sun theme toggle button in the topbar.
  2. Resize browser window to mobile width (< 480px).
- **Expected Results**:
  - [ ] The AI Grocery Assistant card adopts dark slate/purple palette with glowing borders.
  - [ ] Recipe chips wrap neatly without horizontal scrollbar.
  - [ ] All buttons and input fields remain easily tappable on touch screens.
