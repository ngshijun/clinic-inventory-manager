<script lang="ts">
	import { tick, untrack } from 'svelte'
	import { selectOnFocus } from '$lib/attachments/focus'
	import ActionButtonGroup, {
		type ActionButtonGroupAction,
	} from '$lib/components/app/ActionButtonGroup.svelte'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import EmptyState from '$lib/components/app/EmptyState.svelte'
	import ErrorAlert from '$lib/components/app/ErrorAlert.svelte'
	import FormField from '$lib/components/app/FormField.svelte'
	import LoadingSpinner from '$lib/components/app/LoadingSpinner.svelte'
	import SearchInput from '$lib/components/app/SearchInput.svelte'
	import SortableTableHeader, {
		type SortableTableColumn,
		type SortConfig,
	} from '$lib/components/app/SortableTableHeader.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import * as Table from '$lib/components/ui/table/index.js'
	import CalendarIcon from '$lib/components/icons/CalendarIcon.svelte'
	import CheckCircleIcon from '$lib/components/icons/CheckCircleIcon.svelte'
	import InfoCircleIcon from '$lib/components/icons/InfoCircleIcon.svelte'
	import WarningTriangleIcon from '$lib/components/icons/WarningTriangleIcon.svelte'
	import { payrollStore, type Employee, type EmployeeInsert } from '$lib/stores/payroll.svelte'
	import { payrollRecordsStore } from '$lib/stores/payrollRecords.svelte'
	import {
		allPayslipsFilename,
		generatePayslipPdf,
		payslipFilename,
		type PayslipEmployee,
	} from '$lib/payslip'
	import type { PayrollData } from '$lib/types/payroll'
	import * as XLSX from 'xlsx'

	let showAddForm = $state(false)
	let nameInputRef = $state<HTMLInputElement | null>(null)
	let showSalaries = $state(false)
	let showPayrollTable = $state(false)
	let showMonthSelection = $state(false)
	let selectedMonth = $state<string | number | undefined>('')
	let selectedYear = $state<string | number | undefined>(new Date().getFullYear())
	let payrollData = $state<PayrollData[]>([])
	let searchQuery = $state('')

	// Sort configuration
	let sortConfig = $state<SortConfig>({
		key: null,
		direction: 'asc',
	})

	// Employee table columns
	const employeeColumns: SortableTableColumn[] = [
		{ key: 'name', label: 'Employee Name', sortable: true, align: 'left' as const },
		{ key: 'basic_salary', label: 'Basic Salary', sortable: true, align: 'left' as const },
		{ key: 'epf_employer', label: 'EPF Employer', sortable: true, align: 'left' as const },
		{ key: 'lindung_24_jam', label: 'Lindung 24 Jam', sortable: true, align: 'left' as const },
		{ key: 'actions', label: 'Actions', sortable: false, align: 'left' as const },
	]

	// The bound fields of FormField are wider than the database row, so the two
	// editable copies of an employee carry the widened field types.
	type EmployeeForm = {
		name: string | number | undefined
		basic_salary: string | number | undefined
		epf_employer: string | number | undefined
		lindung_24_jam: boolean
	}

	// Edit modal variables
	let showEditModal = $state(false)
	let editEmployee = $state<(EmployeeForm & { id: string }) | null>(null)
	let useDefaultEpfEdit = $state(true)

	// Save payroll record modal variables
	let showSaveModal = $state(false)
	let saveLoading = $state(false)
	let savedNotice = $state('')
	// Payslips are only downloadable once the on-screen figures are frozen into a record
	let recordSaved = $state(false)

	// Delete modal variables
	let showDeleteModal = $state(false)
	let deleteEmployee = $state<Employee | null>(null)
	let deleteLoading = $state(false)
	let deleteConfirmation = $state(false)

	// Set default month and year to current
	const now = new Date()
	selectedMonth = String(now.getMonth() + 1).padStart(2, '0')
	selectedYear = now.getFullYear()

	let useDefaultEpf = $state(true)

	let newEmployee = $state<EmployeeForm>({
		name: '',
		basic_salary: 0,
		epf_employer: 0,
		lindung_24_jam: false,
	})

	// The widened form fields come back as numbers for every calculation
	const asNumber = (value: string | number | undefined): number => {
		const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
		return isNaN(parsed) ? 0 : parsed
	}

	const asText = (value: string | number | undefined): string => String(value ?? '')

	// Filtered and sorted employees based on search query and sort configuration
	const filteredEmployees = $derived.by(() => {
		let employees = payrollStore.employees

		// Apply search filter
		if (searchQuery) {
			employees = employees.filter((employee) =>
				employee.name.toLowerCase().includes(searchQuery.toLowerCase()),
			)
		}

		// Apply sorting
		if (sortConfig.key) {
			employees = [...employees].sort((a, b) => {
				const key = sortConfig.key as keyof Employee
				let aValue = a[key]
				let bValue = b[key]

				// Handle string sorting (for name)
				if (typeof aValue === 'string' && typeof bValue === 'string') {
					aValue = aValue.toLowerCase()
					bValue = bValue.toLowerCase()
				}

				let result = 0
				if (aValue < bValue) result = -1
				else if (aValue > bValue) result = 1

				return sortConfig.direction === 'desc' ? -result : result
			})
		}

		return employees
	})

	// Available months for selection
	const monthOptions = $derived([
		{ value: '01', label: 'January' },
		{ value: '02', label: 'February' },
		{ value: '03', label: 'March' },
		{ value: '04', label: 'April' },
		{ value: '05', label: 'May' },
		{ value: '06', label: 'June' },
		{ value: '07', label: 'July' },
		{ value: '08', label: 'August' },
		{ value: '09', label: 'September' },
		{ value: '10', label: 'October' },
		{ value: '11', label: 'November' },
		{ value: '12', label: 'December' },
	])

	// Available years for selection (current year + previous 2 years + next year)
	const availableYears = $derived.by(() => {
		const currentYear = new Date().getFullYear()
		return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]
	})

	// Year options for FormField
	const yearOptions = $derived(
		availableYears.map((year) => ({ value: year, label: year.toString() })),
	)

	// Format selected period for display
	const formatSelectedPeriod = $derived.by(() => {
		if (!selectedMonth || !selectedYear) return ''
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
		const monthIndex = parseInt(asText(selectedMonth)) - 1
		return `${monthNames[monthIndex]} ${selectedYear}`
	})

	// Combined month-year string for internal use
	const combinedMonthYear = $derived.by(() => {
		if (!selectedMonth || !selectedYear) return ''
		return `${selectedYear}-${selectedMonth}`
	})

	// Payroll totals computed properties
	const payrollTotals = $derived.by(() => {
		if (!payrollData.length) {
			return {
				basicSalary: 0,
				epfEmployer: 0,
				epfEmployee: 0,
				socsoEmployer: 0,
				socsoEmployee: 0,
				eisEmployer: 0,
				eisEmployee: 0,
				lindung24: 0,
				pcb: 0,
				cp38: 0,
				netSalary: 0,
			}
		}

		return payrollData.reduce(
			(totals, payroll) => {
				return {
					basicSalary: totals.basicSalary + payroll.basicSalary,
					epfEmployer: totals.epfEmployer + payroll.epfEmployer,
					epfEmployee: totals.epfEmployee + payroll.epfEmployee,
					socsoEmployer: totals.socsoEmployer + payroll.socsoEmployer,
					socsoEmployee: totals.socsoEmployee + payroll.socsoEmployee,
					eisEmployer: totals.eisEmployer + payroll.eisEmployer,
					eisEmployee: totals.eisEmployee + payroll.eisEmployee,
					lindung24: totals.lindung24 + (payroll.lindung24 || 0),
					pcb: totals.pcb + (payroll.pcb || 0),
					cp38: totals.cp38 + (payroll.cp38 || 0),
					netSalary: totals.netSalary + payrollStore.calculateNetSalary(payroll),
				}
			},
			{
				basicSalary: 0,
				epfEmployer: 0,
				epfEmployee: 0,
				socsoEmployer: 0,
				socsoEmployee: 0,
				eisEmployer: 0,
				eisEmployee: 0,
				lindung24: 0,
				pcb: 0,
				cp38: 0,
				netSalary: 0,
			},
		)
	})

	// Combined contribution totals for display in totals row
	const totalEpf = $derived(payrollTotals.epfEmployer + payrollTotals.epfEmployee)
	const totalSocso = $derived(payrollTotals.socsoEmployer + payrollTotals.socsoEmployee)
	const totalEis = $derived(payrollTotals.eisEmployer + payrollTotals.eisEmployee)

	// Helper function to get account code and description based on employee name
	const getEmployeeAccountInfo = (employeeName: string) => {
		const nameLower = employeeName.toLowerCase()

		if (nameLower.includes('ng sing beng')) {
			return {
				salaryCode: ['927-000', 'DR. NG SING BENG'],
				epfCode: ['908-001', 'EPF CONTRIBUTION - PARTNERS'],
				socsoCode: ['909-001', 'SOCSO CONTRIBUTION - PARTNERS'],
				eisCode: ['909-003', 'SOCSO(EIS) CONTRIBUTION - PARTNERS'],
				description: 'DR. NG SING BENG',
			}
		} else if (nameLower.includes('tan choon ling')) {
			return {
				salaryCode: ['928-000', 'TAN CHOON LING'],
				epfCode: ['908-001', 'EPF CONTRIBUTION - PARTNERS'],
				socsoCode: ['909-001', 'SOCSO CONTRIBUTION - PARTNERS'],
				eisCode: ['909-003', 'SOCSO(EIS) CONTRIBUTION - PARTNERS'],
				description: 'TAN CHOON LING',
			}
		} else {
			return {
				salaryCode: ['904-000', 'SALARIES'],
				epfCode: ['908-000', 'EPF CONTRIBUTION - STAFF'],
				socsoCode: ['909-000', 'SOCSO CONTRIBUTION - STAFF'],
				eisCode: ['909-002', 'SOCSO(EIS) CONTRIBUTION - STAFF'],
				description: 'SALARIES',
			}
		}
	}

	// Watch for changes in salary or default EPF checkbox (add employee)
	$effect(() => {
		const salary = asNumber(newEmployee.basic_salary)
		const useDefault = useDefaultEpf
		if (useDefault && salary && salary > 0) {
			newEmployee.epf_employer = payrollStore.calculateEPF(salary).employer
		}
	})

	// Watch for changes in salary or default EPF checkbox (edit employee)
	$effect(() => {
		const salary = editEmployee ? asNumber(editEmployee.basic_salary) : undefined
		const useDefault = useDefaultEpfEdit
		if (useDefault && salary && salary > 0 && editEmployee) {
			editEmployee.epf_employer = payrollStore.calculateEPF(salary).employer
		}
	})

	const formatCurrency = (amount: number): string => {
		return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	const formatMonth = (monthString: string): string => {
		if (!monthString) return formatSelectedPeriod || ''
		const date = new Date(monthString + '-01')
		return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
	}

	const handleSortChange = (key: string) => {
		if (sortConfig.key === key) {
			// Toggle direction if same key
			sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc'
		} else {
			// Set new key with ascending direction
			sortConfig.key = key
			sortConfig.direction = 'asc'
		}
	}

	const openAddForm = async () => {
		showAddForm = true
		await tick()
		nameInputRef?.focus()
	}

	const addEmployee = async () => {
		const employee: EmployeeInsert = {
			name: asText(newEmployee.name),
			basic_salary: asNumber(newEmployee.basic_salary),
			epf_employer: asNumber(newEmployee.epf_employer),
			lindung_24_jam: newEmployee.lindung_24_jam,
		}
		const result = await payrollStore.addEmployee(employee)
		if (result) {
			cancelAddForm()
		}
	}

	// Action button configurations
	const getEmployeeActions = (): Array<ActionButtonGroupAction> => {
		return [
			{
				key: 'edit',
				label: 'Edit Employee',
				variant: 'blue',
			},
			{
				key: 'delete',
				label: 'Delete',
				variant: 'red',
			},
		]
	}

	// Handle action button clicks
	const handleActionClick = (actionKey: string, employee: Employee) => {
		switch (actionKey) {
			case 'edit':
				openEditModal(employee)
				break
			case 'delete':
				openDeleteModal(employee)
				break
		}
	}

	const openEditModal = (employee: Employee) => {
		editEmployee = {
			id: employee.id,
			name: employee.name,
			basic_salary: employee.basic_salary,
			epf_employer: employee.epf_employer,
			lindung_24_jam: employee.lindung_24_jam,
		}

		// Check if current EPF value matches the calculated default value
		const calculatedEpf = payrollStore.calculateEPF(employee.basic_salary).employer
		const currentEpf = employee.epf_employer

		// If the current EPF matches the calculated value (within a small tolerance for rounding)
		// then check the "use default" checkbox, otherwise uncheck it
		const epfMatches = Math.abs(currentEpf - calculatedEpf) < 0.01
		useDefaultEpfEdit = epfMatches

		showEditModal = true
	}

	const confirmEditEmployee = async () => {
		if (!editEmployee) return

		const result = await payrollStore.updateEmployee(editEmployee.id, {
			name: asText(editEmployee.name),
			basic_salary: asNumber(editEmployee.basic_salary),
			epf_employer: asNumber(editEmployee.epf_employer),
			lindung_24_jam: editEmployee.lindung_24_jam,
		})

		if (result) {
			cancelEditEmployee()
		}
	}

	const cancelEditEmployee = () => {
		showEditModal = false
		editEmployee = null
		useDefaultEpfEdit = true
	}

	const openDeleteModal = (employee: Employee) => {
		deleteEmployee = { ...employee }
		showDeleteModal = true
		deleteConfirmation = false
	}

	const confirmDeleteEmployee = async () => {
		if (!deleteEmployee) return

		deleteLoading = true
		try {
			await payrollStore.deleteEmployee(deleteEmployee.id)
			cancelDeleteEmployee()
		} finally {
			deleteLoading = false
		}
	}

	const cancelDeleteEmployee = () => {
		showDeleteModal = false
		deleteEmployee = null
		deleteConfirmation = false
		deleteLoading = false
	}

	const cancelAddForm = () => {
		showAddForm = false
		useDefaultEpf = true
		newEmployee = {
			name: '',
			basic_salary: 0,
			epf_employer: 0,
			lindung_24_jam: false,
		}
	}

	const cancelMonthSelection = () => {
		showMonthSelection = false
		// Don't reset the selected month and year - preserve user's choice
	}

	const processPayroll = async () => {
		savedNotice = ''
		recordSaved = false
		showMonthSelection = false
		showPayrollTable = true
		payrollData = payrollStore.generatePayrollData(selectedPeriod)

		// PCB is the first figure entered by hand, so start there. The desktop
		// and mobile tables both render, so pick whichever one is displayed.
		await tick()
		const pcbInputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-pcb-input]'))
		pcbInputs.find((input) => input.offsetParent !== null)?.focus()
	}

	const backToEmployeeList = () => {
		savedNotice = ''
		recordSaved = false
		showPayrollTable = false
		showMonthSelection = false
	}

	// The period currently being processed, as numbers
	const selectedPeriod = $derived({
		month: parseInt(asText(selectedMonth)),
		year: asNumber(selectedYear),
	})

	// Lindung 24 Jam only applies from the June 2026 payroll onwards
	const lindung24Applies = $derived(
		payrollStore.isLindung24Applicable(selectedPeriod.year, selectedPeriod.month),
	)

	// Editing PCB/CP38, or switching period, puts the figures out of sync with the
	// saved record, so payslips are locked again until the record is saved
	const payrollEdits = $derived(
		payrollData.map((row) => `${row.pcb ?? ''}:${row.cp38 ?? ''}`).join('|'),
	)

	$effect(() => {
		void payrollEdits
		untrack(() => {
			recordSaved = false
			savedNotice = ''
		})
	})

	$effect(() => {
		void selectedMonth
		void selectedYear
		untrack(() => {
			recordSaved = false
			savedNotice = ''
		})
	})

	// An already saved record for this period means saving again overwrites it
	const existingRun = $derived(
		payrollRecordsStore.getRunByPeriod(selectedPeriod.year, selectedPeriod.month),
	)

	const toPayslipEmployee = (payroll: PayrollData): PayslipEmployee => ({
		name: payroll.employeeName,
		basicSalary: payroll.basicSalary,
		epfEmployee: payroll.epfEmployee,
		epfEmployer: payroll.epfEmployer,
		socsoEmployee: payroll.socsoEmployee,
		socsoEmployer: payroll.socsoEmployer,
		eisEmployee: payroll.eisEmployee,
		eisEmployer: payroll.eisEmployer,
		lindung24: payroll.lindung24,
		pcb: payroll.pcb || 0,
		cp38: payroll.cp38 || 0,
		netSalary: payrollStore.calculateNetSalary(payroll),
	})

	const downloadPayslip = (payroll: PayrollData) => {
		if (!recordSaved) return
		generatePayslipPdf(
			[toPayslipEmployee(payroll)],
			selectedPeriod,
			payslipFilename(payroll.employeeName, selectedPeriod),
		)
	}

	const downloadAllPayslips = () => {
		if (!recordSaved || !payrollData.length) return
		generatePayslipPdf(
			payrollData.map(toPayslipEmployee),
			selectedPeriod,
			allPayslipsFilename(selectedPeriod),
		)
	}

	const openSaveModal = () => {
		savedNotice = ''
		showSaveModal = true
	}

	const cancelSaveModal = () => {
		showSaveModal = false
		saveLoading = false
	}

	const confirmSavePayroll = async () => {
		saveLoading = true
		try {
			const wasExisting = Boolean(existingRun)
			const run = await payrollRecordsStore.savePayrollRun(
				selectedPeriod.year,
				selectedPeriod.month,
				payrollData,
				payrollStore.calculateNetSalary,
			)
			if (run) {
				savedNotice = `${formatSelectedPeriod} payroll ${wasExisting ? 'updated' : 'saved'}.`
				recordSaved = true
				cancelSaveModal()
			}
		} finally {
			saveLoading = false
		}
	}

	const generateExcel = () => {
		if (!payrollData.length) {
			alert('No payroll data to export')
			return
		}

		const wb = XLSX.utils.book_new()
		const monthNames = [
			'JANUARY',
			'FEBRUARY',
			'MARCH',
			'APRIL',
			'MAY',
			'JUNE',
			'JULY',
			'AUGUST',
			'SEPTEMBER',
			'OCTOBER',
			'NOVEMBER',
			'DECEMBER',
		]
		const monthName = monthNames[parseInt(asText(selectedMonth)) - 1]
		const year = selectedYear
		const excelData: (string | number)[][] = []

		// Helper to add section
		const addSection = (
			title: string | null = null,
			rows: (string | number)[][],
			accrualEntry: (string | number)[] | null = null,
			spacing: boolean = true,
		) => {
			if (title) excelData.push([title, '', '', '', ''])
			rows.forEach((row: (string | number)[]) => excelData.push(row))
			if (accrualEntry && rows.length > 0) excelData.push(accrualEntry)
			if (spacing) excelData.push(['', '', '', '', ''])
		}

		// Helper to create employee rows
		const createEmployeeRows = (
			type: string,
			field: keyof PayrollData,
			codeType: 'salaryCode' | 'epfCode' | 'socsoCode' | 'eisCode',
		) => {
			return payrollData.map((emp) => {
				const info = getEmployeeAccountInfo(emp.employeeName)
				const value = emp[field] as number
				const code = info[codeType] as string[]
				return [
					code[0],
					code[1],
					`${type} - ${monthName} ${year} (${emp.employeeName})`,
					value.toFixed(2),
					'0.00',
				]
			})
		}

		// Salary section
		const salaryRows = payrollData.map((emp) => {
			const info = getEmployeeAccountInfo(emp.employeeName)
			const netSalary = payrollStore.calculateNetSalary(emp)
			return [
				info.salaryCode[0],
				info.salaryCode[1],
				`SALARIES - ${monthName} ${year} (${emp.employeeName})`,
				netSalary.toFixed(2),
				'0.00',
			]
		})
		const totalSalary = payrollData.reduce(
			(sum, emp) => sum + payrollStore.calculateNetSalary(emp),
			0,
		)
		addSection(`BEING ACCRUAL SALARY FOR ${monthName} ${year}`, salaryRows, [
			'410-010',
			'ACCRUALS - SALARY',
			`SALARIES - ${monthName} ${year}`,
			'0.00',
			totalSalary.toFixed(2),
		])

		// EPF section
		const epfEmployerRows = createEmployeeRows('EPF EMPLOYER', 'epfEmployer', 'epfCode')
		const epfEmployeeRows = createEmployeeRows('EPF EMPLOYEE', 'epfEmployee', 'salaryCode')
		const totalEpf = payrollData.reduce((sum, emp) => sum + emp.epfEmployer + emp.epfEmployee, 0)
		addSection(
			`BEING ACCRUAL KWSP FOR ${monthName} ${year}`,
			[...epfEmployerRows, ...epfEmployeeRows],
			[
				'410-080',
				'ACCRUALS - KWSP & SOCSO',
				`EPF CONTRIBUTION - ${monthName} ${year} KWSP`,
				'0.00',
				totalEpf.toFixed(2),
			],
		)

		// SOCSO section
		const socsoEmployerRows = createEmployeeRows('SOCSO EMPLOYER', 'socsoEmployer', 'socsoCode')
		const socsoEmployeeRows = createEmployeeRows('SOCSO EMPLOYEE', 'socsoEmployee', 'salaryCode')
		const totalSocso = payrollData.reduce(
			(sum, emp) => sum + emp.socsoEmployer + emp.socsoEmployee,
			0,
		)

		// EIS rows
		const eisEmployerRows = createEmployeeRows('EIS EMPLOYER', 'eisEmployer', 'eisCode')
		const eisEmployeeRows = createEmployeeRows('EIS EMPLOYEE', 'eisEmployee', 'salaryCode')
		const totalEis = payrollData.reduce((sum, emp) => sum + emp.eisEmployer + emp.eisEmployee, 0)

		// Lindung 24 Jam (SKBBK) rows - employee-only, so it is charged to the employee's salary
		// account and accrued to PERKESO alongside SOCSO & EIS.
		const lindung24Rows = payrollData
			.filter((emp) => emp.lindung24 > 0)
			.map((emp) => {
				const info = getEmployeeAccountInfo(emp.employeeName)
				return [
					info.salaryCode[0],
					info.salaryCode[1],
					`LINDUNG 24 JAM - ${monthName} ${year} (${emp.employeeName})`,
					emp.lindung24.toFixed(2),
					'0.00',
				]
			})
		const totalLindung24 = payrollData.reduce((sum, emp) => sum + (emp.lindung24 || 0), 0)

		addSection(
			`BEING ACCRUAL SOCSO & EIS${lindung24Rows.length ? ' & LINDUNG 24 JAM' : ''} FOR ${monthName} ${year}`,
			[...socsoEmployerRows, ...socsoEmployeeRows],
			[
				'410-080',
				'ACCRUALS - KWSP & SOCSO',
				`SOCSO CONTRIBUTION - ${monthName} ${year} PERKESO`,
				'0.00',
				totalSocso.toFixed(2),
			],
			false,
		)

		addSection(
			null,
			[...eisEmployerRows, ...eisEmployeeRows],
			[
				'410-080',
				'ACCRUALS - KWSP & SOCSO',
				`EIS CONTRIBUTION - ${monthName} ${year} PERKESO`,
				'0.00',
				totalEis.toFixed(2),
			],
			lindung24Rows.length === 0,
		)

		if (lindung24Rows.length > 0) {
			addSection(null, lindung24Rows, [
				'410-080',
				'ACCRUALS - KWSP & SOCSO',
				`LINDUNG 24 JAM CONTRIBUTION - ${monthName} ${year} PERKESO`,
				'0.00',
				totalLindung24.toFixed(2),
			])
		}

		// PCB section
		const pcbRows = payrollData
			.filter((emp) => emp.pcb > 0)
			.map((emp) => {
				const info = getEmployeeAccountInfo(emp.employeeName)
				return [
					info.salaryCode[0],
					info.salaryCode[1],
					`PCB - ${monthName} ${year} (${emp.employeeName})`,
					emp.pcb.toFixed(2),
					'0.00',
				]
			})
		const cp38Rows = payrollData
			.filter((emp) => emp.cp38 > 0)
			.map((emp) => {
				const info = getEmployeeAccountInfo(emp.employeeName)
				return [
					info.salaryCode[0],
					info.salaryCode[1],
					`PCB - ${monthName} ${year} (${emp.employeeName}) - CP38`,
					emp.cp38.toFixed(2),
					'0.00',
				]
			})
		const totalPcb = payrollData.reduce((sum, emp) => sum + (emp.pcb || 0), 0)
		const totalCp38 = payrollData.reduce((sum, emp) => sum + (emp.cp38 || 0), 0)

		addSection(
			`BEING ACCRUAL PCB FOR ${monthName} ${year}`,
			[...pcbRows],
			['410-010', 'ACCRUALS - SALARY', `PCB - ${monthName} ${year}`, '0.00', totalPcb.toFixed(2)],
			false,
		)

		addSection(
			null,
			[...cp38Rows],
			['410-010', 'ACCRUALS - SALARY', `CP38 - ${monthName} ${year}`, '0.00', totalCp38.toFixed(2)],
		)

		// Create and style worksheet
		const ws = XLSX.utils.aoa_to_sheet(excelData)
		ws['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 50 }, { wch: 15 }, { wch: 10 }]

		// Find title rows and merge cells
		const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
		excelData.forEach((row, index) => {
			if (row[0] && typeof row[0] === 'string' && row[0].includes('BEING ACCRUAL')) {
				// Merge cells A to E for title rows
				merges.push({
					s: { r: index, c: 0 }, // start: row index, column 0 (A)
					e: { r: index, c: 4 }, // end: row index, column 4 (E)
				})
			}
		})

		// Apply merges to worksheet
		ws['!merges'] = merges

		XLSX.utils.book_append_sheet(wb, ws, 'Payroll')
		XLSX.writeFile(wb, `Payroll_${monthName}_${year}.xlsx`)
	}
</script>

<div class="px-2 py-3 sm:px-0 sm:py-6">
	<div class="rounded-lg border-4 border-dashed border-gray-200 p-3 sm:p-6">
		<!-- Header -->
		<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-bold text-gray-900 sm:text-2xl">Payroll Management</h2>
			<div class="flex flex-col gap-3 sm:flex-row">
				{#if !showAddForm && !showPayrollTable && !showMonthSelection && payrollStore.employees.length > 0}
					<Button
						variant="green"
						class="w-full sm:w-auto"
						onclick={() => (showMonthSelection = true)}
					>
						Process Payroll
					</Button>
				{/if}
				{#if !showAddForm && !showPayrollTable && !showMonthSelection}
					<Button variant="blue" class="w-full sm:w-auto" onclick={openAddForm}>Add Employee</Button
					>
				{/if}
			</div>
		</div>

		<!-- Add Employee Form -->
		{#if showAddForm}
			<div class="mb-4 rounded-lg bg-white p-4 shadow sm:mb-6 sm:p-6">
				<h3 class="mb-4 text-base font-medium text-gray-900 sm:text-lg">Add New Employee</h3>
				<form
					onsubmit={(e) => {
						e.preventDefault()
						addEmployee()
					}}
				>
					<div class="space-y-4 sm:grid sm:grid-cols-3 sm:gap-6 sm:space-y-0">
						<FormField
							bind:ref={nameInputRef}
							bind:value={newEmployee.name}
							type="text"
							label="Employee Name"
							placeholder="Enter employee name"
							required={true}
						/>

						<FormField
							bind:value={newEmployee.basic_salary}
							type="number"
							label="Basic Salary (RM)"
							placeholder="0.00"
							required={true}
							min={0}
							step="0.01"
							selectOnFocus
						/>

						<div>
							<FormField
								bind:value={newEmployee.epf_employer}
								type="number"
								label="EPF Employer Contribution (RM)"
								placeholder="0.00"
								required={true}
								min={0}
								step="0.01"
								disabled={useDefaultEpf}
								selectOnFocus
							/>
							<div class="mt-2 flex items-center gap-2">
								<input
									id="use-default-epf"
									bind:checked={useDefaultEpf}
									type="checkbox"
									class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								<label for="use-default-epf" class="text-sm text-gray-600">
									Use Default EPF Employer Contribution
								</label>
							</div>
						</div>

						<div class="sm:col-span-3">
							<div class="flex items-center gap-2">
								<input
									id="lindung-24-jam"
									bind:checked={newEmployee.lindung_24_jam}
									type="checkbox"
									class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								<label for="lindung-24-jam" class="text-sm text-gray-600">
									Opted in to Lindung 24 Jam (SKBBK)
								</label>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								Employee-only contribution, auto-calculated from the basic salary.
								{#if newEmployee.lindung_24_jam && asNumber(newEmployee.basic_salary) > 0}
									<span>
										Current deduction: RM
										{formatCurrency(
											payrollStore.calculateLindung24(asNumber(newEmployee.basic_salary)),
										)}
									</span>
								{/if}
							</p>
						</div>
					</div>
					<div class="mt-6 flex justify-end gap-3">
						<Button type="button" variant="gray" onclick={cancelAddForm}>Cancel</Button>
						<Button
							type="submit"
							variant="green"
							disabled={payrollStore.loading ||
								!asText(newEmployee.name).trim() ||
								!asNumber(newEmployee.basic_salary) ||
								asNumber(newEmployee.basic_salary) <= 0 ||
								!asNumber(newEmployee.epf_employer) ||
								asNumber(newEmployee.epf_employer) < 0}
						>
							{payrollStore.loading ? 'Adding...' : 'Add Employee'}
						</Button>
					</div>
				</form>
			</div>
		{/if}

		<!-- Error Alert -->
		{#if payrollStore.error}
			<ErrorAlert title={'Error'} message={payrollStore.error} class="mb-4 sm:mb-6" />
		{/if}

		<!-- Month Selection (shown when Process Payroll is clicked) -->
		{#if showMonthSelection && !showPayrollTable}
			<div class="mb-4 rounded-lg bg-white p-4 shadow sm:mb-6 sm:p-6">
				<h3 class="mb-4 text-base font-medium text-gray-900 sm:text-lg">Select Payroll Period</h3>
				<div class="flex flex-col gap-4">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<FormField
							bind:value={selectedMonth}
							type="select"
							label="Month"
							placeholder="Select Month"
							required={true}
							options={monthOptions}
						/>

						<FormField
							bind:value={selectedYear}
							type="select"
							label="Year"
							required={true}
							options={yearOptions}
						/>
					</div>

					<!-- Selected Period Display -->
					{#if selectedMonth && selectedYear}
						<div class="rounded-md border border-blue-200 bg-blue-50 p-3">
							<div class="flex items-center gap-2">
								<CalendarIcon class="h-4 w-4 text-blue-500" />
								<span class="text-sm font-medium text-blue-800">
									Selected Period: {formatSelectedPeriod}
								</span>
							</div>
						</div>
					{/if}

					<!-- Action Buttons -->
					<div class="flex justify-end gap-2">
						<Button variant="gray" onclick={cancelMonthSelection}>Cancel</Button>
						<Button
							variant="green"
							disabled={!selectedMonth || !selectedYear}
							onclick={processPayroll}
						>
							Generate Payroll
						</Button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Search Bar and Controls -->
		{#if !showAddForm && !showPayrollTable && !showMonthSelection && payrollStore.employees.length > 0}
			<div class="mb-4 space-y-4 sm:mb-6">
				<SearchInput bind:value={searchQuery} placeholder="Search employees..." />

				<!-- Show Salaries Toggle -->
				<div class="flex items-center gap-2">
					<input
						id="show-salaries"
						bind:checked={showSalaries}
						type="checkbox"
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<label for="show-salaries" class="text-sm font-medium text-gray-700">
						Show Salaries
					</label>
				</div>
			</div>
		{/if}

		<!-- Loading Spinner -->
		{#if payrollStore.loading && !showAddForm}
			<LoadingSpinner />
			<!-- Employee List -->
		{:else if !showPayrollTable}
			<div class="space-y-4">
				<!-- Desktop Table -->
				<div class="hidden overflow-hidden bg-white shadow sm:rounded-md lg:block">
					<div class="border-b border-gray-200 px-4 py-5 sm:px-6">
						<h3 class="text-lg leading-6 font-medium text-gray-900">
							Employees ({filteredEmployees.length})
						</h3>
					</div>
					<Table.Root>
						<SortableTableHeader
							columns={employeeColumns}
							{sortConfig}
							onsortchange={handleSortChange}
						/>
						<Table.Body>
							{#each filteredEmployees as employee (employee.id)}
								<Table.Row>
									<Table.Cell
										class="max-w-xs min-w-0 text-sm font-medium whitespace-normal text-gray-900"
									>
										<div class="break-words">{employee.name}</div>
									</Table.Cell>
									<Table.Cell>
										{#if showSalaries}
											<span>RM {formatCurrency(employee.basic_salary)}</span>
										{:else}
											<span class="text-gray-400">••••••</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										{#if showSalaries}
											<span>RM {formatCurrency(employee.epf_employer)}</span>
										{:else}
											<span class="text-gray-400">••••••</span>
										{/if}
									</Table.Cell>
									<Table.Cell>
										{#if employee.lindung_24_jam}
											<span
												class="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
											>
												Opted in
											</span>
										{:else}
											<span class="text-xs text-gray-400">—</span>
										{/if}
									</Table.Cell>
									<Table.Cell class="font-medium">
										<ActionButtonGroup
											actions={getEmployeeActions()}
											size="sm"
											loading={payrollStore.loading}
											onactionclick={(actionKey) => handleActionClick(actionKey, employee)}
										/>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>

				<!-- Mobile Cards -->
				<div class="space-y-3 md:hidden">
					{#each filteredEmployees as employee (employee.id)}
						<div class="rounded-lg bg-white p-4 shadow">
							<div class="mb-2 flex items-start justify-between">
								<h3 class="text-sm font-medium text-gray-900">{employee.name}</h3>
							</div>
							<div class="mb-3 space-y-1 text-sm text-gray-600">
								<div>
									<span class="font-medium">Salary:</span>
									{#if showSalaries}
										<span class="ml-1">RM {formatCurrency(employee.basic_salary)}</span>
									{:else}
										<span class="ml-1 text-gray-400">••••••</span>
									{/if}
								</div>
								<div>
									<span class="font-medium">EPF Employer:</span>
									{#if showSalaries}
										<span class="ml-1">RM {formatCurrency(employee.epf_employer)}</span>
									{:else}
										<span class="ml-1 text-gray-400">••••••</span>
									{/if}
								</div>
								<div>
									<span class="font-medium">Lindung 24 Jam:</span>
									<span class="ml-1">{employee.lindung_24_jam ? 'Opted in' : '—'}</span>
								</div>
							</div>

							<!-- Actions -->
							<div class="border-t border-gray-100 pt-2">
								<ActionButtonGroup
									class="w-full"
									actions={getEmployeeActions()}
									size="sm"
									loading={payrollStore.loading}
									onactionclick={(actionKey) => handleActionClick(actionKey, employee)}
								/>
							</div>
						</div>
					{/each}
				</div>

				<!-- Empty State -->
				{#if filteredEmployees.length === 0 && payrollStore.employees.length === 0}
					<EmptyState
						title="No employees found"
						description="Add your first employee to get started with payroll management."
					/>
					<!-- No Search Results -->
				{:else if filteredEmployees.length === 0 && searchQuery}
					<EmptyState title="No employees found" description="Try adjusting your search terms." />
				{/if}
			</div>
			<!-- Payroll Processing Table -->
		{:else if showPayrollTable}
			<div class="space-y-4">
				<div class="rounded-lg bg-white p-4 shadow sm:p-6">
					<div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
						<h3 class="mb-4 text-lg font-medium text-gray-900 sm:mb-0">
							Payroll for {formatMonth(combinedMonthYear)}
						</h3>
						<div class="flex flex-col gap-2 sm:flex-row">
							<Button variant="gray" onclick={backToEmployeeList}>Back to Employee List</Button>
							<Button variant="green" onclick={generateExcel}>Generate Excel</Button>
							{#if recordSaved}
								<button
									onclick={downloadAllPayslips}
									class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
								>
									Download All Payslips
								</button>
							{/if}
							<Button variant="blue" onclick={openSaveModal}>
								{existingRun ? 'Update Saved Record' : 'Save Record'}
							</Button>
						</div>
					</div>

					<!-- Payslips stay locked until the figures are frozen into a record -->
					{#if !recordSaved}
						<div
							class="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3"
						>
							<WarningTriangleIcon class="h-4 w-4 flex-shrink-0 text-amber-500" />
							<span class="text-sm text-amber-800">
								Enter PCB and CP38, then {existingRun ? 'update' : 'save'} the record to download payslips.
							</span>
						</div>
					{/if}

					<!-- Saved confirmation -->
					{#if savedNotice}
						<div
							class="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3"
						>
							<CheckCircleIcon class="h-4 w-4 text-green-600" />
							<span class="text-sm text-green-800">{savedNotice}</span>
							<a
								href="/payroll-history"
								class="ml-auto text-sm font-medium text-green-700 underline hover:text-green-900"
							>
								View Payroll History
							</a>
						</div>
					{/if}

					<!-- Desktop Table -->
					<div class="hidden md:block">
						<Table.Root>
							<Table.Header>
								<Table.Row class="hover:bg-transparent">
									<Table.Head class="px-2 whitespace-normal">Employee</Table.Head>
									<Table.Head class="px-2 text-right whitespace-normal">Basic Salary</Table.Head>
									<Table.Head class="px-2 text-right whitespace-normal">EPF Employer</Table.Head>
									<Table.Head class="px-2 text-right whitespace-normal">EPF Employee</Table.Head>
									<Table.Head class="px-2 text-right whitespace-normal">SOCSO Employer</Table.Head>
									<Table.Head class="px-2 text-right whitespace-normal">SOCSO Employee</Table.Head>
									<Table.Head class="px-2 text-right whitespace-normal">EIS Employer</Table.Head>
									<Table.Head class="px-2 text-right whitespace-normal">EIS Employee</Table.Head>
									{#if lindung24Applies}
										<Table.Head class="px-2 text-right whitespace-normal">Lindung 24 Jam</Table.Head
										>
									{/if}
									<Table.Head class="px-2 text-right whitespace-normal">PCB</Table.Head>
									<Table.Head class="px-2 text-right whitespace-normal">CP38</Table.Head>
									<Table.Head class="px-2 text-right whitespace-normal">Net Salary</Table.Head>
									{#if recordSaved}
										<Table.Head class="px-2 text-center whitespace-normal">Payslip</Table.Head>
									{/if}
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each payrollData as payroll (payroll.employeeId)}
									<Table.Row class="hover:bg-transparent">
										<Table.Cell class="px-2 font-medium">
											{payroll.employeeName}
										</Table.Cell>
										<Table.Cell class="px-2 text-right">
											RM {formatCurrency(payroll.basicSalary)}
										</Table.Cell>
										<Table.Cell class="px-2 text-right text-gray-600">
											RM {formatCurrency(payroll.epfEmployer)}
										</Table.Cell>
										<Table.Cell class="px-2 text-right text-gray-600">
											RM {formatCurrency(payroll.epfEmployee)}
										</Table.Cell>
										<Table.Cell class="px-2 text-right text-gray-600">
											RM {formatCurrency(payroll.socsoEmployer)}
										</Table.Cell>
										<Table.Cell class="px-2 text-right text-gray-600">
											RM {formatCurrency(payroll.socsoEmployee)}
										</Table.Cell>
										<Table.Cell class="px-2 text-right text-gray-600">
											RM {formatCurrency(payroll.eisEmployer)}
										</Table.Cell>
										<Table.Cell class="px-2 text-right text-gray-600">
											RM {formatCurrency(payroll.eisEmployee)}
										</Table.Cell>
										{#if lindung24Applies}
											<Table.Cell class="px-2 text-right text-gray-600">
												{#if payroll.lindung24 > 0}
													<span>RM {formatCurrency(payroll.lindung24)}</span>
												{:else}
													<span class="text-gray-400">—</span>
												{/if}
											</Table.Cell>
										{/if}
										<Table.Cell class="px-2 text-right">
											<input
												bind:value={payroll.pcb}
												type="number"
												min="0"
												step="0.01"
												class="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
												placeholder="0.00"
												data-pcb-input
												{@attach selectOnFocus()}
											/>
										</Table.Cell>
										<Table.Cell class="px-2 text-right">
											<input
												bind:value={payroll.cp38}
												type="number"
												min="0"
												step="0.01"
												class="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
												placeholder="0.00"
												{@attach selectOnFocus()}
											/>
										</Table.Cell>
										<Table.Cell class="px-2 text-right font-medium">
											RM {formatCurrency(payrollStore.calculateNetSalary(payroll))}
										</Table.Cell>
										{#if recordSaved}
											<Table.Cell class="px-2 text-center">
												<button
													onclick={() => downloadPayslip(payroll)}
													class="text-sm font-medium text-indigo-600 underline hover:text-indigo-900"
												>
													PDF
												</button>
											</Table.Cell>
										{/if}
									</Table.Row>
								{/each}
							</Table.Body>
							<!-- Totals Row -->
							<tfoot class="bg-gray-100">
								<tr class="border-t-2 border-gray-300">
									<td class="px-2 py-4 text-sm font-bold whitespace-nowrap text-gray-700">TOTAL</td>
									<td
										class="px-2 py-4 text-right text-sm font-bold whitespace-nowrap text-gray-700"
									>
										RM {formatCurrency(payrollTotals.basicSalary)}
									</td>
									<td
										class="px-2 py-4 text-right text-sm font-bold whitespace-nowrap text-gray-700"
										colspan="2"
									>
										RM {formatCurrency(totalEpf)}
									</td>
									<td
										class="px-2 py-4 text-right text-sm font-bold whitespace-nowrap text-gray-700"
										colspan="2"
									>
										RM {formatCurrency(totalSocso)}
									</td>
									<td
										class="px-2 py-4 text-right text-sm font-bold whitespace-nowrap text-gray-700"
										colspan="2"
									>
										RM {formatCurrency(totalEis)}
									</td>
									{#if lindung24Applies}
										<td
											class="px-2 py-4 text-right text-sm font-bold whitespace-nowrap text-gray-700"
										>
											RM {formatCurrency(payrollTotals.lindung24)}
										</td>
									{/if}
									<td
										class="px-2 py-4 text-right text-sm font-bold whitespace-nowrap text-gray-700"
									>
										RM {formatCurrency(payrollTotals.pcb)}
									</td>
									<td
										class="px-2 py-4 text-right text-sm font-bold whitespace-nowrap text-gray-700"
									>
										RM {formatCurrency(payrollTotals.cp38)}
									</td>
									<td
										class="px-2 py-4 text-right text-sm font-bold whitespace-nowrap text-gray-700"
									>
										RM {formatCurrency(payrollTotals.netSalary)}
									</td>
									{#if recordSaved}
										<!-- spacer under the Payslip column, which is only rendered once saved -->
										<td></td>
									{/if}
								</tr>
							</tfoot>
						</Table.Root>
					</div>

					<!-- Mobile Cards for Payroll -->
					<div class="space-y-4 md:hidden">
						{#each payrollData as payroll (payroll.employeeId)}
							<div class="rounded-lg border border-gray-200 p-4">
								<h4 class="mb-3 font-medium text-gray-900">{payroll.employeeName}</h4>
								<div class="space-y-3">
									<div>
										<span class="text-sm text-gray-600">Basic Salary:</span>
										<span class="ml-2 font-medium">RM {formatCurrency(payroll.basicSalary)}</span>
									</div>

									<!-- Contributions Grid -->
									<div
										class="grid gap-2 text-xs {lindung24Applies ? 'grid-rows-4' : 'grid-rows-3'}"
									>
										<div class="rounded bg-gray-50 p-2">
											<div class="mb-1 font-medium text-gray-700">EPF</div>
											<div>Employer: RM {formatCurrency(payroll.epfEmployer)}</div>
											<div>Employee: RM {formatCurrency(payroll.epfEmployee)}</div>
										</div>
										<div class="rounded bg-gray-50 p-2">
											<div class="mb-1 font-medium text-gray-700">SOCSO</div>
											<div>Employer: RM {formatCurrency(payroll.socsoEmployer)}</div>
											<div>Employee: RM {formatCurrency(payroll.socsoEmployee)}</div>
										</div>
										<div class="rounded bg-gray-50 p-2">
											<div class="mb-1 font-medium text-gray-700">EIS</div>
											<div>Employer: RM {formatCurrency(payroll.eisEmployer)}</div>
											<div>Employee: RM {formatCurrency(payroll.eisEmployee)}</div>
										</div>
										{#if lindung24Applies}
											<div class="rounded bg-gray-50 p-2">
												<div class="mb-1 font-medium text-gray-700">Lindung 24 Jam</div>
												{#if payroll.lindung24 > 0}
													<div>
														Employee: RM {formatCurrency(payroll.lindung24)}
													</div>
												{:else}
													<div class="text-gray-400">Not opted in</div>
												{/if}
											</div>
										{/if}
									</div>

									<!-- Manual Inputs -->
									<div class="grid grid-cols-2 gap-3">
										<div>
											<label
												for="pcb-{payroll.employeeId}"
												class="mb-1 block text-xs font-medium text-gray-700">PCB (RM)</label
											>
											<input
												id="pcb-{payroll.employeeId}"
												bind:value={payroll.pcb}
												type="number"
												min="0"
												step="0.01"
												class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
												placeholder="0.00"
												data-pcb-input
												{@attach selectOnFocus()}
											/>
										</div>
										<div>
											<label
												for="cp38-{payroll.employeeId}"
												class="mb-1 block text-xs font-medium text-gray-700">CP38 (RM)</label
											>
											<input
												id="cp38-{payroll.employeeId}"
												bind:value={payroll.cp38}
												type="number"
												min="0"
												step="0.01"
												class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
												placeholder="0.00"
												{@attach selectOnFocus()}
											/>
										</div>
									</div>

									<div class="border-t border-gray-200 pt-2">
										<span class="text-sm text-gray-600">Net Salary:</span>
										<span class="ml-2 text-lg font-medium">
											RM {formatCurrency(payrollStore.calculateNetSalary(payroll))}
										</span>
									</div>

									{#if recordSaved}
										<button
											onclick={() => downloadPayslip(payroll)}
											class="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
										>
											Download Payslip (PDF)
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<!-- Mobile Totals Summary -->
					<div class="md:hidden">
						<div class="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
							<h4 class="mb-3 text-center font-bold text-blue-900">PAYROLL TOTALS</h4>
							<div class="space-y-3">
								<div class="grid grid-cols-2 gap-3 text-sm">
									<div class="rounded border bg-white p-2">
										<div class="font-medium text-gray-700">Basic Salary</div>
										<div class="font-bold text-gray-900">
											RM {formatCurrency(payrollTotals.basicSalary)}
										</div>
									</div>
									<div class="rounded border bg-white p-2">
										<div class="font-medium text-blue-700">Net Salary</div>
										<div class="font-bold text-blue-900">
											RM {formatCurrency(payrollTotals.netSalary)}
										</div>
									</div>
								</div>

								<div class="grid grid-cols-3 gap-3 text-xs">
									<div class="rounded border bg-white p-2 text-center">
										<div class="mb-1 font-medium text-gray-700">EPF Total</div>
										<div class="font-bold text-gray-900">RM {formatCurrency(totalEpf)}</div>
									</div>
									<div class="rounded border bg-white p-2 text-center">
										<div class="mb-1 font-medium text-gray-700">SOCSO Total</div>
										<div class="font-bold text-gray-900">RM {formatCurrency(totalSocso)}</div>
									</div>
									<div class="rounded border bg-white p-2 text-center">
										<div class="mb-1 font-medium text-gray-700">EIS Total</div>
										<div class="font-bold text-gray-900">RM {formatCurrency(totalEis)}</div>
									</div>
								</div>

								{#if lindung24Applies}
									<div class="rounded border bg-white p-2 text-center text-xs">
										<div class="mb-1 font-medium text-gray-700">Lindung 24 Jam Total</div>
										<div class="font-bold text-gray-900">
											RM {formatCurrency(payrollTotals.lindung24)}
										</div>
									</div>
								{/if}

								<div class="grid grid-cols-2 gap-2 text-xs">
									<div class="rounded border bg-white p-2 text-center">
										<div class="font-medium text-gray-700">PCB</div>
										<div class="font-bold">RM {formatCurrency(payrollTotals.pcb)}</div>
									</div>
									<div class="rounded border bg-white p-2 text-center">
										<div class="font-medium text-gray-700">CP38</div>
										<div class="font-bold">RM {formatCurrency(payrollTotals.cp38)}</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Save Payroll Record Modal -->
		<ActionModal
			bind:open={showSaveModal}
			title={existingRun ? 'Update Saved Payroll Record' : 'Save Payroll Record'}
			variant="blue"
			confirmText={existingRun ? 'Overwrite Record' : 'Save Record'}
			loading={saveLoading}
			onconfirm={confirmSavePayroll}
			oncancel={cancelSaveModal}
			onclose={cancelSaveModal}
		>
			<div class="space-y-4">
				{#if existingRun}
					<div class="rounded-md border border-amber-200 bg-amber-50 p-3">
						<div class="mb-2 flex items-center gap-2">
							<WarningTriangleIcon class="h-4 w-4 text-amber-500" />
							<span class="text-sm font-medium text-amber-800">
								{formatSelectedPeriod} has already been saved
							</span>
						</div>
						<p class="text-sm text-amber-700">
							Saving again replaces the stored figures for this month with the ones shown below. The
							previous version cannot be recovered.
						</p>
					</div>
				{:else}
					<div class="rounded-md border border-blue-200 bg-blue-50 p-3">
						<div class="mb-2 flex items-center gap-2">
							<InfoCircleIcon class="h-4 w-4 text-blue-500" />
							<span class="text-sm font-medium text-blue-800">Freeze this month's payroll</span>
						</div>
						<p class="text-sm text-blue-700">
							The figures below are copied into a permanent record. Later changes to an employee's
							salary or Lindung 24 Jam opt-in will not affect it.
						</p>
					</div>
				{/if}

				<div class="rounded-md border border-gray-200 bg-gray-50 p-3">
					<h4 class="mb-2 text-sm font-medium text-gray-900">Record Summary:</h4>
					<div class="space-y-1 text-sm text-gray-600">
						<div><span class="font-medium">Period:</span> {formatSelectedPeriod}</div>
						<div><span class="font-medium">Employees:</span> {payrollData.length}</div>
						<div>
							<span class="font-medium">Total Basic Salary:</span> RM
							{formatCurrency(payrollTotals.basicSalary)}
						</div>
						<div>
							<span class="font-medium">Total Net Salary:</span> RM
							{formatCurrency(payrollTotals.netSalary)}
						</div>
					</div>
				</div>
			</div>
		</ActionModal>

		<!-- Edit Employee Modal -->
		<ActionModal
			bind:open={showEditModal}
			title={`Edit Employee: ${editEmployee?.name || ''}`}
			variant="green"
			confirmText="Update Employee"
			loading={payrollStore.loading}
			disabled={!asText(editEmployee?.name).trim() ||
				!asNumber(editEmployee?.basic_salary) ||
				asNumber(editEmployee?.basic_salary) <= 0 ||
				!asNumber(editEmployee?.epf_employer) ||
				asNumber(editEmployee?.epf_employer) < 0}
			onconfirm={confirmEditEmployee}
			oncancel={cancelEditEmployee}
			onclose={cancelEditEmployee}
		>
			<div class="space-y-4">
				<!-- Information Box -->
				<div class="rounded-md border border-blue-200 bg-blue-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<InfoCircleIcon class="h-4 w-4 text-blue-500" />
						<span class="text-sm font-medium text-blue-800">Update Employee Information</span>
					</div>
					<p class="text-sm text-blue-700">
						Modify the employee's basic information and EPF employer contribution. Changes will be
						applied immediately and reflected in all payroll calculations.
					</p>
				</div>

				<!-- Edit Form Fields -->
				{#if editEmployee}
					<div class="space-y-4">
						<FormField
							bind:value={editEmployee.name}
							type="text"
							label="Employee Name"
							placeholder="Enter employee name"
							required={true}
						/>

						<FormField
							bind:value={editEmployee.basic_salary}
							type="number"
							label="Basic Salary (RM)"
							placeholder="0.00"
							required={true}
							min={0}
							step="0.01"
							selectOnFocus
						/>

						<div>
							<FormField
								bind:value={editEmployee.epf_employer}
								type="number"
								label="EPF Employer Contribution (RM)"
								placeholder="0.00"
								required={true}
								min={0}
								step="0.01"
								disabled={useDefaultEpfEdit}
								selectOnFocus
							/>
							<div class="mt-2 flex items-center gap-2">
								<input
									id="use-default-epf-edit"
									bind:checked={useDefaultEpfEdit}
									type="checkbox"
									class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								<label for="use-default-epf-edit" class="text-sm text-gray-600">
									Use Default EPF Employer Contribution
								</label>
							</div>
						</div>

						<div>
							<div class="flex items-center gap-2">
								<input
									id="lindung-24-jam-edit"
									bind:checked={editEmployee.lindung_24_jam}
									type="checkbox"
									class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								<label for="lindung-24-jam-edit" class="text-sm text-gray-600">
									Opted in to Lindung 24 Jam (SKBBK)
								</label>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								Employee-only contribution, auto-calculated from the basic salary.
								{#if editEmployee.lindung_24_jam && asNumber(editEmployee.basic_salary) > 0}
									<span>
										Current deduction: RM
										{formatCurrency(
											payrollStore.calculateLindung24(asNumber(editEmployee.basic_salary)),
										)}
									</span>
								{/if}
							</p>
						</div>
					</div>
				{/if}
			</div>
		</ActionModal>

		<!-- Delete Confirmation Modal -->
		<ActionModal
			bind:open={showDeleteModal}
			title={`Delete Employee: ${deleteEmployee?.name || ''}`}
			variant="red"
			confirmText="Delete Employee"
			loading={deleteLoading}
			disabled={!deleteConfirmation}
			onconfirm={confirmDeleteEmployee}
			oncancel={cancelDeleteEmployee}
			onclose={cancelDeleteEmployee}
		>
			<div class="space-y-4">
				<!-- Confirmation Message -->
				<div class="rounded-md border border-red-200 bg-red-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<WarningTriangleIcon class="h-4 w-4 text-red-500" />
						<span class="text-sm font-medium text-red-800">
							Warning: This action cannot be undone
						</span>
					</div>
					<p class="text-sm text-red-700">
						You are about to permanently delete this employee record. This will remove all
						associated payroll data.
					</p>
				</div>

				<!-- Employee Details -->
				<div class="rounded-md border border-gray-200 bg-gray-50 p-3">
					<h4 class="mb-2 text-sm font-medium text-gray-900">Employee Details:</h4>
					<div class="space-y-1 text-sm text-gray-600">
						<div><span class="font-medium">Name:</span> {deleteEmployee?.name}</div>
						<div>
							<span class="font-medium">Basic Salary:</span> RM
							{formatCurrency(deleteEmployee?.basic_salary || 0)}
						</div>
						<div>
							<span class="font-medium">EPF Employer:</span> RM
							{formatCurrency(deleteEmployee?.epf_employer || 0)}
						</div>
						<div>
							<span class="font-medium">Lindung 24 Jam:</span>
							{deleteEmployee?.lindung_24_jam ? 'Opted in' : '—'}
						</div>
					</div>
				</div>

				<!-- Confirmation Checkbox -->
				<div class="flex items-center gap-2">
					<input
						id="delete-confirmation"
						bind:checked={deleteConfirmation}
						type="checkbox"
						class="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
					/>
					<label for="delete-confirmation" class="text-sm text-gray-700">
						I understand that this action is permanent and cannot be undone
					</label>
				</div>
			</div>
		</ActionModal>
	</div>
</div>
