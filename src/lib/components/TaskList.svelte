<script lang="ts">
	import {
		app,
		refs,
		isMac,
		addTask,
		toggleComplete,
		editTask,
		deleteTask,
		setPriority,
		showTaskContextMenu,
	} from "$lib/app.svelte";
	import { displaySort, isOverdue, type Task } from "$lib/todo";

	let addText = $state("");
	let editText = $state("");

	const visible = $derived.by(() => {
		const q = app.filterText.trim().toLowerCase();
		let tasks = app.tasks;
		if (!app.settings.showCompleted) tasks = tasks.filter((t) => !t.complete);
		if (app.projectFilter) tasks = tasks.filter((t) => t.projects.includes(app.projectFilter!));
		if (app.contextFilter) tasks = tasks.filter((t) => t.contexts.includes(app.contextFilter!));
		if (q) tasks = tasks.filter((t) => t.raw.toLowerCase().includes(q));
		return displaySort(tasks);
	});

	// Body tokens for styled rendering: +project, @context, key:value, text
	function tokens(body: string): { kind: string; text: string }[] {
		return body.split(/(\s+)/).map((part) => {
			if (/^\+\S+$/.test(part)) return { kind: "project", text: part };
			if (/^@\S+$/.test(part)) return { kind: "context", text: part };
			if (/^due:\d{4}-\d{2}-\d{2}$/.test(part)) return { kind: "due", text: part };
			if (/^[A-Za-z]+:\S+$/.test(part) && !/^https?:/.test(part)) return { kind: "meta", text: part };
			return { kind: "text", text: part };
		});
	}

	function startEdit(t: Task): void {
		editText = t.raw;
		app.editingLine = t.line;
	}

	function submitAdd(): void {
		const text = addText.trim();
		if (text === "") return;
		addText = "";
		void addTask(text);
	}

	function selectedTask(): Task | null {
		return visible.find((t) => t.line === app.selectedLine) ?? null;
	}

	function moveSelection(delta: number): void {
		if (visible.length === 0) return;
		const idx = visible.findIndex((t) => t.line === app.selectedLine);
		const next = idx === -1 ? (delta > 0 ? 0 : visible.length - 1) : Math.min(visible.length - 1, Math.max(0, idx + delta));
		app.selectedLine = visible[next].line;
		document.querySelector(`[data-line="${visible[next].line}"]`)?.scrollIntoView({ block: "nearest" });
	}

	function onListKeydown(e: KeyboardEvent): void {
		const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
		const mod = isMac ? e.metaKey : e.ctrlKey;

		// Mod+1..9 priority, Mod+0 clear (original DayTasks keys)
		if (mod && !e.shiftKey && !e.altKey && !inInput && e.key >= "0" && e.key <= "9") {
			const sel = selectedTask();
			if (!sel) return;
			e.preventDefault();
			if (e.key === "0") void setPriority(sel.line, null);
			else void setPriority(sel.line, String.fromCharCode(64 + parseInt(e.key, 10)));
			return;
		}
		if (mod && e.key === "Backspace" && !inInput) {
			const sel = selectedTask();
			if (sel) {
				e.preventDefault();
				void deleteTask(sel.line);
			}
			return;
		}
		if (inInput || mod || app.modal !== null) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				moveSelection(1);
				break;
			case "ArrowUp":
				e.preventDefault();
				moveSelection(-1);
				break;
			case " ": {
				const sel = selectedTask();
				if (sel) {
					e.preventDefault();
					void toggleComplete(sel.line);
				}
				break;
			}
			case "Enter": {
				const sel = selectedTask();
				if (sel) {
					e.preventDefault();
					startEdit(sel);
				}
				break;
			}
			case "Delete": {
				const sel = selectedTask();
				if (sel) {
					e.preventDefault();
					void deleteTask(sel.line);
				}
				break;
			}
		}
	}
</script>

<svelte:window onkeydown={onListKeydown} />

<div class="main" style="font-size: {app.settings.fontSize}px">
	<div class="add-row">
		<input
			class="add-input"
			placeholder="Add a task…  e.g. (A) Call Mom +family @phone due:2026-08-01"
			bind:this={refs.addInput}
			bind:value={addText}
			onkeydown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					submitAdd();
				}
			}}
		/>
	</div>
	<div class="task-list">
		{#each visible as t (t.line)}
			{#if app.editingLine === t.line}
				<div class="task-row editing">
					<input
						class="edit-input"
						bind:value={editText}
						onkeydown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								void editTask(t.line, editText);
							} else if (e.key === "Escape") {
								e.stopPropagation();
								app.editingLine = null;
							}
						}}
						onblur={() => (app.editingLine = null)}
						{@attach (el) => el.focus()}
					/>
				</div>
			{:else}
				<div
					class="task-row"
					class:selected={app.selectedLine === t.line}
					class:done={t.complete}
					role="button"
					tabindex="-1"
					data-line={t.line}
					onclick={() => (app.selectedLine = t.line)}
					ondblclick={() => startEdit(t)}
					onkeydown={() => {}}
				>
					<input
						class="check"
						type="checkbox"
						checked={t.complete}
						onclick={(e) => {
							e.stopPropagation();
							void toggleComplete(t.line);
						}}
					/>
					{#if t.priority}
						<span class="pri pri-{t.priority <= 'C' ? t.priority : 'other'}">({t.priority})</span>
					{/if}
					<span class="body">
						{#each tokens(t.body) as tok, i (i)}
							{#if tok.kind === "project"}<span
									class="tok-project"
									role="button"
									tabindex="-1"
									onclick={(e) => {
										e.stopPropagation();
										app.projectFilter = tok.text.slice(1);
									}}
									onkeydown={() => {}}>{tok.text}</span
								>
							{:else if tok.kind === "context"}<span
									class="tok-context"
									role="button"
									tabindex="-1"
									onclick={(e) => {
										e.stopPropagation();
										app.contextFilter = tok.text.slice(1);
									}}
									onkeydown={() => {}}>{tok.text}</span
								>
							{:else if tok.kind === "due"}<span class="tok-due" class:overdue={isOverdue(t)}>{tok.text}</span>
							{:else if tok.kind === "meta"}<span class="tok-meta">{tok.text}</span>
							{:else}{tok.text}{/if}
						{/each}
					</span>
					{#if t.creationDate && !t.complete}
						<span class="date" title="Created {t.creationDate}">{t.creationDate}</span>
					{:else if t.complete && t.completionDate}
						<span class="date" title="Completed {t.completionDate}">✓ {t.completionDate}</span>
					{/if}
					<button
						class="row-menu"
						title="Task actions"
						onclick={(e) => {
							e.stopPropagation();
							app.selectedLine = t.line;
							void showTaskContextMenu(t);
						}}>⋯</button
					>
				</div>
			{/if}
		{/each}
		{#if app.todoDir && visible.length === 0}
			<div class="empty-hint">
				{app.tasks.length === 0
					? "No tasks yet. Add one above — full todo.txt syntax works."
					: "No tasks match the current filter."}
			</div>
		{/if}
	</div>
</div>

<style>
	.main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.add-row {
		padding: 10px 12px 6px;
	}
	.add-input {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		color: var(--fg);
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px 12px;
		outline: none;
	}
	.add-input:focus {
		border-color: var(--accent);
	}
	.task-list {
		flex: 1;
		overflow-y: auto;
		padding: 4px 8px 40px;
	}
	.task-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 7px;
		cursor: default;
		user-select: none;
	}
	.task-row:hover {
		background: var(--hover);
	}
	.task-row.selected {
		background: var(--sel);
	}
	.task-row.done {
		opacity: 0.55;
	}
	.task-row.done .body {
		text-decoration: line-through;
	}
	.check {
		align-self: center;
		flex: none;
		width: 15px;
		height: 15px;
		accent-color: var(--accent);
		cursor: pointer;
	}
	.pri {
		flex: none;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.pri-A {
		color: #d7263d;
	}
	.pri-B {
		color: #e8871e;
	}
	.pri-C {
		color: #b8a010;
	}
	.pri-other {
		color: var(--fg-dim);
	}
	.body {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.tok-project {
		color: var(--accent);
		cursor: pointer;
	}
	.tok-context {
		color: var(--ctx);
		cursor: pointer;
	}
	.tok-project:hover,
	.tok-context:hover {
		text-decoration: underline;
	}
	.tok-due {
		color: var(--fg-dim);
		font-size: 0.85em;
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 0 5px;
		white-space: nowrap;
	}
	.tok-due.overdue {
		color: #fff;
		background: #d7263d;
		border-color: #d7263d;
	}
	.tok-meta {
		color: var(--fg-dim);
		font-size: 0.9em;
	}
	.date {
		flex: none;
		font-size: 0.78em;
		color: var(--fg-faint);
		font-variant-numeric: tabular-nums;
	}
	.row-menu {
		flex: none;
		font: inherit;
		color: var(--fg-faint);
		background: none;
		border: none;
		border-radius: 5px;
		padding: 0 6px;
		cursor: pointer;
		visibility: hidden;
	}
	.task-row:hover .row-menu {
		visibility: visible;
	}
	.row-menu:hover {
		background: var(--hover);
		color: var(--fg);
	}
	.editing {
		padding: 3px 8px;
	}
	.edit-input {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--accent);
		border-radius: 7px;
		padding: 5px 8px;
		outline: none;
	}
	.empty-hint {
		color: var(--fg-dim);
		font-size: 13px;
		padding: 18px 12px;
		line-height: 1.5;
	}
</style>
