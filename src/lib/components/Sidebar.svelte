<script lang="ts">
	import { app, refs } from "$lib/app.svelte";

	function counted(get: (t: import("$lib/todo").Task) => string[]): [string, number][] {
		const counts = new Map<string, number>();
		for (const t of app.tasks) {
			if (t.complete) continue;
			for (const name of get(t)) counts.set(name, (counts.get(name) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	}

	const projects = $derived(counted((t) => t.projects));
	const contexts = $derived(counted((t) => t.contexts));
	const openCount = $derived(app.tasks.filter((t) => !t.complete).length);
</script>

<aside class="sidebar" style="width: {app.settings.paneWidth}px">
	<input
		class="filter"
		type="search"
		placeholder="Filter tasks…"
		bind:this={refs.filterInput}
		bind:value={app.filterText}
	/>
	<div class="side-list">
		<button
			class="row"
			class:active={app.projectFilter === null && app.contextFilter === null}
			onclick={() => {
				app.projectFilter = null;
				app.contextFilter = null;
			}}>All tasks <span class="count">{openCount}</span></button
		>
		{#if projects.length > 0}
			<div class="side-label">Projects</div>
			{#each projects as [name, count] (name)}
				<button
					class="row project"
					class:active={app.projectFilter === name}
					onclick={() => (app.projectFilter = app.projectFilter === name ? null : name)}
					>+{name} <span class="count">{count}</span></button
				>
			{/each}
		{/if}
		{#if contexts.length > 0}
			<div class="side-label">Contexts</div>
			{#each contexts as [name, count] (name)}
				<button
					class="row context"
					class:active={app.contextFilter === name}
					onclick={() => (app.contextFilter = app.contextFilter === name ? null : name)}
					>@{name} <span class="count">{count}</span></button
				>
			{/each}
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		flex: none;
		min-width: 160px;
		background: var(--bg-panel);
		border-right: 1px solid var(--border);
	}
	.filter {
		font: inherit;
		font-size: 13px;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		margin: 8px;
		padding: 6px 9px;
		outline: none;
	}
	.filter:focus {
		border-color: var(--accent);
	}
	.side-list {
		flex: 1;
		overflow-y: auto;
		padding: 0 4px 8px;
	}
	.side-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--fg-faint);
		padding: 10px 9px 3px;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		text-align: left;
		font: inherit;
		font-size: 13px;
		color: var(--fg);
		background: none;
		border: none;
		border-radius: 5px;
		padding: 4px 9px;
		cursor: pointer;
		overflow: hidden;
	}
	.row:hover {
		background: var(--hover);
	}
	.row.active {
		background: var(--sel);
	}
	.row.project {
		color: var(--accent);
	}
	.row.context {
		color: var(--ctx);
	}
	.count {
		font-size: 11px;
		color: var(--fg-dim);
		font-variant-numeric: tabular-nums;
	}
</style>
