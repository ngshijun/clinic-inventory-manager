<script lang="ts">
	import ActionButtonGroup, {
		type ActionButtonGroupAction,
	} from '$lib/components/app/ActionButtonGroup.svelte'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import EmptyState from '$lib/components/app/EmptyState.svelte'
	import ErrorAlert from '$lib/components/app/ErrorAlert.svelte'
	import LoadingSpinner from '$lib/components/app/LoadingSpinner.svelte'
	import CalendarIcon from '$lib/components/icons/CalendarIcon.svelte'
	import WarningTriangleIcon from '$lib/components/icons/WarningTriangleIcon.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import * as Table from '$lib/components/ui/table/index.js'
	import {
		allPayslipsFilename,
		generatePayslipPdf,
		payslipFilename,
		type PayslipEmployee,
	} from '$lib/payslip'
	import {
		payrollRecordsStore,
		type PayrollRun,
		type PayrollRunItem,
	} from '$lib/stores/payrollRecords.svelte'

	let showSalaries = $state(false)
	let selectedRunId = $state<string | null>(null)

	// Delete modal variables
	let showDeleteModal = $state(false)
	let deleteRun = $state<PayrollRun | null>(null)
	let deleteLoading = $state(false)
	let deleteConfirmation = $state(false)

	// Numeric columns rendered in the detail table, in display order
	type AmountKey = Extract<
		keyof PayrollRunItem,
		| 'basic_salary'
		| 'epf_employer'
		| 'epf_employee'
		| 'socso_employer'
		| 'socso_employee'
		| 'eis_employer'
		| 'eis_employee'
		| 'lindung_24_jam'
		| 'pcb'
		| 'cp38'
		| 'net_salary'
	>

	const amountColumns: Array<{ key: AmountKey; label: string }> = [
		{ key: 'basic_salary', label: 'Basic Salary' },
		{ key: 'epf_employer', label: 'EPF Employer' },
		{ key: 'epf_employee', label: 'EPF Employee' },
		{ key: 'socso_employer', label: 'SOCSO Employer' },
		{ key: 'socso_employee', label: 'SOCSO Employee' },
		{ key: 'eis_employer', label: 'EIS Employer' },
		{ key: 'eis_employee', label: 'EIS Employee' },
		{ key: 'lindung_24_jam', label: 'Lindung 24 Jam' },
		{ key: 'pcb', label: 'PCB' },
		{ key: 'cp38', label: 'CP38' },
		{ key: 'net_salary', label: 'Net Salary' },
	]

	const selectedRun = $derived(
		payrollRecordsStore.runs.find((run) => run.id === selectedRunId) || null,
	)

	const selectedItems = $derived(selectedRunId ? payrollRecordsStore.getItems(selectedRunId) : [])

	const totals = $derived.by(() => {
		const result = Object.fromEntries(amountColumns.map((column) => [column.key, 0])) as Record<
			AmountKey,
			number
		>

		selectedItems.forEach((item) => {
			amountColumns.forEach((column) => {
				result[column.key] += item[column.key]
			})
		})

		return result
	})

	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	]

	const formatPeriodLabel = (run: Pick<PayrollRun, 'month' | 'year'>): string =>
		`${monthNames[run.month - 1]} ${run.year}`

	const formatTimestamp = (timestamp: string): string =>
		new Date(timestamp).toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})

	const formatCurrency = (amount: number): string =>
		amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

	const toPayslipEmployee = (item: PayrollRunItem): PayslipEmployee => ({
		name: item.employee_name,
		basicSalary: item.basic_salary,
		epfEmployee: item.epf_employee,
		epfEmployer: item.epf_employer,
		socsoEmployee: item.socso_employee,
		socsoEmployer: item.socso_employer,
		eisEmployee: item.eis_employee,
		eisEmployer: item.eis_employer,
		lindung24: item.lindung_24_jam,
		pcb: item.pcb,
		cp38: item.cp38,
		netSalary: item.net_salary,
	})

	const openRun = async (run: PayrollRun) => {
		selectedRunId = run.id
		// Items are loaded on demand, and dropped from the cache when they change
		if (!payrollRecordsStore.getItems(run.id).length) {
			await payrollRecordsStore.fetchRunItems(run.id)
		}
	}

	const backToList = () => {
		selectedRunId = null
	}

	const downloadPayslip = (item: PayrollRunItem) => {
		if (!selectedRun) return
		const period = { month: selectedRun.month, year: selectedRun.year }
		generatePayslipPdf(
			[toPayslipEmployee(item)],
			period,
			payslipFilename(item.employee_name, period),
		)
	}

	const downloadAllPayslips = () => {
		if (!selectedRun || !selectedItems.length) return
		const period = { month: selectedRun.month, year: selectedRun.year }
		generatePayslipPdf(selectedItems.map(toPayslipEmployee), period, allPayslipsFilename(period))
	}

	// Action button configurations
	const getRunActions = (): Array<ActionButtonGroupAction> => [
		{
			key: 'view',
			label: 'View Record',
			variant: 'blue',
		},
		{
			key: 'delete',
			label: 'Delete',
			variant: 'red',
		},
	]

	const handleActionClick = (actionKey: string, run: PayrollRun) => {
		switch (actionKey) {
			case 'view':
				openRun(run)
				break
			case 'delete':
				openDeleteModal(run)
				break
		}
	}

	const openDeleteModal = (run: PayrollRun) => {
		deleteRun = { ...run }
		showDeleteModal = true
		deleteConfirmation = false
	}

	const confirmDeleteRun = async () => {
		if (!deleteRun) return

		deleteLoading = true
		try {
			const deletedId = deleteRun.id
			const success = await payrollRecordsStore.deletePayrollRun(deletedId)
			if (success && selectedRunId === deletedId) selectedRunId = null
			cancelDeleteRun()
		} finally {
			deleteLoading = false
		}
	}

	const cancelDeleteRun = () => {
		showDeleteModal = false
		deleteRun = null
		deleteConfirmation = false
		deleteLoading = false
	}
</script>

<div class="px-2 py-3 sm:px-0 sm:py-6">
	<div class="rounded-lg border-4 border-dashed border-gray-200 p-3 sm:p-6">
		<!-- Header -->
		<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-bold text-gray-900 sm:text-2xl">
				{selectedRun ? `Payroll Record: ${formatPeriodLabel(selectedRun)}` : 'Payroll History'}
			</h2>
			{#if selectedRun}
				<div class="flex flex-col gap-2 sm:flex-row">
					<Button variant="gray" class="w-full sm:w-auto" onclick={backToList}>
						Back to History
					</Button>
					<button
						onclick={downloadAllPayslips}
						disabled={!selectedItems.length}
						class="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
					>
						Download All Payslips
					</button>
				</div>
			{/if}
		</div>

		<!-- Error Alert -->
		{#if payrollRecordsStore.error}
			<div class="mb-4 sm:mb-6">
				<ErrorAlert title="Error" message={payrollRecordsStore.error} />
			</div>
		{/if}

		<!-- Show Salaries Toggle -->
		{#if payrollRecordsStore.runs.length > 0}
			<div class="mb-4 flex items-center gap-2 sm:mb-6">
				<input
					id="show-salaries-history"
					bind:checked={showSalaries}
					type="checkbox"
					class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
				/>
				<label for="show-salaries-history" class="text-sm font-medium text-gray-700">
					Show Salaries
				</label>
			</div>
		{/if}

		<!-- Loading Spinner -->
		{#if payrollRecordsStore.loading}
			<LoadingSpinner />
			<!-- Saved Periods List -->
		{:else if !selectedRun}
			<div class="space-y-4">
				<!-- Desktop Table -->
				<div class="hidden overflow-hidden bg-white shadow sm:rounded-md lg:block">
					<div class="border-b border-gray-200 px-4 py-5 sm:px-6">
						<h3 class="text-lg leading-6 font-medium text-gray-900">
							Saved Periods ({payrollRecordsStore.runs.length})
						</h3>
					</div>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>
									Period
								</Table.Head>
								<Table.Head
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>
									Saved On
								</Table.Head>
								<Table.Head
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
								>
									Actions
								</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each payrollRecordsStore.runs as run (run.id)}
								<Table.Row class="hover:bg-gray-50">
									<Table.Cell class="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
										{formatPeriodLabel(run)}
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm whitespace-nowrap text-gray-600">
										{formatTimestamp(run.finalized_at)}
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm font-medium whitespace-nowrap">
										<ActionButtonGroup
											actions={getRunActions()}
											size="sm"
											loading={payrollRecordsStore.loading}
											onactionclick={(actionKey) => handleActionClick(actionKey, run)}
										/>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>

				<!-- Mobile Cards -->
				<div class="space-y-3 lg:hidden">
					{#each payrollRecordsStore.runs as run (run.id)}
						<div class="rounded-lg bg-white p-4 shadow">
							<h3 class="mb-1 text-sm font-medium text-gray-900">{formatPeriodLabel(run)}</h3>
							<div class="mb-3 text-sm text-gray-600">
								<span class="font-medium">Saved On:</span>
								<span class="ml-1">{formatTimestamp(run.finalized_at)}</span>
							</div>
							<div class="border-t border-gray-100 pt-2">
								<ActionButtonGroup
									class="w-full"
									actions={getRunActions()}
									size="sm"
									loading={payrollRecordsStore.loading}
									onactionclick={(actionKey) => handleActionClick(actionKey, run)}
								/>
							</div>
						</div>
					{/each}
				</div>

				<!-- Empty State -->
				{#if payrollRecordsStore.runs.length === 0}
					<EmptyState
						title="No payroll records yet"
						description="Process a payroll on the Payroll page and save it to keep a permanent record of that month."
					/>
				{/if}
			</div>
			<!-- Selected Record Detail -->
		{:else}
			<div class="space-y-4">
				<div class="rounded-lg bg-white p-4 shadow sm:p-6">
					<div class="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
						<div class="flex items-center gap-2">
							<CalendarIcon class="h-4 w-4 text-blue-500" />
							<span class="text-sm font-medium text-blue-800">
								Saved on {formatTimestamp(selectedRun.finalized_at)} — these figures are frozen and are
								not affected by later employee changes.
							</span>
						</div>
					</div>

					<!-- Desktop Table -->
					<div class="hidden md:block">
						<Table.Root>
							<Table.Header>
								<tr>
									<th
										class="px-2 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>
										Employee
									</th>
									{#each amountColumns as column (column.key)}
										<th
											class="px-2 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase"
										>
											{column.label}
										</th>
									{/each}
									<th
										class="px-2 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase"
									>
										Payslip
									</th>
								</tr>
							</Table.Header>
							<Table.Body>
								{#each selectedItems as item (item.id)}
									<tr>
										<td class="px-2 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
											{item.employee_name}
										</td>
										{#each amountColumns as column (column.key)}
											<td
												class="px-2 py-4 text-right text-sm whitespace-nowrap {column.key ===
												'net_salary'
													? 'font-medium text-gray-900'
													: 'text-gray-600'}"
											>
												{#if showSalaries}
													<span>RM {formatCurrency(item[column.key])}</span>
												{:else}
													<span class="text-gray-400">••••••</span>
												{/if}
											</td>
										{/each}
										<td class="px-2 py-4 text-center whitespace-nowrap">
											<button
												onclick={() => downloadPayslip(item)}
												class="text-sm font-medium text-indigo-600 underline hover:text-indigo-900"
											>
												PDF
											</button>
										</td>
									</tr>
								{/each}
							</Table.Body>
							<tfoot class="bg-gray-100">
								<tr class="border-t-2 border-gray-300">
									<td class="px-2 py-4 text-sm font-bold whitespace-nowrap text-gray-700">TOTAL</td>
									{#each amountColumns as column (column.key)}
										<td
											class="px-2 py-4 text-right text-sm font-bold whitespace-nowrap text-gray-700"
										>
											{#if showSalaries}
												<span>RM {formatCurrency(totals[column.key])}</span>
											{:else}
												<span class="text-gray-400">••••••</span>
											{/if}
										</td>
									{/each}
									<td></td>
								</tr>
							</tfoot>
						</Table.Root>
					</div>

					<!-- Mobile Cards -->
					<div class="space-y-4 md:hidden">
						{#each selectedItems as item (item.id)}
							<div class="rounded-lg border border-gray-200 p-4">
								<h4 class="mb-3 font-medium text-gray-900">{item.employee_name}</h4>
								<div class="space-y-2 text-sm">
									{#each amountColumns as column (column.key)}
										<div class="flex justify-between">
											<span class="text-gray-600">{column.label}:</span>
											{#if showSalaries}
												<span class="font-medium">
													RM {formatCurrency(item[column.key])}
												</span>
											{:else}
												<span class="text-gray-400">••••••</span>
											{/if}
										</div>
									{/each}
								</div>
								<button
									onclick={() => downloadPayslip(item)}
									class="mt-3 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
								>
									Download Payslip (PDF)
								</button>
							</div>
						{/each}

						{#if selectedItems.length === 0}
							<EmptyState
								title="No employees in this record"
								description="This saved period does not contain any employee rows."
							/>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Delete Confirmation Modal -->
		<ActionModal
			bind:open={showDeleteModal}
			title={`Delete Payroll Record: ${deleteRun ? formatPeriodLabel(deleteRun) : ''}`}
			variant="red"
			confirmText="Delete Record"
			loading={deleteLoading}
			disabled={!deleteConfirmation}
			onconfirm={confirmDeleteRun}
			oncancel={cancelDeleteRun}
			onclose={cancelDeleteRun}
		>
			<div class="space-y-4">
				<div class="rounded-md border border-red-200 bg-red-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<WarningTriangleIcon class="h-4 w-4 text-red-500" />
						<span class="text-sm font-medium text-red-800">
							Warning: This action cannot be undone
						</span>
					</div>
					<p class="text-sm text-red-700">
						You are about to permanently delete the saved payroll record for
						{deleteRun ? formatPeriodLabel(deleteRun) : ''}, including every employee's frozen
						figures for that month.
					</p>
				</div>

				<div class="flex items-center gap-2">
					<input
						id="delete-record-confirmation"
						bind:checked={deleteConfirmation}
						type="checkbox"
						class="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
					/>
					<label for="delete-record-confirmation" class="text-sm text-gray-700">
						I understand that this action is permanent and cannot be undone
					</label>
				</div>
			</div>
		</ActionModal>
	</div>
</div>
