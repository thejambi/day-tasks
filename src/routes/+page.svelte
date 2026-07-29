<script lang="ts">
	import { onMount } from "svelte";
	import Toolbar from "$lib/components/Toolbar.svelte";
	import Sidebar from "$lib/components/Sidebar.svelte";
	import TaskList from "$lib/components/TaskList.svelte";
	import Overlays from "$lib/components/Overlays.svelte";
	import { persist } from "$lib/settings";
	import {
		app,
		isMac,
		initApp,
		chooseFolder,
		archiveCompleted,
		focusAdd,
		focusFilter,
		cancelEditing,
		closeMenus,
		bumpFont,
		showEditContextMenu,
		showTaskContextMenu,
	} from "$lib/app.svelte";

	onMount(() => initApp());

	// Apply the theme choice; "system" defers to prefers-color-scheme
	$effect(() => {
		if (app.settings.theme === "system") {
			delete document.documentElement.dataset.theme;
		} else {
			document.documentElement.dataset.theme = app.settings.theme;
		}
	});

	function onWindowMousedown(e: MouseEvent): void {
		const el = e.target as Element | null;
		if (!el?.closest(".menu-wrap")) closeMenus();
	}

	function onContextMenu(e: MouseEvent): void {
		e.preventDefault();
		const el = e.target as Element | null;
		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
			void showEditContextMenu();
			return;
		}
		const row = el?.closest(".task-row") as HTMLElement | null;
		if (row?.dataset.line) {
			const line = parseInt(row.dataset.line, 10);
			const task = app.tasks.find((t) => t.line === line);
			if (task) {
				app.selectedLine = line;
				void showTaskContextMenu(task);
			}
		}
	}

	function onKeydown(e: KeyboardEvent): void {
		const modKey = isMac ? e.metaKey : e.ctrlKey;
		const key = e.key.toLowerCase();

		if (e.key === "Escape") {
			if (app.modal) app.modal = null;
			else if (app.openMenuShown || app.settingsMenuShown) closeMenus();
			else if (app.editingLine !== null) cancelEditing();
			else if (document.activeElement === refsFilter()) {
				if (app.filterText !== "") app.filterText = "";
				else (document.activeElement as HTMLElement)?.blur();
			} else if (document.activeElement instanceof HTMLInputElement) {
				document.activeElement.blur();
			} else {
				focusFilter();
			}
			e.preventDefault();
			return;
		}

		if (!modKey || e.shiftKey || e.altKey) return;

		switch (key) {
			case "n":
				e.preventDefault();
				focusAdd();
				break;
			case "f":
				e.preventDefault();
				focusFilter();
				break;
			case "o":
				e.preventDefault();
				void chooseFolder();
				break;
			case "e":
				e.preventDefault();
				void archiveCompleted();
				break;
			case "=":
			case "+":
				e.preventDefault();
				bumpFont(1);
				break;
			case "-":
				e.preventDefault();
				bumpFont(-1);
				break;
		}
	}

	import { refs } from "$lib/app.svelte";
	function refsFilter(): HTMLInputElement | null {
		return refs.filterInput;
	}

	// --- Pane divider drag ---
	function startPaneDrag(e: MouseEvent): void {
		e.preventDefault();
		const onMove = (ev: MouseEvent) => {
			app.settings.paneWidth = Math.min(400, Math.max(160, ev.clientX));
		};
		const onUp = () => {
			persist("paneWidth", app.settings.paneWidth);
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	}
</script>

<svelte:window onkeydown={onKeydown} onmousedown={onWindowMousedown} oncontextmenu={onContextMenu} />

<main class="app">
	<Toolbar />

	<div class="body">
		<Sidebar />
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="divider" role="separator" aria-orientation="vertical" onmousedown={startPaneDrag}></div>
		<TaskList />
	</div>

	<Overlays />
</main>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}
	.body {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.divider {
		flex: none;
		width: 7px;
		margin-left: -4px;
		cursor: col-resize;
		z-index: 10;
	}
</style>
