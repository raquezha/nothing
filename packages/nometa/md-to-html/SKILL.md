---
name: md-to-html
description: Compile markdown planning/status files into interactive, premium HTML dashboard interfaces. Use when the user requests updating or generating an interactive HTML dashboard from a structured plan markdown file (such as PLAN.md).
---

# MD to HTML Plan Compiler

This skill handles translating structured markdown planning documents (like `PLAN.md`) into high-fidelity, interactive HTML dashboards (like `migration_plan.html`).

## Purpose
Keeps plan documentation and interactive dashboards perfectly in sync without manual layout rewriting, ensuring that decision updates, checklist tasks, and progress metrics are compiled accurately.

## When to Use
Use when:
- The user requests to sync `PLAN.md` updates to the interactive HTML dashboard (`migration_plan.html`).
- A new task or phase is added/removed in the markdown checklist.
- The structure of phases, tasks, or code blueprints changes.

## Workflow

### 1. Extract Plan Metadata & Checklists
1. Read the target plan markdown file (e.g., [PLAN.md](file:///Users/raquezha/RQZ/personal/pi.dev/PLAN.md)).
2. Parse the Checklist items by phase:
   - Identify phase headers (e.g., `### Phase N: ...`).
   - Identify task IDs or create sequential IDs (e.g., `p1-1` for Phase 1 Task 1, `p3-5` for Phase 3 Task 5).
   - Extract checkbox state (`[x]` = completed / `true`, `[ ]` = pending / `false`).
   - Extract task title, short description, and details block.

### 2. Compile HTML Checklist Markup
For each checklist item, format it into the interactive `task-item` container template:
```html
<div class="task-item" id="task-p[X]-[Y]">
  <div class="task-checkbox" onclick="toggleTask('p[X]-[Y]'); event.stopPropagation();"></div>
  <div class="task-content" onclick="toggleDetails('p[X]-[Y]')">
    <div class="task-text">Task Title</div>
    <div class="task-desc">Short description of the task.</div>
    <div class="task-details">
      <p>Extra technical details, code command blocks, or links.</p>
    </div>
  </div>
</div>
```

### 3. Update JavaScript Data Structures
Locate the `<script>` block at the bottom of the HTML file and update:
1. **The Tasks Map (`tasks`)**: Assign `true` for completed items (`[x]`) and `false` for pending items (`[ ]`).
   ```javascript
   const tasks = {
     'p1-1': true,
     ...
     'p3-5': false
   };
   ```
2. **The Group Totals (`groupTotals`)**: Update the total number of tasks in each phase:
   ```javascript
   const groupTotals = { p1: 5, p2: 4, p3: 5, p4: 3, p5: 3 };
   ```

### 4. Code Blueprint Sync
If there are file blueprints (e.g., `### 6.1. Cross-Platform bootstrap.sh`) in the markdown file:
- Ensure they are parsed and updated in the tab content sections of the HTML dashboard.
- Keep tabs and copy buttons functional.

## Design Rules & Aesthetics
- **No Browser Defaults**: Rely on curated font families (e.g., `Outfit`, `Source Code Pro`).
- **Gradients & Glows**: Use subtle dark-theme radial gradients, borders with opacity transitions, and accent glow states.
- **Glassmorphism**: Use backdrop filters for overlay panels and widgets to feel premium.

## Validation Steps
1. Open the HTML file or inspect the generated markup.
2. Confirm there are no duplicate IDs or missing functions.
3. Validate that the JavaScript tasks list count and totals exactly match the DOM list.
