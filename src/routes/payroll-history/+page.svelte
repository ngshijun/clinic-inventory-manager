<script lang="ts">
	import { untrack } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { toast } from 'svelte-sonner'
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
	import FileTextIcon from '@lucide/svelte/icons/file-text'
	import HistoryIcon from '@lucide/svelte/icons/history'
	import LockIcon from '@lucide/svelte/icons/lock'
	import Trash2Icon from '@lucide/svelte/icons/trash-2'
	import UsersIcon from '@lucide/svelte/icons/users'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Card from '$lib/components/ui/card'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import * as Empty from '$lib/components/ui/empty'
	import { Label } from '$lib/components/ui/label'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import { Switch } from '$lib/components/ui/switch'
	import * as Table from '$lib/components/ui/table'
	import * as ToggleGroup from '$lib/components/ui/toggle-group'
	import * as Tooltip from '$lib/components/ui/tooltip'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import {
		allPayslipsFilename,
		formatPeriod,
		generatePayslipPdf,
		payslipFilename,
		type PayslipEmployee,
	} from '$lib/payslip'
	import { payrollStore } from '$lib/stores/payroll.svelte'
	import {
		payrollRecordsStore,
		type PayrollRun,
		type PayrollRunItem,
	} from '$lib/stores/payrollRecords.svelte'
	import { formatDateTime } from '$lib/utils/date'
	import { formatAmount, formatRM } from '$lib/utils/money'
	import { cn } from '$lib/utils'

	useErrorToast(() => payrollRecordsStore.error)

	const runs = $derived(payrollRecordsStore.runs)
	const initialLoading = $derived(payrollRecordsStore.loading && runs.length === 0)

	const plural = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`

	const MASK = '••••••'
	let showSalaries = $state(false)
	const rm = (amount: number): string => (showSalaries ? formatRM(amount) : MASK)
	const amount = (value: number): string => (showSalaries ? formatAmount(value) : MASK)

	const periodOf = (run: PayrollRun): { month: number; year: number } => ({
		month: run.month,
		year: run.year,
	})
	const periodLabel = (run: PayrollRun): string => formatPeriod(periodOf(run))
	/** A record saved again after it was first created */
	const wasOverwritten = (run: PayrollRun): boolean => run.finalized_at - run._creationTime > 60_000

	// ---------- Record detail: ?run=<id> ----------
	const selectedRun = $derived.by((): PayrollRun | null => {
		const id = page.url.searchParams.get('run')
		return id ? (runs.find((run) => run.id === id) ?? null) : null
	})
	const items = $derived(selectedRun ? payrollRecordsStore.getItems(selectedRun.id) : [])
	const itemsLoaded = $derived(
		selectedRun !== null && selectedRun.id in payrollRecordsStore.itemsByRun,
	)

	// ---------- Year segments ----------
	const years = $derived([...new Set(runs.map((run) => run.year))].sort((a, b) => b - a))
	let chosenYear = $state<number | null>(null)
	const year = $derived(chosenYear !== null && years.includes(chosenYear) ? chosenYear : years[0])
	const yearRuns = $derived(
		runs.filter((run) => run.year === year).sort((a, b) => b.month - a.month),
	)

	// Each listed month needs its items for the three figures; they stay live once loaded
	$effect(() => {
		const wanted = selectedRun ? [selectedRun, ...yearRuns] : yearRuns
		const loaded = payrollRecordsStore.itemsByRun
		const missing = wanted.filter((run) => !(run.id in loaded))
		untrack(() => {
			for (const run of missing) void payrollRecordsStore.fetchRunItems(run.id)
		})
	})

	// ---------- Figures ----------
	const round = (value: number): number => Math.round(value * 100) / 100
	const sumOf = (rows: PayrollRunItem[], pick: (row: PayrollRunItem) => number): number =>
		round(rows.reduce((total, row) => total + pick(row), 0))

	const summary = (rows: PayrollRunItem[]) => ({
		basic: sumOf(rows, (r) => r.basic_salary),
		epfEmployer: sumOf(rows, (r) => r.epf_employer),
		epfEmployee: sumOf(rows, (r) => r.epf_employee),
		socsoEmployer: sumOf(rows, (r) => r.socso_employer),
		socsoEmployee: sumOf(rows, (r) => r.socso_employee),
		eisEmployer: sumOf(rows, (r) => r.eis_employer),
		eisEmployee: sumOf(rows, (r) => r.eis_employee),
		lindung: sumOf(rows, (r) => r.lindung_24_jam),
		pcb: sumOf(rows, (r) => r.pcb),
		cp38: sumOf(rows, (r) => r.cp38),
		net: sumOf(rows, (r) => r.net_salary),
	})

	const totals = $derived(summary(items))
	const employerTotal = $derived(
		round(totals.epfEmployer + totals.socsoEmployer + totals.eisEmployer),
	)
	const deductionsTotal = $derived(
		round(
			totals.epfEmployee +
				totals.socsoEmployee +
				totals.eisEmployee +
				totals.lindung +
				totals.pcb +
				totals.cp38,
		),
	)
	const lindungApplies = $derived(
		selectedRun ? payrollStore.isLindung24Applicable(selectedRun.year, selectedRun.month) : false,
	)

	// ---------- Payslips ----------
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

	const downloadPayslip = (run: PayrollRun, item: PayrollRunItem): void => {
		const period = periodOf(run)
		generatePayslipPdf(
			[toPayslipEmployee(item)],
			period,
			payslipFilename(item.employee_name, period),
		)
		toast.success(`Payslip for ${item.employee_name} downloaded`)
	}

	const downloadAllPayslips = async (run: PayrollRun): Promise<void> => {
		const rows = await payrollRecordsStore.fetchRunItems(run.id)
		if (rows.length === 0) {
			toast.error(`${periodLabel(run)} has no employees, so there are no payslips.`)
			return
		}
		const period = periodOf(run)
		generatePayslipPdf(rows.map(toPayslipEmployee), period, allPayslipsFilename(period))
		toast.success(`${periodLabel(run)} payslips downloaded`)
	}

	// ---------- Delete ----------
	let showDelete = $state(false)
	let deleting = $state<PayrollRun | null>(null)

	const openDelete = (run: PayrollRun): void => {
		deleting = run
		showDelete = true
	}

	const closeDelete = (): void => {
		showDelete = false
		deleting = null
	}

	const confirmDelete = async (): Promise<void> => {
		if (!deleting) return
		const target = deleting
		if (await payrollRecordsStore.deletePayrollRun(target.id)) {
			toast.success(`Deleted the ${periodLabel(target)} record`)
			closeDelete()
			if (selectedRun?.id === target.id) await goto('/payroll-history')
		}
	}
</script>

{#if selectedRun}
	{@const run = selectedRun}
	<!-- ===== Record detail ===== -->
	<PageHeader
		title={periodLabel(run)}
		crumbs={[{ label: 'Payroll History', href: '/payroll-history' }]}
	>
		<div class="text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-sm">
			<LockIcon class="size-3.5 shrink-0" />
			<span>
				Saved {formatDateTime(run.finalized_at)} · frozen, not affected by later employee changes
			</span>
		</div>
		<div class="flex items-center gap-2">
			<Switch id="show-salaries-detail" bind:checked={showSalaries} />
			<Label for="show-salaries-detail">Show Salaries</Label>
		</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" size="icon" aria-label="More">
						<EllipsisIcon />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Group>
					<DropdownMenu.Item variant="destructive" onclick={() => openDelete(run)}>
						<Trash2Icon />
						Delete Record…
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
		<Button onclick={() => downloadAllPayslips(run)} disabled={items.length === 0}>
			<FileTextIcon data-icon="inline-start" />
			Download All Payslips
		</Button>
	</PageHeader>

	{#if !itemsLoaded}
		<div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
			{#each { length: 4 } as _, i (i)}
				<Card.Root size="sm">
					<Card.Content class="flex flex-col gap-2">
						<Skeleton class="h-3 w-28" />
						<Skeleton class="h-7 w-32" />
						<Skeleton class="h-3 w-24" />
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
		<Skeleton class="h-48 rounded-md" />
	{:else if items.length === 0}
		<Empty.Root class="my-auto">
			<Empty.Header>
				<Empty.Media variant="icon">
					<UsersIcon />
				</Empty.Media>
				<Empty.Title>No employees in this record</Empty.Title>
				<Empty.Description>
					{periodLabel(run)} was saved with nobody on the payroll.
				</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button variant="outline" href="/payroll-history">Back to Payroll History</Button>
			</Empty.Content>
		</Empty.Root>
	{:else}
		<div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
			{@render stat('Basic salary', totals.basic, plural(items.length, 'employee'))}
			{@render stat('Employer contributions', employerTotal, 'EPF, SOCSO and EIS')}
			{@render stat(
				'Employee deductions',
				deductionsTotal,
				lindungApplies ? 'With Lindung 24 Jam, PCB and CP38' : 'With PCB and CP38',
			)}
			{@render stat('Net pay', totals.net, 'Paid out')}
		</div>

		<Table.Root class="text-[13px]">
			<Table.Header>
				<Table.Row>
					<Table.Head>Employee</Table.Head>
					<Table.Head class="text-end">Basic</Table.Head>
					{@render pairHead('EPF')}
					{@render pairHead('SOCSO')}
					{@render pairHead('EIS')}
					<Table.Head class="text-end">Lindung</Table.Head>
					<Table.Head class="text-end">PCB</Table.Head>
					<Table.Head class="text-end">CP38</Table.Head>
					<Table.Head class="text-end">Net</Table.Head>
					<Table.Head><span class="sr-only">Payslip</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each items as item (item.id)}
					<Table.Row>
						<Table.Cell class="py-2 font-medium whitespace-normal">{item.employee_name}</Table.Cell>
						<Table.Cell class="py-2 text-end tabular-nums">{amount(item.basic_salary)}</Table.Cell>
						{@render pair(item.epf_employer, item.epf_employee)}
						{@render pair(item.socso_employer, item.socso_employee)}
						{@render pair(item.eis_employer, item.eis_employee)}
						<Table.Cell class="py-2 text-end tabular-nums">
							{#if item.lindung_24_jam > 0}
								{amount(item.lindung_24_jam)}
							{:else}
								<span class="text-muted-foreground">—</span>
							{/if}
						</Table.Cell>
						<Table.Cell class="py-2 text-end tabular-nums">{amount(item.pcb)}</Table.Cell>
						<Table.Cell class="py-2 text-end tabular-nums">{amount(item.cp38)}</Table.Cell>
						<Table.Cell class="py-2 text-end font-semibold tabular-nums">
							{amount(item.net_salary)}
						</Table.Cell>
						<Table.Cell class="py-2">
							<div class="flex justify-end">
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="ghost"
												size="icon-sm"
												aria-label={`Download payslip for ${item.employee_name}`}
												onclick={() => downloadPayslip(run, item)}
											>
												<FileTextIcon />
											</Button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>Download payslip</Tooltip.Content>
								</Tooltip.Root>
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
			<Table.Footer>
				<Table.Row class="font-bold">
					<Table.Cell>Total</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{amount(totals.basic)}</Table.Cell>
					{@render pair(totals.epfEmployer, totals.epfEmployee)}
					{@render pair(totals.socsoEmployer, totals.socsoEmployee)}
					{@render pair(totals.eisEmployer, totals.eisEmployee)}
					<Table.Cell class="text-end tabular-nums">{amount(totals.lindung)}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{amount(totals.pcb)}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{amount(totals.cp38)}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{amount(totals.net)}</Table.Cell>
					<Table.Cell></Table.Cell>
				</Table.Row>
			</Table.Footer>
		</Table.Root>
	{/if}

	{#snippet stat(label: string, value: number, sub: string)}
		<Card.Root size="sm">
			<Card.Content class="flex flex-col gap-0.5">
				<span class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
					>{label}</span
				>
				<span
					class={cn(
						'text-[22px] font-semibold tabular-nums',
						!showSalaries && 'text-muted-foreground',
					)}
				>
					{rm(value)}
				</span>
				<span class="text-muted-foreground text-xs">{sub}</span>
			</Card.Content>
		</Card.Root>
	{/snippet}

	{#snippet pairHead(label: string)}
		<Table.Head class="text-end">
			{label}
			<span class="text-muted-foreground block text-[11px] font-normal normal-case">
				Employer / employee
			</span>
		</Table.Head>
	{/snippet}

	{#snippet pair(employer: number, employee: number)}
		<Table.Cell class="py-2 text-end whitespace-nowrap tabular-nums">
			{amount(employer)} <span class="text-muted-foreground">/</span>
			{amount(employee)}
		</Table.Cell>
	{/snippet}
{:else}
	<!-- ===== Saved periods ===== -->
	<PageHeader title="Payroll History">
		<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
			{#if years.length > 1}
				<ToggleGroup.Root
					type="single"
					variant="outline"
					size="sm"
					value={String(year)}
					onValueChange={(value) => (chosenYear = value ? Number(value) : null)}
					aria-label="Year"
				>
					{#each years as option (option)}
						<ToggleGroup.Item value={String(option)}>{option}</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
			{/if}
			<div class="flex items-center gap-2">
				<Switch id="show-salaries" bind:checked={showSalaries} />
				<Label for="show-salaries">Show Salaries</Label>
			</div>
		</div>
	</PageHeader>

	{#if initialLoading}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Period</Table.Head>
					<Table.Head>Saved on</Table.Head>
					<Table.Head class="text-end">Employees</Table.Head>
					<Table.Head class="text-end">Total basic</Table.Head>
					<Table.Head class="text-end">Total net</Table.Head>
					<Table.Head><span class="sr-only">Actions</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each { length: 5 } as _, i (i)}
					<Table.Row>
						<Table.Cell class="py-3"><Skeleton class="h-4 w-32" /></Table.Cell>
						<Table.Cell><Skeleton class="h-4 w-36" /></Table.Cell>
						<Table.Cell><Skeleton class="ms-auto h-4 w-6" /></Table.Cell>
						<Table.Cell><Skeleton class="ms-auto h-4 w-24" /></Table.Cell>
						<Table.Cell><Skeleton class="ms-auto h-4 w-24" /></Table.Cell>
						<Table.Cell><Skeleton class="ms-auto h-7 w-32" /></Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{:else if runs.length === 0}
		<Empty.Root class="my-auto">
			<Empty.Header>
				<Empty.Media variant="icon">
					<HistoryIcon />
				</Empty.Media>
				<Empty.Title>No saved months yet</Empty.Title>
				<Empty.Description>Save a payroll run and its frozen figures appear here.</Empty.Description
				>
			</Empty.Header>
			<Empty.Content>
				<Button variant="outline" href="/payroll">Go to Payroll</Button>
			</Empty.Content>
		</Empty.Root>
	{:else}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Period</Table.Head>
					<Table.Head>Saved on</Table.Head>
					<Table.Head class="text-end">Employees</Table.Head>
					<Table.Head class="text-end">Total basic</Table.Head>
					<Table.Head class="text-end">Total net</Table.Head>
					<Table.Head><span class="sr-only">Actions</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each yearRuns as run (run.id)}
					{@const loaded = run.id in payrollRecordsStore.itemsByRun}
					{@const rows = payrollRecordsStore.getItems(run.id)}
					{@const figures = summary(rows)}
					<Table.Row>
						<Table.Cell class="py-2.5 font-medium">{periodLabel(run)}</Table.Cell>
						<Table.Cell class="py-2.5 tabular-nums">
							{formatDateTime(run.finalized_at)}
							{#if wasOverwritten(run)}
								<div class="text-muted-foreground text-xs">Overwritten</div>
							{/if}
						</Table.Cell>
						<Table.Cell class="py-2.5 text-end tabular-nums">
							{#if loaded}
								{rows.length}
							{:else}
								<Skeleton class="ms-auto h-4 w-6" />
							{/if}
						</Table.Cell>
						<Table.Cell
							class={cn('py-2.5 text-end tabular-nums', !showSalaries && 'text-muted-foreground')}
						>
							{#if loaded}
								{rm(figures.basic)}
							{:else}
								<Skeleton class="ms-auto h-4 w-24" />
							{/if}
						</Table.Cell>
						<Table.Cell
							class={cn('py-2.5 text-end tabular-nums', !showSalaries && 'text-muted-foreground')}
						>
							{#if loaded}
								{rm(figures.net)}
							{:else}
								<Skeleton class="ms-auto h-4 w-24" />
							{/if}
						</Table.Cell>
						<Table.Cell class="py-2.5">
							<div class="flex items-center justify-end gap-1">
								<Button variant="outline" size="sm" href={`/payroll-history?run=${run.id}`}>
									View Record
								</Button>
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										{#snippet child({ props })}
											<Button {...props} variant="ghost" size="icon-sm" aria-label="More">
												<EllipsisIcon />
											</Button>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end">
										<DropdownMenu.Group>
											<DropdownMenu.Item onclick={() => downloadAllPayslips(run)}>
												<FileTextIcon />
												Download All Payslips
											</DropdownMenu.Item>
										</DropdownMenu.Group>
										<DropdownMenu.Separator />
										<DropdownMenu.Group>
											<DropdownMenu.Item variant="destructive" onclick={() => openDelete(run)}>
												<Trash2Icon />
												Delete Record…
											</DropdownMenu.Item>
										</DropdownMenu.Group>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<div class="text-muted-foreground text-sm">
			{plural(yearRuns.length, 'saved month')} in {year}
		</div>
	{/if}
{/if}

<!-- Delete record -->
<ActionModal
	bind:open={showDelete}
	title={`Delete the ${deleting ? periodLabel(deleting) : ''} Record?`}
	description="Every employee's frozen figures for that month are removed, and the payslips with them. This cannot be undone."
	loading={payrollRecordsStore.loading}
	confirmText="Delete"
	onconfirm={confirmDelete}
	oncancel={closeDelete}
/>
