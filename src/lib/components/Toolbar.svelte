<script lang="ts">
	import { getCurrentWindow } from "@tauri-apps/api/window";
	import { baseName } from "$lib/paths";
	import { persist } from "$lib/settings";
	import {
		app,
		isMac,
		isWindows,
		modKeyLabel,
		chooseFolder,
		setTodoDir,
		forgetCurrentFolder,
		revealFolder,
		archiveCompleted,
		closeMenus,
		bumpFont,
	} from "$lib/app.svelte";

	const appWindow = getCurrentWindow();
	const doneCount = $derived(app.tasks.filter((t) => t.complete).length);
</script>

<div class="toolbar" class:mac={isMac} data-tauri-drag-region>
	<div class="toolbar-group">
		<div class="menu-wrap">
			<button
				class="tb-btn"
				title="Change todo folder ({modKeyLabel}O)"
				onclick={() => {
					app.settingsMenuShown = false;
					app.openMenuShown = !app.openMenuShown;
				}}>Folders ▾</button
			>
			{#if app.openMenuShown}
				<div class="menu">
					<button class="menu-item" onclick={chooseFolder}>Choose todo folder…</button>
					{#if app.settings.folders.length > 0}
						<div class="menu-sep"></div>
						{#each app.settings.folders as f (f)}
							<button
								class="menu-item folder"
								class:current={f === app.todoDir}
								onclick={() => {
									closeMenus();
									void setTodoDir(f);
								}}
							>
								<span class="f-name">{baseName(f)}</span>
								<span class="f-path">{f}</span>
							</button>
						{/each}
					{/if}
					{#if app.todoDir}
						<div class="menu-sep"></div>
						<button class="menu-item" onclick={forgetCurrentFolder}>Forget current folder</button>
						<button class="menu-item" onclick={revealFolder}>Show todo.txt file</button>
					{/if}
				</div>
			{/if}
		</div>
		<button
			class="tb-btn"
			title="Move completed tasks to done.txt"
			onclick={() => void archiveCompleted()}
			disabled={doneCount === 0}>Archive Done{doneCount > 0 ? ` (${doneCount})` : ""}</button
		>
	</div>

	{#if app.toast}
		<span class="toast">{app.toast}</span>
	{/if}

	<div class="toolbar-group">
		<div class="menu-wrap">
			<button
				class="tb-btn"
				title="Settings"
				onclick={() => {
					app.openMenuShown = false;
					app.settingsMenuShown = !app.settingsMenuShown;
				}}>Aa ▾</button
			>
			{#if app.settingsMenuShown}
				<div class="menu menu-right">
					<button
						class="menu-item check"
						onclick={() => {
							app.settings.showCompleted = !app.settings.showCompleted;
							persist("showCompleted", app.settings.showCompleted);
						}}>{app.settings.showCompleted ? "✓" : " "} Show completed tasks</button
					>
					<button
						class="menu-item check"
						onclick={() => {
							app.settings.autoCreationDate = !app.settings.autoCreationDate;
							persist("autoCreationDate", app.settings.autoCreationDate);
						}}>{app.settings.autoCreationDate ? "✓" : " "} Date new tasks (creation date)</button
					>
					<div class="menu-sep"></div>
					<div class="menu-label">Appearance</div>
					{#each ["system", "light", "dark"] as const as t (t)}
						<button
							class="menu-item check"
							onclick={() => {
								app.settings.theme = t;
								persist("theme", t);
							}}>{app.settings.theme === t ? "✓" : " "} {t[0].toUpperCase() + t.slice(1)}</button
						>
					{/each}
					<div class="menu-sep"></div>
					<div class="font-row">
						<span class="menu-label">Font size</span>
						<button class="tb-btn" onclick={() => bumpFont(-1)}>−</button>
						<span class="menu-label">{app.settings.fontSize}</span>
						<button class="tb-btn" onclick={() => bumpFont(1)}>+</button>
					</div>
					<div class="menu-sep"></div>
					<button
						class="menu-item"
						onclick={() => {
							closeMenus();
							app.modal = "shortcuts";
						}}>Keyboard shortcuts</button
					>
					<button
						class="menu-item"
						onclick={() => {
							closeMenus();
							app.modal = "about";
						}}>About DayTasks</button
					>
				</div>
			{/if}
		</div>

		{#if isWindows}
			<div class="win-controls">
				<button class="win-btn" title="Minimize" onclick={() => void appWindow.minimize()}>&#xE921;</button>
				<button class="win-btn" title="Maximize" onclick={() => void appWindow.toggleMaximize()}>&#xE922;</button>
				<button class="win-btn win-close" title="Close" onclick={() => void appWindow.close()}>&#xE8BB;</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 10px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-panel);
		user-select: none;
		flex: none;
	}
	.toolbar.mac {
		padding-left: 84px;
	}
	.toolbar-group {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.toast {
		font-size: 12px;
		color: var(--accent);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.menu-wrap {
		position: relative;
	}
	.menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 50;
		min-width: 230px;
		max-width: 340px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
		padding: 4px;
	}
	.menu-right {
		left: auto;
		right: 0;
	}
	.menu-item {
		display: block;
		width: 100%;
		text-align: left;
		font: inherit;
		font-size: 13px;
		color: var(--fg);
		background: none;
		border: none;
		border-radius: 5px;
		padding: 6px 10px;
		cursor: pointer;
	}
	.menu-item:hover {
		background: var(--hover);
	}
	.menu-item.folder .f-name {
		display: block;
		font-weight: 600;
	}
	.menu-item.folder.current .f-name {
		color: var(--accent);
	}
	.menu-item.folder .f-path {
		display: block;
		font-size: 11px;
		color: var(--fg-dim);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.menu-sep {
		height: 1px;
		background: var(--border);
		margin: 4px 6px;
	}
	.menu-label {
		font-size: 11px;
		color: var(--fg-dim);
		padding: 4px 10px 2px;
	}
	.font-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
	}
	.font-row .menu-label:first-child {
		flex: 1;
		padding: 0 4px;
	}

	.win-controls {
		display: flex;
		align-items: stretch;
		align-self: stretch;
		margin: -6px -10px -6px 4px;
	}
	.win-btn {
		font-family: "Segoe MDL2 Assets", "Segoe Fluent Icons", sans-serif;
		font-size: 10px;
		color: var(--fg);
		background: transparent;
		border: none;
		width: 46px;
		cursor: default;
	}
	.win-btn:hover {
		background: var(--hover);
	}
	.win-btn.win-close:hover {
		background: #e81123;
		color: #fff;
	}
</style>
