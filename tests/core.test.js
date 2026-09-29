const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('./load-core');

const task = (over = {}) => Core.normalizeTask({ title: 'T', ...over });
const ids = (list) => list.map((t) => t.id);

test('normalizeTask fills defaults and coerces invalid values', () => {
  const t = Core.normalizeTask({ title: '  Hello  ', priority: 'nope', status: 'nope', due: '2024-13-40', labels: 'a, b ,a' });
  assert.equal(t.title, 'Hello');
  assert.equal(t.priority, 'medium');
  assert.equal(t.status, 'backlog');
  assert.equal(t.due, '');
  assert.deepEqual(t.labels, ['a', 'b']);
  assert.ok(t.id);
});

test('normalizeTask survives garbage input', () => {
  for (const bad of [null, undefined, 42, 'x', []]) {
    assert.equal(Core.normalizeTask(bad).title, 'Untitled');
  }
});

test('isValidDate rejects impossible dates', () => {
  assert.equal(Core.isValidDate('2024-02-29'), true);
  assert.equal(Core.isValidDate('2023-02-29'), false);
  assert.equal(Core.isValidDate('2024-2-1'), false);
});

test('importTasks accepts array or {tasks} and de-duplicates ids', () => {
  const a = Core.importTasks([{ id: 'x', title: 'one' }, { id: 'x', title: 'two' }]);
  assert.equal(a.length, 2);
  assert.notEqual(a[0].id, a[1].id);
  assert.equal(Core.importTasks({ tasks: [{ title: 'k' }] }).length, 1);
  assert.throws(() => Core.importTasks({ nope: true }), /list of tasks/);
});

test('filterTasks: text search ignores case and accents, all words must match', () => {
  const list = [task({ title: 'Relatório de Vendas', owner: 'Ana' }), task({ title: 'Vendas Q3', owner: 'Bruno' })];
  assert.equal(Core.filterTasks(list, { query: 'relatorio' }).length, 1);
  assert.equal(Core.filterTasks(list, { query: 'vendas bruno' }).length, 1);
  assert.equal(Core.filterTasks(list, { query: 'inexistente' }).length, 0);
});

test('filterTasks: owner, unassigned, priority, label, hideDone, overdue', () => {
  const today = '2024-06-10';
  const list = [
    task({ owner: 'Ana', priority: 'high', labels: 'Bug' }),
    task({ owner: '', priority: 'low', status: 'done' }),
    task({ owner: 'Bruno', due: '2024-06-01', status: 'todo' }),
  ];
  assert.equal(Core.filterTasks(list, { owner: 'Ana' }).length, 1);
  assert.equal(Core.filterTasks(list, { owner: Core.UNASSIGNED }).length, 1);
  assert.equal(Core.filterTasks(list, { priority: 'high' }).length, 1);
  assert.equal(Core.filterTasks(list, { label: 'bug' }).length, 1);
  assert.equal(Core.filterTasks(list, { hideDone: true }).length, 2);
  assert.equal(Core.filterTasks(list, { overdueOnly: true, today }).length, 1);
});

test('isOverdue ignores done tasks and tasks without due date', () => {
  assert.equal(Core.isOverdue(task({ due: '2024-01-01' }), '2024-06-10'), true);
  assert.equal(Core.isOverdue(task({ due: '2024-01-01', status: 'done' }), '2024-06-10'), false);
  assert.equal(Core.isOverdue(task(), '2024-06-10'), false);
  assert.equal(Core.isOverdue(task({ due: '2024-06-10' }), '2024-06-10'), false);
});

test('dueLabel', () => {
  const t = (due, status) => task({ due, status });
  assert.equal(Core.dueLabel(t('2024-06-08'), '2024-06-10'), 'Overdue 2d');
  assert.equal(Core.dueLabel(t('2024-06-10'), '2024-06-10'), 'Due today');
  assert.equal(Core.dueLabel(t('2024-06-11'), '2024-06-10'), 'Due tomorrow');
  assert.equal(Core.dueLabel(t('2024-06-13'), '2024-06-10'), 'Due in 3d');
  assert.equal(Core.dueLabel(t('2024-09-01'), '2024-06-10'), '2024-09-01');
  assert.equal(Core.dueLabel(t('2024-06-01', 'done'), '2024-06-10'), '2024-06-01');
  assert.equal(Core.dueLabel(t(''), '2024-06-10'), '');
});

test('moveTask changes status and appends to the end of the target column', () => {
  const a = task({ status: 'todo' }), b = task({ status: 'doing' }), c = task({ status: 'doing' });
  const out = Core.moveTask([a, b, c], a.id, { status: 'doing' });
  assert.deepEqual(ids(out.filter((t) => t.status === 'doing')), [b.id, c.id, a.id]);
});

test('moveTask inserts before a given card', () => {
  const a = task({ status: 'todo' }), b = task({ status: 'doing' }), c = task({ status: 'doing' });
  const out = Core.moveTask([a, b, c], a.id, { status: 'doing', beforeId: c.id });
  assert.deepEqual(ids(out.filter((t) => t.status === 'doing')), [b.id, a.id, c.id]);
});

test('moveTask can reorder within a column and does not mutate input', () => {
  const a = task({ status: 'todo' }), b = task({ status: 'todo' }), c = task({ status: 'todo' });
  const input = [a, b, c];
  const out = Core.moveTask(input, c.id, { status: 'todo', beforeId: a.id });
  assert.deepEqual(ids(out), [c.id, a.id, b.id]);
  assert.deepEqual(ids(input), [a.id, b.id, c.id]);
});

test('moveTask can reassign owner (swimlane drop) and ignores unknown ids', () => {
  const a = task({ owner: 'Ana' });
  assert.equal(Core.moveTask([a], a.id, { status: 'todo', owner: 'Bruno' })[0].owner, 'Bruno');
  assert.equal(Core.moveTask([a], a.id, { status: 'todo' })[0].owner, 'Ana');
  const list = [a];
  assert.equal(Core.moveTask(list, 'missing', { status: 'done' }), list);
});

test('moveTask dropping a card before itself keeps it in place', () => {
  const a = task({ status: 'todo' }), b = task({ status: 'todo' });
  assert.deepEqual(ids(Core.moveTask([a, b], a.id, { status: 'todo', beforeId: a.id })), ids([a, b]));
});

test('shiftStatus steps between columns and stops at the edges', () => {
  const a = task({ status: 'backlog' });
  assert.equal(Core.shiftStatus([a], a.id, 1)[0].status, 'todo');
  assert.equal(Core.shiftStatus([a], a.id, -1)[0].status, 'backlog');
  const d = task({ status: 'done' });
  assert.equal(Core.shiftStatus([d], d.id, 1)[0].status, 'done');
});

test('groupByStatus always returns every column', () => {
  const g = Core.groupByStatus([task({ status: 'done' })]);
  assert.deepEqual(Object.keys(g), Core.COLUMNS.map((c) => c.id));
  assert.equal(g.done.length, 1);
  assert.equal(g.todo.length, 0);
});

test('computeStats', () => {
  const list = [task({ status: 'done' }), task({ status: 'doing' }), task({ status: 'todo', due: '2020-01-01' }), task({ status: 'backlog' })];
  assert.deepEqual(Core.computeStats(list, '2024-01-01'), { total: 4, done: 1, inProgress: 1, overdue: 1, completion: 25 });
  assert.equal(Core.computeStats([]).completion, 0);
});

test('owners and labels are unique and sorted', () => {
  const list = [task({ owner: 'Bruno', labels: 'x, Y' }), task({ owner: 'Ana', labels: 'y' }), task({ owner: 'Ana' })];
  assert.deepEqual(Core.owners(list), ['Ana', 'Bruno']);
  assert.deepEqual(Core.allLabels(list), ['x', 'Y']);
});

test('initials', () => {
  assert.equal(Core.initials('Ana Souza'), 'AS');
  assert.equal(Core.initials('maria de lima'), 'ML');
  assert.equal(Core.initials('Bruno'), 'B');
  assert.equal(Core.initials(''), '?');
});

test('toCSV quotes fields and neutralises formula injection', () => {
  const csv = Core.toCSV([task({ title: 'He said "hi", ok', description: '=SUM(A1)', labels: 'a, b' })]);
  const [header, row] = csv.split('\r\n');
  assert.equal(header, 'Title,Status,Priority,Owner,Due,Labels,Description');
  assert.match(row, /^"He said ""hi"", ok",Backlog,medium,,,a; b,'=SUM\(A1\)$/);
});

test('spUrls builds list endpoints and escapes quotes in list names', () => {
  const u = Core.spUrls({ siteUrl: 'https://x.sharepoint.com/sites/team/', listName: "Bob's list" });
  assert.ok(u.items.startsWith("https://x.sharepoint.com/sites/team/_api/web/lists/getbytitle('Bob''s%20list')/items"));
  assert.equal(u.digest, 'https://x.sharepoint.com/sites/team/_api/contextinfo');
});

test('planPush creates, updates and removes', () => {
  const a = task({ id: 'a', title: 'A' }), b = task({ id: 'b', title: 'B changed' }), c = task({ id: 'c' });
  const remote = [
    { Id: 1, ...Core.spPayload(a, 0) },
    { Id: 2, ...Core.spPayload({ ...b, title: 'B' }, 1) },
    { Id: 3, ...Core.spPayload(task({ id: 'gone' }), 2) },
  ];
  const plan = Core.planPush([a, b, c], remote);
  assert.deepEqual(plan.update.map((u) => u.spId), [2]);
  assert.equal(plan.create.length, 1);
  assert.equal(plan.create[0].TaskId, 'c');
  assert.deepEqual(plan.remove, [3]);
});

test('planPush is a no-op when both sides match', () => {
  const list = [task({ id: 'a' }), task({ id: 'b' })];
  const remote = list.map((t, i) => ({ Id: i + 1, ...Core.spPayload(t, i) }));
  assert.deepEqual(Core.planPush(list, remote), { create: [], update: [], remove: [] });
});

test('planPush detects a reorder through SortOrder', () => {
  const [a, b] = [task({ id: 'a' }), task({ id: 'b' })];
  const remote = [{ Id: 1, ...Core.spPayload(a, 0) }, { Id: 2, ...Core.spPayload(b, 1) }];
  const plan = Core.planPush([b, a], remote);
  assert.equal(plan.update.length, 2);
});

test('taskFromSp round-trips through spPayload', () => {
  const original = task({ id: 'r1', title: 'Round', owner: 'Ana', priority: 'high', status: 'doing', labels: 'x, y', due: '2024-05-05', description: 'd' });
  const back = Core.taskFromSp({ Id: 9, ...Core.spPayload(original, 0) });
  for (const k of ['id', 'title', 'owner', 'priority', 'status', 'due', 'description']) assert.equal(back[k], original[k]);
  assert.deepEqual(back.labels, original.labels);
});

test('SEED produces valid, varied demo data', () => {
  const seed = Core.SEED();
  assert.ok(seed.length >= 8);
  assert.ok(new Set(seed.map((t) => t.status)).size === Core.COLUMNS.length);
  assert.ok(seed.some((t) => Core.isOverdue(t)));
});
