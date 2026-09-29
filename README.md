# 📋 Backlog Kanban

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square)
![Tests](https://img.shields.io/badge/tests-node%3Atest-0e75b6?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

A **kanban board for team backlogs in a single HTML file**. No install, no build, no server, no dependencies. Download `index.html`, double-click it, and it works, even offline.

Built for the kind of team that needs a simple shared backlog without asking IT for a new tool. Data stays in your browser, exports to JSON/CSV, and can optionally sync with a SharePoint list.

## Features

- **Drag and drop** cards between columns, reorder within a column, or use the ‹ › buttons (keyboard and touch friendly)
- **Two views:** classic board, or **by owner** with one swimlane per person (drop a card into a lane to reassign it)
- **Filters:** free-text search (accent- and case-insensitive), owner, priority, label, overdue only, hide done
- **Live stats:** total, in progress, overdue, completion percentage
- **Task details:** description, owner, priority, due date with "Overdue 3d / Due tomorrow" hints, labels
- **Undo** for delete, import and bulk actions
- **Import / export** JSON, plus **CSV export** (opens in Excel; formula-injection safe)
- **Light and dark theme**, responsive layout, print stylesheet
- **Keyboard shortcuts:** `N` new task, `/` search, `Enter` opens a focused card
- **Optional SharePoint sync** (see below)

## Quick start

```bash
git clone https://github.com/horaguimaraes/backlog-kanban.git
cd backlog-kanban
open index.html        # or just double-click it
```

The first launch loads demo data. Use **Settings → Delete all tasks** to start fresh.

Prefer a URL? Enable **GitHub Pages** (Settings → Pages → deploy from `main`) and share the link.

## Where is my data?

In your browser's `localStorage`, on your device only. Clearing site data erases it, so use **Export** for backups or to move a board to another machine. If storage is blocked (private windows, some corporate policies) the board still works for the session.

## SharePoint sync (optional, experimental)

The board can push to and pull from a SharePoint list through the SharePoint REST API.

**1. Create a list** with these columns (all *single line of text* unless noted):

| Column | Type |
|:--|:--|
| `Title` | built in |
| `TaskId` | Single line of text |
| `Description` | Multiple lines of text (plain text) |
| `Owner`, `Priority`, `Labels`, `Status`, `DueDate` | Single line of text |
| `SortOrder` | Number |

**2. Open the board from the same SharePoint site** and fill in *Settings → site URL and list name*.

**3. Use Pull or Push.** Push shows what it will create, update and delete, and asks for confirmation first. Pull replaces local tasks (with undo).

Things to know:

- **Same origin only.** Browsers block cross-site requests, so the page must be served from the SharePoint host itself. Modern SharePoint Online often blocks running custom HTML in document libraries; this works best where custom script is allowed (for example SharePoint Server, or sites where an admin enabled it).
- **Push mirrors local to remote**, including deletions. It is not a merge. Two people pushing different boards will overwrite each other.
- **Honest status:** the diffing (`planPush`), URL building and field mapping are unit-tested. The network calls have not been verified against a live tenant, which is why this is marked experimental.

## How it is built

Everything is one file, split in two blocks so the logic can be tested without a browser:

| Block | Role |
|:--|:--|
| `<script id="core">` | Pure functions: normalize/validate tasks, filter, move/reorder, stats, CSV, SharePoint diffing. No DOM access. |
| `<script>` (UI) | Rendering, drag and drop, dialogs, persistence, SharePoint requests |

Decisions worth calling out:

- **Text is never injected as HTML.** The UI builds nodes with `textContent`, so a task titled `<img onerror=…>` is just text.
- **Imports are treated as untrusted.** Every task is re-validated and coerced (bad dates, unknown statuses, duplicate ids), so a broken or hand-edited file can't corrupt the board.
- **Moves are immutable.** `moveTask` returns a new array, which makes undo a one-liner.
- **Ordering is the array order.** No fragile position numbers to re-index.

## Tests

The tests load the `core` block straight out of `index.html` and run on Node's built-in test runner, so there is nothing to install.

```bash
npm test
```

CI runs them on every push and pull request.

## License

MIT © Lucas Hora
