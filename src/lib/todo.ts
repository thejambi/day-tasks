/**
 * todo.txt parsing and line building, following the format spec:
 *   [x ][COMPLETION-DATE ][(P) ][CREATION-DATE ]body with +projects @contexts key:values
 *
 * Deliberate spec alignments over the original DayTasks:
 * - Completing a prioritized task preserves the priority as pri:X
 *   metadata (todo.txt-cli convention) instead of destroying it.
 * - Tasks can be un-completed, restoring the preserved priority.
 * - New tasks get a creation date (optional, on by default).
 * - due:YYYY-MM-DD is parsed for display and overdue highlighting.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface Task {
	/** Line index in todo.txt — the task's stable identity. */
	line: number;
	raw: string;
	complete: boolean;
	completionDate: string | null;
	priority: string | null; // "A".."Z"
	creationDate: string | null;
	body: string;
	projects: string[];
	contexts: string[];
	due: string | null;
}

export function todayStr(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function eatDate(rest: string): { date: string | null; rest: string } {
	const first = rest.split(" ", 1)[0];
	if (DATE_RE.test(first)) {
		return { date: first, rest: rest.slice(first.length).replace(/^ /, "") };
	}
	return { date: null, rest };
}

export function parseTask(raw: string, line: number): Task {
	let rest = raw;
	let complete = false;
	let completionDate: string | null = null;
	let priority: string | null = null;
	let creationDate: string | null = null;

	if (rest.startsWith("x ")) {
		complete = true;
		rest = rest.slice(2);
		({ date: completionDate, rest } = eatDate(rest));
	}
	const pm = /^\(([A-Z])\) /.exec(rest);
	if (pm) {
		priority = pm[1];
		rest = rest.slice(4);
	}
	({ date: creationDate, rest } = eatDate(rest));

	const projects = [...rest.matchAll(/(?:^|\s)\+(\S+)/g)].map((m) => m[1]);
	const contexts = [...rest.matchAll(/(?:^|\s)@(\S+)/g)].map((m) => m[1]);
	const due = /(?:^|\s)due:(\d{4}-\d{2}-\d{2})(?=\s|$)/.exec(rest)?.[1] ?? null;

	return { line, raw, complete, completionDate, priority, creationDate, body: rest, projects, contexts, due };
}

/** Build a new task line from user input (which may itself use full syntax). */
export function buildNewTask(text: string, addCreationDate: boolean): string {
	let t = text.trim();
	if (!addCreationDate) return t;
	const pm = /^\(([A-Z])\) /.exec(t);
	if (pm) {
		const after = t.slice(4);
		if (DATE_RE.test(after.split(" ", 1)[0])) return t; // already dated
		return t.slice(0, 4) + todayStr() + " " + after;
	}
	if (DATE_RE.test(t.split(" ", 1)[0])) return t;
	return todayStr() + " " + t;
}

/** Mark complete: x + completion date, priority preserved as pri:X. */
export function buildComplete(task: Task): string {
	if (task.complete) return task.raw;
	let rest = task.raw;
	let priTag = "";
	const pm = /^\(([A-Z])\) /.exec(rest);
	if (pm) {
		rest = rest.slice(4);
		priTag = ` pri:${pm[1]}`;
	}
	return `x ${todayStr()} ${rest}${priTag}`;
}

/** Un-complete: drop x + completion date, restore any preserved pri:X. */
export function buildUncomplete(task: Task): string {
	if (!task.complete) return task.raw;
	let rest = task.raw.slice(2);
	({ rest } = eatDate(rest));
	const priMatch = /(?:^|\s)pri:([A-Z])(?=\s|$)/.exec(rest);
	if (priMatch) {
		rest = rest.replace(/( ?)\bpri:[A-Z](?=\s|$)/, "").trim();
		rest = `(${priMatch[1]}) ${rest}`;
	}
	return rest;
}

/** Set (or clear, with null) the priority of an incomplete task. */
export function buildSetPriority(task: Task, p: string | null): string {
	if (task.complete) return task.raw;
	let rest = task.raw;
	if (/^\([A-Z]\) /.test(rest)) rest = rest.slice(4);
	return p ? `(${p}) ${rest}` : rest;
}

/** Priority-first display ordering; ties keep file order. Completed last. */
export function displaySort(tasks: Task[]): Task[] {
	return [...tasks].sort((a, b) => {
		if (a.complete !== b.complete) return a.complete ? 1 : -1;
		const pa = a.priority ?? "~";
		const pb = b.priority ?? "~";
		if (pa !== pb) return pa < pb ? -1 : 1;
		return a.line - b.line;
	});
}

export function isOverdue(task: Task): boolean {
	return !task.complete && task.due !== null && task.due < todayStr();
}
