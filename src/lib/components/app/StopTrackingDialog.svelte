<script lang="ts">
	import { toast } from 'svelte-sonner'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryItem } from '$lib/types/inventory'

	/**
	 * Takes an item off the purchaser's lists for good: it becomes untracked,
	 * as the Inventory edit form can also do, and loses any order status.
	 * Undo puts both back. `bind:this` and `open(item)`.
	 */
	let item = $state<InventoryItem | null>(null)
	let isOpen = $state(false)

	export function open(target: InventoryItem): void {
		item = target
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		item = null
	}

	const confirm = async (): Promise<void> => {
		if (!item) return
		const { id, item_name: name, order_status: previous } = item
		await inventoryStore.updateItem(id, { not_track: true })
		if (inventoryStore.error) return
		close()
		toast.success(`Stopped tracking ${name}`, {
			duration: 8000,
			action: {
				label: 'Undo',
				onClick: async () => {
					await inventoryStore.updateItem(id, { not_track: false })
					if (!inventoryStore.error && previous) {
						await inventoryStore.restoreOrderStatus(id, previous)
					}
					if (!inventoryStore.error) toast.success(`Tracking ${name} again`)
				},
			},
		})
	}
</script>

<ActionModal
	bind:open={isOpen}
	title="Stop Tracking Item"
	description="It leaves every Dashboard list and no longer counts as low or out of stock. You can track it again from Inventory."
	loading={inventoryStore.loading}
	confirmText="Stop Tracking"
	onconfirm={confirm}
	oncancel={close}
>
	{#if item}
		<DialogSubject name={item.item_name} />
	{/if}
</ActionModal>
