<script lang="ts">
	import { tick, untrack } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { toast } from 'svelte-sonner'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
	import FileTextIcon from '@lucide/svelte/icons/file-text'
	import LockIcon from '@lucide/svelte/icons/lock'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import SearchIcon from '@lucide/svelte/icons/search'
	import SheetIcon from '@lucide/svelte/icons/sheet'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import UsersIcon from '@lucide/svelte/icons/users'
	import WalletIcon from '@lucide/svelte/icons/wallet'
	import XIcon from '@lucide/svelte/icons/x'
	import { selectOnFocus } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import SortHeader from '$lib/components/app/SortHeader.svelte'
	import type { SortState } from '$lib/components/app/sort'
	import * as Alert from '$lib/components/ui/alert'
	import { Button } from '$lib/components/ui/button'
	import * as Card from '$lib/components/ui/card'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import * as Empty from '$lib/components/ui/empty'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import * as InputGroup from '$lib/components/ui/input-group'
	import { Label } from '$lib/components/ui/label'
	import * as Select from '$lib/components/ui/select'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import { Switch } from '$lib/components/ui/switch'
	import * as Table from '$lib/components/ui/table'
	import * as Tooltip from '$lib/components/ui/tooltip'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { exportPayrollExcel, type PayrollPeriod } from '$lib/payrollExcel'
	import {
		allPayslipsFilename,
		formatPeriod,
		generatePayslipPdf,
		type PayslipEmployee,
	} from '$lib/payslip'
	import { payrollStore, type Employee } from '$lib/stores/payroll.svelte'
	import { payrollRecordsStore } from '$lib/stores/payrollRecords.svelte'
	import type { PayrollData } from '$lib/types/payroll'
	import { formatDate } from '$lib/utils/date'
	import { formatAmount, formatRM } from '$lib/utils/money'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	const MONTHS = [
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

	useErrorToast(() => payrollStore.error)
	useErrorToast(() => payrollRecordsStore.error)

	const employees = $derived(payrollStore.employees)
	const initialLoading = $derived(payrollStore.loading && employees.length === 0)

	const plural = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`

	// The run view lives at ?period=YYYY-MM, so the Payroll crumb is the way back
	const period = $derived.by((): PayrollPeriod | null => {
		const match = /^(\d{4})-(\d{2})$/.exec(page.url.searchParams.get('period') ?? '')
		if (!match) return null
		const year = Number(match[1])
		const month = Number(match[2])
		return month >= 1 && month <= 12 ? { year, month } : null
	})
	const periodKey = $derived(period ? `${period.year}-${period.month}` : '')
	const periodLabel = $derived(period ? formatPeriod(period) : '')

	// ---------- Employee list ----------
	type SortKey = 'name' | 'basic_salary' | 'epf_employer' | 'lindung_24_jam'

	let searchQuery = $state('')
	let searchInput = $state<HTMLInputElement | null>(null)
	let showSalaries = $state(false)
	let sort = $state<SortState<SortKey>>({ key: null, direction: 'asc' })

	const sortedEmployees = $derived.by((): Employee[] => {
		const query = searchQuery.trim().toLowerCase()
		const rows = employees.filter((e) => !query || e.name.toLowerCase().includes(query))
		const key = sort.key
		if (!key) return rows
		const dir = sort.direction === 'asc' ? 1 : -1
		return [...rows].sort((a, b) => {
			if (key === 'name') return dir * a.name.toLowerCase().localeCompare(b.name.toLowerCase())
			if (key === 'lindung_24_jam')
				return dir * (Number(a.lindung_24_jam) - Number(b.lindung_24_jam))
			return dir * (a[key] - b[key])
		})
	})

	const toggleSort = (key: SortKey): void => {
		if (sort.key === key) {
			sort.direction = sort.direction === 'asc' ? 'desc' : 'asc'
		} else {
			sort = { key, direction: 'asc' }
		}
	}

	// ⌥⌘F focuses the search field
	const onKeydown = (event: KeyboardEvent): void => {
		if (event.metaKey && event.altKey && event.code === 'KeyF') {
			event.preventDefault()
			searchInput?.focus()
			searchInput?.select()
		}
	}

	const MASK = '••••••'
	const money = (amount: number): string => (showSalaries ? formatAmount(amount) : MASK)

	// The newest saved record, for the banner on the list
	const latestRun = $derived(
		[...payrollRecordsStore.runs].sort((a, b) => b.updated_at - a.updated_at)[0],
	)

	// ---------- Employee form (add and edit share it) ----------
	interface EmployeeForm {
		name: string
		basic_salary: string
		epf_employer: string
		useDefaultEpf: boolean
		lindung_24_jam: boolean
	}

	const emptyForm = (): EmployeeForm => ({
		name: '',
		basic_salary: '',
		epf_employer: '',
		useDefaultEpf: true,
		lindung_24_jam: false,
	})

	const toNumber = (value: string): number => {
		const parsed = parseFloat(value)
		return Number.isFinite(parsed) ? parsed : 0
	}

	let form = $state<EmployeeForm>(emptyForm())
	let editing = $state<Employee | null>(null)
	let showEmployeeDialog = $state(false)
	let nameInput = $state<HTMLInputElement | null>(null)

	const formSalary = $derived(toNumber(form.basic_salary))
	const defaultEpf = $derived(formSalary > 0 ? payrollStore.calculateEPF(formSalary).employer : 0)
	const formEpf = $derived(form.useDefaultEpf ? defaultEpf : toNumber(form.epf_employer))
	const lindungPreview = $derived(formSalary > 0 ? payrollStore.calculateLindung24(formSalary) : 0)

	const isFormValid = $derived(form.name.trim() !== '' && formSalary > 0 && formEpf >= 0)
	const isFormChanged = $derived(
		editing === null ||
			form.name.trim() !== editing.name ||
			formSalary !== editing.basic_salary ||
			formEpf !== editing.epf_employer ||
			form.lindung_24_jam !== editing.lindung_24_jam,
	)

	const openAdd = async (): Promise<void> => {
		editing = null
		form = emptyForm()
		showEmployeeDialog = true
		await tick()
		nameInput?.focus()
	}

	const openEdit = (employee: Employee): void => {
		editing = employee
		const calculated = payrollStore.calculateEPF(employee.basic_salary).employer
		form = {
			name: employee.name,
			basic_salary: String(employee.basic_salary),
			epf_employer: String(employee.epf_employer),
			useDefaultEpf: Math.abs(employee.epf_employer - calculated) < 0.01,
			lindung_24_jam: employee.lindung_24_jam,
		}
		showEmployeeDialog = true
	}

	const closeEmployeeDialog = (): void => {
		showEmployeeDialog = false
		editing = null
	}

	const confirmEmployee = async (): Promise<void> => {
		if (!isFormValid || !isFormChanged) return
		const payload = {
			name: form.name.trim(),
			basic_salary: formSalary,
			epf_employer: formEpf,
			lindung_24_jam: form.lindung_24_jam,
		}
		const ok = editing
			? await payrollStore.updateEmployee(editing.id, payload)
			: await payrollStore.addEmployee(payload)
		if (ok) {
			toast.success(editing ? `Saved ${payload.name}` : `Added ${payload.name}`)
			closeEmployeeDialog()
		}
	}

	// ---------- Delete employee ----------
	// Saved payroll records keep their frozen figures, and the employee can be
	// added straight back, so deleting takes an undo toast rather than a
	// confirmation. Delete skips the discard guard: losing the edits is the point.
	const deleteEmployee = async (): Promise<void> => {
		if (!editing) return
		const target = editing
		if (!(await payrollStore.deleteEmployee(target.id))) return
		closeEmployeeDialog()
		toast.success(`Deleted ${target.name}`, {
			duration: 8000,
			action: {
				label: 'Undo',
				onClick: async () => {
					const ok = await payrollStore.addEmployee({
						name: target.name,
						basic_salary: target.basic_salary,
						epf_employer: target.epf_employer,
						lindung_24_jam: target.lindung_24_jam,
					})
					if (ok) toast.success(`Restored ${target.name}`)
				},
			},
		})
	}

	// ---------- Run payroll dialog ----------
	let showRun = $state(false)
	let runMonth = $state('')
	let runYear = $state('')

	const now = new Date()
	const yearOptions = [
		now.getFullYear() - 2,
		now.getFullYear() - 1,
		now.getFullYear(),
		now.getFullYear() + 1,
	]

	const runPeriod = $derived.by((): PayrollPeriod | null =>
		runMonth && runYear ? { month: Number(runMonth), year: Number(runYear) } : null,
	)
	const runExisting = $derived(
		runPeriod ? payrollRecordsStore.getRunByPeriod(runPeriod.year, runPeriod.month) : undefined,
	)

	const openRun = (): void => {
		runMonth = String(period?.month ?? now.getMonth() + 1)
		runYear = String(period?.year ?? now.getFullYear())
		showRun = true
	}

	const confirmRun = async (): Promise<void> => {
		if (!runPeriod) return
		showRun = false
		const month = String(runPeriod.month).padStart(2, '0')
		await goto(`/payroll?period=${runPeriod.year}-${month}`)
	}

	// ---------- Payroll run view ----------
	let payrollData = $state<PayrollData[]>([])
	let generatedFor = ''
	// Payslips are only downloadable once the on-screen figures are frozen into a record
	let recordSaved = $state(false)

	// Figures are generated once per period, and again if employees arrive later
	$effect(() => {
		const key = periodKey
		const current = period
		const count = employees.length
		untrack(async () => {
			if (!current) {
				payrollData = []
				generatedFor = ''
				return
			}
			if (generatedFor === key && (payrollData.length > 0 || count === 0)) return
			payrollData = payrollStore.generatePayrollData(current)
			generatedFor = key
			recordSaved = false
			// PCB is the first figure entered by hand, so start there
			await tick()
			document.querySelector<HTMLInputElement>('[data-pcb-input]')?.focus()
		})
	})

	// Editing PCB or CP38 puts the figures out of sync with the saved record
	const payrollEdits = $derived(payrollData.map((row) => `${row.pcb}:${row.cp38}`).join('|'))
	$effect(() => {
		void payrollEdits
		untrack(() => (recordSaved = false))
	})

	const lindungApplies = $derived(
		period ? payrollStore.isLindung24Applicable(period.year, period.month) : false,
	)
	const existingRun = $derived(
		period ? payrollRecordsStore.getRunByPeriod(period.year, period.month) : undefined,
	)

	const net = (row: PayrollData): number => payrollStore.calculateNetSalary(row)
	const sum = (pick: (row: PayrollData) => number): number =>
		Math.round(payrollData.reduce((total, row) => total + pick(row), 0) * 100) / 100

	const totals = $derived({
		basic: sum((r) => r.basicSalary),
		epfEmployer: sum((r) => r.epfEmployer),
		epfEmployee: sum((r) => r.epfEmployee),
		socsoEmployer: sum((r) => r.socsoEmployer),
		socsoEmployee: sum((r) => r.socsoEmployee),
		eisEmployer: sum((r) => r.eisEmployer),
		eisEmployee: sum((r) => r.eisEmployee),
		lindung: sum((r) => r.lindung24),
		pcb: sum((r) => r.pcb),
		cp38: sum((r) => r.cp38),
		net: sum(net),
	})
	const employerTotal = $derived(totals.epfEmployer + totals.socsoEmployer + totals.eisEmployer)
	const deductionsTotal = $derived(
		totals.epfEmployee +
			totals.socsoEmployee +
			totals.eisEmployee +
			totals.lindung +
			totals.pcb +
			totals.cp38,
	)

	const setFigure = (row: PayrollData, field: 'pcb' | 'cp38', value: string): void => {
		const parsed = parseFloat(value)
		row[field] = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0
	}

	const generateExcel = (): void => {
		if (!period || payrollData.length === 0) return
		try {
			exportPayrollExcel(payrollData, period, net)
			toast.success('Excel downloaded')
		} catch (error) {
			console.error('Excel export failed:', error)
			toast.error('The export failed. Try again.', { duration: Infinity })
		}
	}

	const toPayslipEmployee = (row: PayrollData): PayslipEmployee => ({
		name: row.employeeName,
		basicSalary: row.basicSalary,
		epfEmployee: row.epfEmployee,
		epfEmployer: row.epfEmployer,
		socsoEmployee: row.socsoEmployee,
		socsoEmployer: row.socsoEmployer,
		eisEmployee: row.eisEmployee,
		eisEmployer: row.eisEmployer,
		lindung24: row.lindung24,
		pcb: row.pcb,
		cp38: row.cp38,
		netSalary: net(row),
	})

	const downloadPayslips = (): void => {
		if (!period || !recordSaved || payrollData.length === 0) return
		generatePayslipPdf(payrollData.map(toPayslipEmployee), period, allPayslipsFilename(period))
	}

	// ---------- Save record ----------
	let showSave = $state(false)

	const confirmSave = async (): Promise<void> => {
		if (!period) return
		const wasExisting = existingRun !== undefined
		const run = await payrollRecordsStore.savePayrollRun(
			period.year,
			period.month,
			$state.snapshot(payrollData),
			net,
		)
		if (run) {
			showSave = false
			recordSaved = true
			toast.success(`${periodLabel} payroll ${wasExisting ? 'overwritten' : 'saved'}`, {
				description: 'Payslips are ready to download.',
			})
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if period}
	<!-- ===== Payroll run ===== -->
	<PageHeader title={periodLabel} crumbs={[{ label: 'Payroll', href: '/payroll' }]}>
		<div class="text-muted-foreground min-w-0 flex-1 text-sm">
			{plural(payrollData.length, 'employee')}
			{#if lindungApplies}
				· Lindung 24 Jam applies
			{:else}
				· Lindung 24 Jam applies from June 2026
			{/if}
		</div>
		<Button variant="outline" onclick={generateExcel} disabled={payrollData.length === 0}>
			<SheetIcon data-icon="inline-start" />
			Generate Excel
		</Button>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<span {...props}>
						<Button variant="outline" onclick={downloadPayslips} disabled={!recordSaved}>
							<FileTextIcon data-icon="inline-start" />
							Download Payslips
						</Button>
					</span>
				{/snippet}
			</Tooltip.Trigger>
			{#if !recordSaved}
				<Tooltip.Content>Save the record first</Tooltip.Content>
			{/if}
		</Tooltip.Root>
		<Button onclick={() => (showSave = true)} disabled={payrollData.length === 0}>
			<LockIcon data-icon="inline-start" />
			Save Record…
		</Button>
	</PageHeader>

	{#if recordSaved}
		<Alert.Root class="bg-success-soft border-success/40">
			<CircleCheckIcon class="text-success" />
			<Alert.Title>{periodLabel} payroll saved</Alert.Title>
			<Alert.Description>
				Payslips are ready to download, and the frozen figures are in Payroll History.
			</Alert.Description>
		</Alert.Root>
	{:else}
		<Alert.Root class="bg-warning-soft border-warning/40">
			<TriangleAlertIcon class="text-warning" />
			<Alert.Description class="text-foreground">
				Enter PCB and CP38, then save the record to unlock payslips. Editing a figure after saving
				locks them again.
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if payrollData.length === 0}
		<Empty.Root class="my-auto">
			<Empty.Header>
				<Empty.Media variant="icon">
					<UsersIcon />
				</Empty.Media>
				<Empty.Title>No employees to pay</Empty.Title>
				<Empty.Description>Add employees in Payroll, then run the month again.</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button variant="outline" href="/payroll">Back to Payroll</Button>
			</Empty.Content>
		</Empty.Root>
	{:else}
		<div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
			{@render stat('Basic salary', totals.basic, plural(payrollData.length, 'employee'))}
			{@render stat('Employer contributions', employerTotal, 'EPF, SOCSO and EIS')}
			{@render stat(
				'Employee deductions',
				deductionsTotal,
				lindungApplies ? 'With Lindung 24 Jam, PCB and CP38' : 'With PCB and CP38',
			)}
			{@render stat('Net pay', totals.net, 'To be paid out')}
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
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each payrollData as row, i (row.employeeId)}
					<Table.Row>
						<Table.Cell class="font-medium">{row.employeeName}</Table.Cell>
						<Table.Cell class="text-end tabular-nums">{formatAmount(row.basicSalary)}</Table.Cell>
						{@render pair(row.epfEmployer, row.epfEmployee)}
						{@render pair(row.socsoEmployer, row.socsoEmployee)}
						{@render pair(row.eisEmployer, row.eisEmployee)}
						<Table.Cell class="text-end tabular-nums">
							{#if row.lindung24 > 0}
								{formatAmount(row.lindung24)}
							{:else}
								<span class="text-muted-foreground">—</span>
							{/if}
						</Table.Cell>
						<Table.Cell class="text-end">
							<Input
								type="number"
								inputmode="decimal"
								min="0"
								step="0.01"
								value={row.pcb === 0 ? '' : String(row.pcb)}
								placeholder="0.00"
								aria-label={`PCB for ${row.employeeName}`}
								class="ms-auto h-8 w-24 text-end tabular-nums"
								data-pcb-input={i === 0 ? '' : undefined}
								onchange={(e) => setFigure(row, 'pcb', e.currentTarget.value)}
								{@attach selectOnFocus()}
							/>
						</Table.Cell>
						<Table.Cell class="text-end">
							<Input
								type="number"
								inputmode="decimal"
								min="0"
								step="0.01"
								value={row.cp38 === 0 ? '' : String(row.cp38)}
								placeholder="0.00"
								aria-label={`CP38 for ${row.employeeName}`}
								class="ms-auto h-8 w-24 text-end tabular-nums"
								onchange={(e) => setFigure(row, 'cp38', e.currentTarget.value)}
								{@attach selectOnFocus()}
							/>
						</Table.Cell>
						<Table.Cell class="text-end font-semibold tabular-nums">
							{formatAmount(net(row))}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
			<Table.Footer>
				<Table.Row class="font-bold">
					<Table.Cell>Total</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{formatAmount(totals.basic)}</Table.Cell>
					{@render pair(totals.epfEmployer, totals.epfEmployee)}
					{@render pair(totals.socsoEmployer, totals.socsoEmployee)}
					{@render pair(totals.eisEmployer, totals.eisEmployee)}
					<Table.Cell class="text-end tabular-nums">{formatAmount(totals.lindung)}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{formatAmount(totals.pcb)}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{formatAmount(totals.cp38)}</Table.Cell>
					<Table.Cell class="text-end tabular-nums">{formatAmount(totals.net)}</Table.Cell>
				</Table.Row>
			</Table.Footer>
		</Table.Root>
	{/if}

	{#snippet stat(label: string, value: number, sub: string)}
		<Card.Root size="sm">
			<Card.Content class="flex flex-col gap-0.5">
				<span class="text-muted-foreground text-xs font-medium">{label}</span>
				<span class="text-[22px] font-semibold tabular-nums">{formatRM(value)}</span>
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
		<Table.Cell class="text-end whitespace-nowrap tabular-nums">
			{formatAmount(employer)} <span class="text-muted-foreground">/</span>
			{formatAmount(employee)}
		</Table.Cell>
	{/snippet}

	<!-- Save record -->
	<ActionModal
		bind:open={showSave}
		title={existingRun ? `Overwrite ${periodLabel}?` : `Save ${periodLabel}?`}
		description={existingRun
			? `Saved on ${formatDate(existingRun.updated_at)}. Saving again replaces those figures.`
			: 'Freezes the figures on screen and unlocks the payslips.'}
		loading={payrollRecordsStore.loading}
		confirmText={existingRun ? 'Overwrite Record' : 'Save Record'}
		onconfirm={confirmSave}
		oncancel={() => (showSave = false)}
	>
		<dl class="divide-y rounded-2xl border text-sm">
			<div class="flex justify-between gap-3 px-3 py-2">
				<dt class="text-muted-foreground">Employees</dt>
				<dd class="font-medium tabular-nums">{payrollData.length}</dd>
			</div>
			<div class="flex justify-between gap-3 px-3 py-2">
				<dt class="text-muted-foreground">Total basic salary</dt>
				<dd class="font-medium tabular-nums">{formatRM(totals.basic)}</dd>
			</div>
			<div class="flex justify-between gap-3 px-3 py-2">
				<dt class="text-muted-foreground">Total net pay</dt>
				<dd class="font-semibold tabular-nums">{formatRM(totals.net)}</dd>
			</div>
		</dl>
	</ActionModal>
{:else}
	<!-- ===== Employee list ===== -->
	<PageHeader title="Payroll">
		<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
			<InputGroup.Root class="w-full sm:w-96">
				<InputGroup.Addon>
					<SearchIcon />
				</InputGroup.Addon>
				<InputGroup.Input
					bind:ref={searchInput}
					bind:value={searchQuery}
					type="search"
					placeholder="Search by employee name"
					aria-label="Search by employee name"
				/>
				{#if searchQuery}
					<InputGroup.Addon align="inline-end">
						<InputGroup.Button
							size="icon-sm"
							aria-label="Clear search"
							onclick={() => (searchQuery = '')}
						>
							<XIcon />
						</InputGroup.Button>
					</InputGroup.Addon>
				{/if}
			</InputGroup.Root>
			<div class="flex items-center gap-2">
				<Switch id="show-salaries" bind:checked={showSalaries} />
				<Label for="show-salaries">Show Salaries</Label>
			</div>
		</div>
		<Button variant="outline" onclick={openAdd}>
			<PlusIcon data-icon="inline-start" />
			Add Employee…
		</Button>
		<Button onclick={openRun} disabled={employees.length === 0}>
			<WalletIcon data-icon="inline-start" />
			Run Payroll…
		</Button>
	</PageHeader>

	{#if latestRun}
		<Alert.Root
			class="bg-success-soft border-success/40 flex flex-wrap items-center gap-x-3 gap-y-2"
		>
			<CircleCheckIcon class="text-success" />
			<Alert.Description class="text-foreground">
				<span class="font-medium">
					{formatPeriod({ month: latestRun.month, year: latestRun.year })} payroll saved
				</span>
				on {formatDate(latestRun.updated_at)}. Payslips are in Payroll History.
			</Alert.Description>
			<Button variant="ghost" size="sm" href="/payroll-history" class="ms-auto">
				Open Payroll History
				<ChevronRightIcon data-icon="inline-end" />
			</Button>
		</Alert.Root>
	{/if}

	{#if initialLoading}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Employee</Table.Head>
					<Table.Head class="text-end">Basic salary</Table.Head>
					<Table.Head class="text-end">EPF employer</Table.Head>
					<Table.Head>Lindung 24 Jam</Table.Head>
					<Table.Head><span class="sr-only">Actions</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each { length: 5 } as _, i (i)}
					<Table.Row>
						<Table.Cell><Skeleton class="h-4 w-44" /></Table.Cell>
						<Table.Cell><Skeleton class="ms-auto h-4 w-16" /></Table.Cell>
						<Table.Cell><Skeleton class="ms-auto h-4 w-16" /></Table.Cell>
						<Table.Cell><Skeleton class="h-5 w-16 rounded-full" /></Table.Cell>
						<Table.Cell><Skeleton class="ms-auto size-7" /></Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{:else if sortedEmployees.length === 0}
		<Empty.Root class="my-auto">
			<Empty.Header>
				<Empty.Media variant="icon">
					<UsersIcon />
				</Empty.Media>
				<Empty.Title>{searchQuery ? 'No employees match' : 'No employees yet'}</Empty.Title>
				<Empty.Description>
					{searchQuery
						? 'Try another name or clear the search.'
						: 'Add the first employee to run a payroll.'}
				</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				{#if searchQuery}
					<Button variant="outline" onclick={() => (searchQuery = '')}>Clear Search</Button>
				{:else}
					<Button onclick={openAdd}>
						<PlusIcon data-icon="inline-start" />
						Add Employee…
					</Button>
				{/if}
			</Empty.Content>
		</Empty.Root>
	{:else}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<SortHeader key="name" {sort} onsort={toggleSort}>Employee</SortHeader>
					<SortHeader key="basic_salary" {sort} onsort={toggleSort} align="end">
						Basic salary
					</SortHeader>
					<SortHeader key="epf_employer" {sort} onsort={toggleSort} align="end">
						EPF employer
					</SortHeader>
					<SortHeader key="lindung_24_jam" {sort} onsort={toggleSort}>Lindung 24 Jam</SortHeader>
					<Table.Head><span class="sr-only">Actions</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each sortedEmployees as employee (employee.id)}
					<Table.Row>
						<Table.Cell class={cn('font-medium', capsClass(employee.name))}
							>{employee.name}</Table.Cell
						>
						<Table.Cell
							class={cn('text-end tabular-nums', !showSalaries && 'text-muted-foreground')}
						>
							{money(employee.basic_salary)}
						</Table.Cell>
						<Table.Cell
							class={cn('text-end tabular-nums', !showSalaries && 'text-muted-foreground')}
						>
							{money(employee.epf_employer)}
						</Table.Cell>
						<Table.Cell>
							{#if employee.lindung_24_jam}
								Opted in
							{:else}
								<span class="text-muted-foreground">—</span>
							{/if}
						</Table.Cell>
						<Table.Cell>
							<div class="flex justify-end">
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="ghost"
												size="icon-sm"
												aria-label="Edit Employee…"
												onclick={() => openEdit(employee)}
											>
												<PencilIcon />
											</Button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>Edit employee</Tooltip.Content>
								</Tooltip.Root>
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<div class="text-muted-foreground text-sm">
			{#if searchQuery}
				Showing {sortedEmployees.length} of {plural(employees.length, 'employee')}
			{:else}
				{plural(employees.length, 'employee')}
			{/if}
		</div>
	{/if}

	<!-- Run payroll -->
	<ActionModal
		bind:open={showRun}
		title="Run Payroll"
		disabled={!runPeriod}
		confirmText="Open Payroll"
		onconfirm={confirmRun}
		oncancel={() => (showRun = false)}
	>
		<Field.Group>
			<div class="grid grid-cols-2 gap-3">
				<Field.Field>
					<Field.Label for="run-month">Month</Field.Label>
					<Select.Root type="single" bind:value={runMonth}>
						<Select.Trigger id="run-month" class="w-full">
							{runMonth ? MONTHS[Number(runMonth) - 1] : 'Month'}
						</Select.Trigger>
						<Select.Content>
							<Select.Group>
								{#each MONTHS as name, i (name)}
									<Select.Item value={String(i + 1)} label={name} />
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</Field.Field>
				<Field.Field>
					<Field.Label for="run-year">Year</Field.Label>
					<Select.Root type="single" bind:value={runYear}>
						<Select.Trigger id="run-year" class="w-full">{runYear || 'Year'}</Select.Trigger>
						<Select.Content>
							<Select.Group>
								{#each yearOptions as year (year)}
									<Select.Item value={String(year)} label={String(year)} />
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Root>
				</Field.Field>
			</div>
			{#if runExisting && runPeriod}
				<p class="text-warning text-xs font-medium">
					{formatPeriod(runPeriod)} was already saved on {formatDate(runExisting.updated_at)}.
					Running it again lets you overwrite that record.
				</p>
			{/if}
		</Field.Group>
	</ActionModal>

	<!-- Add / edit employee -->
	<ActionModal
		bind:open={showEmployeeDialog}
		title={editing ? 'Edit Employee' : 'Add Employee'}
		loading={payrollStore.loading}
		disabled={!isFormValid || !isFormChanged}
		dirty={editing ? isFormChanged : JSON.stringify(form) !== JSON.stringify(emptyForm())}
		confirmText={editing ? 'Save' : 'Add Employee'}
		onconfirm={confirmEmployee}
		oncancel={closeEmployeeDialog}
	>
		{#snippet leading()}
			{#if editing}
				<Button variant="destructive" onclick={deleteEmployee}>Delete Employee</Button>
			{/if}
		{/snippet}
		<form
			onsubmit={(e) => {
				e.preventDefault()
				confirmEmployee()
			}}
		>
			<Field.Group>
				<Field.Field>
					<Field.Label for="employee-name">Name</Field.Label>
					<Input
						id="employee-name"
						bind:ref={nameInput}
						bind:value={form.name}
						placeholder="e.g. Chong Mei Ling"
						autocomplete="off"
					/>
				</Field.Field>
				<div class="grid grid-cols-2 gap-3">
					<Field.Field>
						<Field.Label for="employee-salary">Basic salary (RM)</Field.Label>
						<Input
							id="employee-salary"
							bind:value={form.basic_salary}
							type="number"
							inputmode="decimal"
							min="0"
							step="0.01"
							placeholder="0.00"
							{@attach selectOnFocus()}
						/>
					</Field.Field>
					<Field.Field data-disabled={form.useDefaultEpf || undefined}>
						<Field.Label for="employee-epf">EPF employer (RM)</Field.Label>
						<Input
							id="employee-epf"
							value={form.useDefaultEpf ? formatAmount(defaultEpf) : form.epf_employer}
							oninput={(e) => (form.epf_employer = e.currentTarget.value)}
							type="number"
							inputmode="decimal"
							min="0"
							step="0.01"
							placeholder="0.00"
							disabled={form.useDefaultEpf}
							{@attach selectOnFocus()}
						/>
					</Field.Field>
				</div>
				<Field.Field orientation="horizontal">
					<Checkbox id="employee-default-epf" bind:checked={form.useDefaultEpf} />
					<Field.Label for="employee-default-epf" class="font-normal">
						Use default EPF employer contribution
					</Field.Label>
				</Field.Field>
				<Field.Field orientation="horizontal">
					<Checkbox id="employee-lindung" bind:checked={form.lindung_24_jam} />
					<Field.Content>
						<Field.Label for="employee-lindung" class="font-normal">
							Opted in to Lindung 24 Jam (SKBBK)
						</Field.Label>
						{#if formSalary > 0}
							<Field.Description>
								{form.lindung_24_jam ? 'Deducts' : 'Would deduct'}
								{formatRM(lindungPreview)}.
							</Field.Description>
						{/if}
					</Field.Content>
				</Field.Field>
			</Field.Group>
			<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
		</form>
	</ActionModal>
{/if}
