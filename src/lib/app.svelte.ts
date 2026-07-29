/**
 * Shared application state (Svelte 5 rune module) for DayTasks:
 * the loaded todo.txt, task mutations (every action saves immediately
 * and atomically), folders, filtering, and archiving to done.txt.
 */
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { exists, readTextFile, watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Menu, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

import { pathJoin } from "./paths";
import { initSettings, persist, DEFAULT_FONT_SIZE, type Settings } from "./settings";
import {
	parseTask,
	buildNewTask,
	buildComplete,
	buildUncomplete,
	buildSetPriority,
	type Task,
} from "./todo";

export const isMac = typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");
export const isWindows = typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");
export const modKeyLabel = isMac ? "⌘" : "Ctrl+";

export const app = $state({
	settings: {
		folders: [],
		lastDir: null,
		fontSize: DEFAULT_FONT_SIZE,
		showCompleted: true,
		autoCreationDate: true,
		paneWidth: 220,
		theme: "system",
	} as Settings,
	ready: false,
	todoDir: null as string | null,
	tasks: [] as Task[],
	filterText: "",
	projectFilter: null as string | null,
	contextFilter: null as string | null,
	selectedLine: null as number | null,
	editingLine: null as number | null,
	openMenuShown: false,
	settingsMenuShown: false,
	modal: null as "shortcuts" | "about" | null,
	toast: "",
});

let unwatch: UnwatchFn | null = null;
let lastSavedText: string | null = null;

export const refs = {
	filterInput: null as HTMLInputElement | null,
	addInput: null as HTMLInputElement | null,
};

export function focusFilter(): void {
	refs.filterInput?.focus();
	refs.filterInput?.select();
}

export function focusAdd(): void {
	refs.addInput?.focus();
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function showToast(msg: string): void {
	app.toast = msg;
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (app.toast = ""), 4000);
}

function todoPath(): string {
	return pathJoin(app.todoDir ?? "", "todo.txt");
}

function donePath(): string {
	return pathJoin(app.todoDir ?? "", "done.txt");
}

// --- Loading & saving (file order is preserved; sorting is display-only) ---

function parseFile(text: string): Task[] {
	return text
		.split("\n")
		.map((raw, i) => ({ raw, i }))
		.filter(({ raw }) => raw.trim() !== "")
		.map(({ raw, i }) => parseTask(raw, i));
}

async function loadTasks(): Promise<void> {
	if (!app.todoDir) return;
	let text = "";
	try {
		if (await exists(todoPath())) text = await readTextFile(todoPath());
	} catch (e) {
		console.error("could not read todo.txt", e);
	}
	lastSavedText = text;
	app.tasks = parseFile(text);
}

/** Persist the given raw lines (in file order) and refresh state. */
async function saveLines(lines: string[]): Promise<void> {
	if (!app.todoDir) return;
	const text = lines.length > 0 ? lines.join("\n") + "\n" : "";
	lastSavedText = text;
	try {
		await invoke("save_note", { path: todoPath(), contents: text });
	} catch (e) {
		console.error("save failed", e);
		showToast("Could not save todo.txt");
		return;
	}
	app.tasks = parseFile(text);
}

function currentLines(): string[] {
	return app.tasks.map((t) => t.raw);
}

// --- Task mutations (each saves immediately) ---

function replaceLine(line: number, newRaw: string | null): string[] {
	const lines: string[] = [];
	for (const t of app.tasks) {
		if (t.line === line) {
			if (newRaw !== null && newRaw.trim() !== "") lines.push(newRaw);
		} else {
			lines.push(t.raw);
		}
	}
	return lines;
}

export async function addTask(text: string): Promise<void> {
	const raw = buildNewTask(text, app.settings.autoCreationDate);
	if (raw === "") return;
	await saveLines([...currentLines(), raw]);
}

export async function toggleComplete(line: number): Promise<void> {
	const t = app.tasks.find((t) => t.line === line);
	if (!t) return;
	await saveLines(replaceLine(line, t.complete ? buildUncomplete(t) : buildComplete(t)));
}

export async function setPriority(line: number, p: string | null): Promise<void> {
	const t = app.tasks.find((t) => t.line === line);
	if (!t || t.complete) return;
	await saveLines(replaceLine(line, buildSetPriority(t, p)));
}

export async function deleteTask(line: number): Promise<void> {
	if (app.selectedLine === line) app.selectedLine = null;
	await saveLines(replaceLine(line, null));
}

export async function editTask(line: number, newRaw: string): Promise<void> {
	app.editingLine = null;
	await saveLines(replaceLine(line, newRaw));
}

/** Move completed tasks to done.txt (appended), spec-style. */
export async function archiveCompleted(): Promise<void> {
	if (!app.todoDir) return;
	const done = app.tasks.filter((t) => t.complete);
	if (done.length === 0) {
		showToast("No completed tasks to archive");
		return;
	}
	let existing = "";
	try {
		if (await exists(donePath())) existing = await readTextFile(donePath());
	} catch {
		// treat unreadable as empty; the append below recreates it
	}
	if (existing !== "" && !existing.endsWith("\n")) existing += "\n";
	try {
		await invoke("save_note", { path: donePath(), contents: existing + done.map((t) => t.raw).join("\n") + "\n" });
	} catch (e) {
		console.error("archive failed", e);
		showToast("Could not write done.txt");
		return;
	}
	await saveLines(app.tasks.filter((t) => !t.complete).map((t) => t.raw));
	showToast(`Archived ${done.length} ${done.length === 1 ? "task" : "tasks"} to done.txt`);
}

// --- Folders (multiple todo.txt directories, like notebooks) ---

export async function setTodoDir(dir: string): Promise<void> {
	app.todoDir = dir;
	if (!app.settings.folders.includes(dir)) {
		app.settings.folders = [...app.settings.folders, dir];
		persist("folders", $state.snapshot(app.settings.folders));
	}
	app.settings.lastDir = dir;
	persist("lastDir", dir);
	app.filterText = "";
	app.projectFilter = null;
	app.contextFilter = null;
	app.selectedLine = null;
	app.editingLine = null;
	await loadTasks();
	await watchDir(dir);
}

export async function chooseFolder(): Promise<void> {
	closeMenus();
	const dir = await openFolderDialog({ directory: true, title: "Choose Todo Folder" });
	if (typeof dir === "string" && dir) {
		await setTodoDir(dir);
	}
}

export function forgetCurrentFolder(): void {
	closeMenus();
	if (!app.todoDir) return;
	app.settings.folders = app.settings.folders.filter((f) => f !== app.todoDir);
	persist("folders", $state.snapshot(app.settings.folders));
}

export function revealFolder(): void {
	closeMenus();
	if (app.todoDir) void revealItemInDir(todoPath());
}

// --- External changes (Dropbox, other todo.txt apps) ---

async function watchDir(dir: string): Promise<void> {
	if (unwatch) {
		unwatch();
		unwatch = null;
	}
	try {
		unwatch = await watch(dir, () => void onExternalChange(), { delayMs: 600 });
	} catch (e) {
		console.error("could not watch folder", e);
	}
}

async function onExternalChange(): Promise<void> {
	if (!app.todoDir) return;
	try {
		const text = (await exists(todoPath())) ? await readTextFile(todoPath()) : "";
		if (text !== lastSavedText) {
			lastSavedText = text;
			app.tasks = parseFile(text);
			app.editingLine = null;
		}
	} catch (e) {
		console.error("reload failed", e);
	}
}

// --- Context menu ---

export async function showTaskContextMenu(task: Task): Promise<void> {
	const prioItem = (p: string) => ({
		id: `pri-${p}`,
		text: `Priority (${p})`,
		action: () => void setPriority(task.line, p),
	});
	const menu = await Menu.new({
		items: [
			{
				id: "complete",
				text: task.complete ? "Mark Incomplete" : "Complete",
				action: () => void toggleComplete(task.line),
			},
			{ id: "edit", text: "Edit", action: () => (app.editingLine = task.line) },
			await PredefinedMenuItem.new({ item: "Separator" }),
			prioItem("A"),
			prioItem("B"),
			prioItem("C"),
			{ id: "pri-none", text: "Clear Priority", action: () => void setPriority(task.line, null) },
			await PredefinedMenuItem.new({ item: "Separator" }),
			{ id: "delete", text: "Delete", action: () => void deleteTask(task.line) },
		],
	});
	await menu.popup();
}

export async function showEditContextMenu(): Promise<void> {
	const items = await Promise.all([
		PredefinedMenuItem.new({ item: "Cut" }),
		PredefinedMenuItem.new({ item: "Copy" }),
		PredefinedMenuItem.new({ item: "Paste" }),
		PredefinedMenuItem.new({ item: "Separator" }),
		PredefinedMenuItem.new({ item: "SelectAll" }),
	]);
	const menu = await Menu.new({ items });
	await menu.popup();
}

// --- Menus, fonts ---

export function bumpFont(delta: number): void {
	const size = app.settings.fontSize + delta;
	if (size < 8 || size > 42) return;
	app.settings.fontSize = size;
	persist("fontSize", size);
}

export function closeMenus(): void {
	app.openMenuShown = false;
	app.settingsMenuShown = false;
}

// --- Startup / teardown ---

export function initApp(): () => void {
	let unlistenClose: (() => void) | undefined;
	let unlistenExit: (() => void) | undefined;

	void (async () => {
		app.settings = { ...app.settings, ...(await initSettings()) };

		if (app.settings.lastDir && (await exists(app.settings.lastDir))) {
			app.todoDir = app.settings.lastDir;
			await loadTasks();
			await watchDir(app.todoDir);
		}
		app.ready = true;

		const appWindow = getCurrentWindow();
		unlistenClose = await appWindow.onCloseRequested(() => {
			// every action saves immediately; nothing to flush
		});

		unlistenExit = await listen("app-exit-requested", async () => {
			await invoke("really_quit");
		});
	})();

	return () => {
		unlistenClose?.();
		unlistenExit?.();
		if (unwatch) unwatch();
	};
}
