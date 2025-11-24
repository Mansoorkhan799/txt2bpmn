<!-- 2a0ceec3-8923-4abc-b5db-14dd466b4d00 03aed577-14aa-45ef-892c-99155767fe36 -->
# Decision Engine Implementation Plan

## Overview

Build a full-featured Decision Engine that combines visual rule building with Excel-like spreadsheet functionality, supporting complex conditions, formulas, file import/export, and BPMN process integration.

## Architecture

### 1. Database Model (models/DecisionRule.ts)

Create MongoDB schema for decision rules with support for:

- Multiple conditions with AND/OR logic operators
- Priority handling for rule precedence
- Visual and formula-based rule definitions
- Status management (active/inactive)
- Version tracking
- BPMN process associations

### 2. API Endpoints

#### a) Decision Rules CRUD (app/api/decision/rules/route.ts)

- GET: Fetch all rules for current user
- POST: Create new decision rule
- PUT: Update existing rule
- DELETE: Delete rule

#### b) Rule Execution (app/api/decision/execute/route.ts)

- POST: Execute rules against data rows
- Support priority-based evaluation
- Return matched rules and final actions

#### c) File Import/Export (app/api/decision/import/route.ts & export/route.ts)

- Import Excel/CSV files into data grid
- Export results to Excel/CSV
- Parse and validate uploaded files using xlsx library

#### d) BPMN Integration (app/api/decision/trigger-workflow/route.ts)

- Trigger BPMN processes based on rule outcomes
- Pass decision results as process variables

### 3. Main Component (app/components/DecisionEngine.tsx)

#### UI Sections:

1. **Header with Actions**

   - Create New Rule button
   - Import/Export buttons
   - Search and filter

2. **Rule Builder Panel** (collapsible)

   - Visual builder: dropdowns for fields, operators, values
   - Formula editor: Monaco-based code editor
   - AND/OR logic builder
   - Priority slider
   - Action definition
   - Save/Cancel buttons

3. **Excel-like Data Grid**

   - Editable spreadsheet interface
   - Column headers with types
   - Row operations (add, delete, duplicate)
   - Cell editing with validation
   - Formula support in cells
   - Color-coded results (pass/fail)

4. **Rules List Sidebar**

   - Display all saved rules
   - Quick enable/disable toggle
   - Edit/Delete actions
   - Drag to reorder priority

5. **Execution Results Panel**

   - Show matched rules per row
   - Final action determination
   - Export results button
   - Trigger workflow button

#### Key Features:

- Real-time rule evaluation as data changes
- Undo/redo functionality
- Auto-save drafts
- Responsive design with gradient styling

### 4. UI Integration

#### a) SideMenu.tsx Update

Add Decision Engine menu item:

- Position: After AI Process Generator
- Icon: HiOutlineCube (GPU chip icon)
- Gradient styling: greenish theme (from-green-500 via-emerald-500 to-teal-500)
- Accessible to all user roles

#### b) page.tsx Update

Add route handling for 'decision-engine' view

### 5. Type Definitions (app/types/index.ts)

Add interfaces for:

- DecisionRule
- RuleCondition
- RuleAction
- DataGridCell
- ExecutionResult

## Technical Implementation Details

### Excel/CSV Import (using xlsx library)

```typescript
import * as XLSX from 'xlsx';

const readFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      resolve(jsonData);
    };
    reader.readAsBinaryString(file);
  });
};
```

### Rule Evaluation Engine

- Parse conditions left-to-right with AND/OR precedence
- Support operators: ==, !=, >, <, >=, <=, contains, startsWith, endsWith
- Formula evaluation using safe eval or expression parser
- Priority-based conflict resolution

### Data Grid Implementation

Use HTML table with contentEditable cells or integrate react-datasheet-grid for:

- Cell selection and editing
- Keyboard navigation (arrow keys, tab)
- Copy/paste support
- Column type definitions
- Validation rules

### BPMN Integration

- Fetch available BPMN processes from existing API
- Map decision outcomes to process start events
- Pass rule results as process variables
- Track workflow execution status

## Styling Requirements

### Gradient Theme (Greenish)

```css
/* Menu item active */
bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600

/* Menu item hover */
from-green-500 via-emerald-500 to-teal-500

/* Accent elements */
from-green-500/70 via-emerald-500/70 to-teal-500/70
```

### Component Layout

- Use Tailwind CSS for styling
- Card-based sections with shadows
- Hover effects and transitions
- Responsive grid layout
- Toast notifications for user feedback

## File Structure

```
app/
├── components/
│   └── DecisionEngine.tsx (1000+ lines)
├── api/
│   └── decision/
│       ├── rules/route.ts
│       ├── execute/route.ts
│       ├── import/route.ts
│       ├── export/route.ts
│       └── trigger-workflow/route.ts
├── types/
│   └── index.ts (add decision types)
models/
└── DecisionRule.ts
```

## Dependencies Already Available

- xlsx (for Excel processing)
- uuid (for ID generation)
- react-hot-toast (for notifications)
- Monaco Editor (for formula editor)
- MongoDB/Mongoose (for data persistence)

## Testing Scenarios

1. Create simple IF-THEN rule and test
2. Import Excel file with sample data
3. Create complex rule with AND/OR conditions
4. Test priority conflict resolution
5. Export results to CSV
6. Trigger BPMN workflow from decision outcome

### To-dos

- [ ] Create DecisionRule MongoDB model with support for conditions, actions, priority, and BPMN associations
- [ ] Add TypeScript interfaces for DecisionRule, RuleCondition, ExecutionResult, and DataGridCell
- [ ] Build CRUD API endpoints for decision rules at /api/decision/rules
- [ ] Build rule execution API at /api/decision/execute with priority handling
- [ ] Build import/export APIs for Excel/CSV file handling
- [ ] Build BPMN workflow trigger API at /api/decision/trigger-workflow
- [ ] Create DecisionEngine.tsx with header, rule builder, data grid, and results sections
- [ ] Implement visual rule builder with dropdowns and formula editor using Monaco
- [ ] Create Excel-like data grid with editable cells, formulas, and validation
- [ ] Build rule evaluation engine with AND/OR logic and priority handling
- [ ] Add file import/export functionality using xlsx library
- [ ] Implement BPMN workflow triggering from decision results
- [ ] Add Decision Engine menu item to SideMenu.tsx with GPU icon and greenish gradient
- [ ] Add decision-engine view handling in page.tsx
- [ ] Apply greenish gradient theme and responsive styling to Decision Engine