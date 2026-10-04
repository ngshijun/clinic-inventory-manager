import * as XLSX from 'xlsx'
import type { PayslipEmployee } from '$lib/payslip'

export interface PayrollPeriod {
	month: number
	year: number
}

const MONTH_NAMES = [
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

type ContributionField =
	'epfEmployer' | 'epfEmployee' | 'socsoEmployer' | 'socsoEmployee' | 'eisEmployer' | 'eisEmployee'

/*
 * The accountant's journal: one sheet of accrual entries for the month,
 * grouped by salary, EPF, SOCSO / EIS / Lindung 24 Jam, and PCB / CP38. The
 * account codes are the clinic's own chart of accounts.
 */
const journalSheet = (
	employees: PayslipEmployee[],
	monthName: string,
	year: number,
): XLSX.WorkSheet => {
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
		field: ContributionField,
		codeType: 'salaryCode' | 'epfCode' | 'socsoCode' | 'eisCode',
	) => {
		return employees.map((emp) => {
			const info = getEmployeeAccountInfo(emp.name)
			const value = emp[field]
			const code = info[codeType] as string[]
			return [
				code[0],
				code[1],
				`${type} - ${monthName} ${year} (${emp.name})`,
				value.toFixed(2),
				'0.00',
			]
		})
	}

	// Salary section
	const salaryRows = employees.map((emp) => {
		const info = getEmployeeAccountInfo(emp.name)
		return [
			info.salaryCode[0],
			info.salaryCode[1],
			`SALARIES - ${monthName} ${year} (${emp.name})`,
			emp.netSalary.toFixed(2),
			'0.00',
		]
	})
	const totalSalary = employees.reduce((sum, emp) => sum + emp.netSalary, 0)
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
	const totalEpf = employees.reduce((sum, emp) => sum + emp.epfEmployer + emp.epfEmployee, 0)
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
	const totalSocso = employees.reduce((sum, emp) => sum + emp.socsoEmployer + emp.socsoEmployee, 0)

	// EIS rows
	const eisEmployerRows = createEmployeeRows('EIS EMPLOYER', 'eisEmployer', 'eisCode')
	const eisEmployeeRows = createEmployeeRows('EIS EMPLOYEE', 'eisEmployee', 'salaryCode')
	const totalEis = employees.reduce((sum, emp) => sum + emp.eisEmployer + emp.eisEmployee, 0)

	// Lindung 24 Jam (SKBBK) rows - employee-only, so it is charged to the employee's salary
	// account and accrued to PERKESO alongside SOCSO & EIS.
	const lindung24Rows = employees
		.filter((emp) => emp.lindung24 > 0)
		.map((emp) => {
			const info = getEmployeeAccountInfo(emp.name)
			return [
				info.salaryCode[0],
				info.salaryCode[1],
				`LINDUNG 24 JAM - ${monthName} ${year} (${emp.name})`,
				emp.lindung24.toFixed(2),
				'0.00',
			]
		})
	const totalLindung24 = employees.reduce((sum, emp) => sum + (emp.lindung24 || 0), 0)

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
	const pcbRows = employees
		.filter((emp) => emp.pcb > 0)
		.map((emp) => {
			const info = getEmployeeAccountInfo(emp.name)
			return [
				info.salaryCode[0],
				info.salaryCode[1],
				`PCB - ${monthName} ${year} (${emp.name})`,
				emp.pcb.toFixed(2),
				'0.00',
			]
		})
	const cp38Rows = employees
		.filter((emp) => emp.cp38 > 0)
		.map((emp) => {
			const info = getEmployeeAccountInfo(emp.name)
			return [
				info.salaryCode[0],
				info.salaryCode[1],
				`PCB - ${monthName} ${year} (${emp.name}) - CP38`,
				emp.cp38.toFixed(2),
				'0.00',
			]
		})
	const totalPcb = employees.reduce((sum, emp) => sum + (emp.pcb || 0), 0)
	const totalCp38 = employees.reduce((sum, emp) => sum + (emp.cp38 || 0), 0)

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
	return ws
}

/** The summary's amount columns, in the order Payroll History shows them. */
const SUMMARY_COLUMNS: [string, (employee: PayslipEmployee) => number][] = [
	['Basic Salary', (employee) => employee.basicSalary],
	['EPF Employer', (employee) => employee.epfEmployer],
	['EPF Employee', (employee) => employee.epfEmployee],
	['SOCSO Employer', (employee) => employee.socsoEmployer],
	['SOCSO Employee', (employee) => employee.socsoEmployee],
	['EIS Employer', (employee) => employee.eisEmployer],
	['EIS Employee', (employee) => employee.eisEmployee],
	['Lindung 24 Jam', (employee) => employee.lindung24],
	['PCB', (employee) => employee.pcb],
	['CP38', (employee) => employee.cp38],
	['Net Pay', (employee) => employee.netSalary],
]

/*
 * The month as a table: one row per employee and a total row. The amounts
 * are numbers, not text, so the sheet can be summed and filtered.
 */
const summarySheet = (employees: PayslipEmployee[]): XLSX.WorkSheet => {
	const header = ['Employee', ...SUMMARY_COLUMNS.map(([label]) => label)]
	const rows = employees.map((employee) => [
		employee.name,
		...SUMMARY_COLUMNS.map(([, amountOf]) => amountOf(employee)),
	])
	const total = [
		'Total',
		...SUMMARY_COLUMNS.map(([, amountOf]) => {
			const sum = employees.reduce((running, employee) => running + amountOf(employee), 0)
			return Math.round(sum * 100) / 100
		}),
	]

	const ws = XLSX.utils.aoa_to_sheet([header, ...rows, total])
	ws['!cols'] = [{ wch: 32 }, ...SUMMARY_COLUMNS.map(() => ({ wch: 16 }))]
	for (let r = 1; r <= rows.length + 1; r++) {
		for (let c = 1; c <= SUMMARY_COLUMNS.length; c++) {
			ws[XLSX.utils.encode_cell({ r, c })].z = '#,##0.00'
		}
	}
	return ws
}

export const exportPayrollJournal = (employees: PayslipEmployee[], period: PayrollPeriod): void => {
	const monthName = MONTH_NAMES[period.month - 1]
	const wb = XLSX.utils.book_new()
	XLSX.utils.book_append_sheet(wb, journalSheet(employees, monthName, period.year), 'Payroll')
	XLSX.writeFile(wb, `Payroll_${monthName}_${period.year}.xlsx`)
}

export const exportPayrollSummary = (employees: PayslipEmployee[], period: PayrollPeriod): void => {
	const monthName = MONTH_NAMES[period.month - 1]
	const wb = XLSX.utils.book_new()
	XLSX.utils.book_append_sheet(wb, summarySheet(employees), `${monthName} ${period.year}`)
	XLSX.writeFile(wb, `Payroll_Summary_${monthName}_${period.year}.xlsx`)
}

/** A year's saved months in one file: a summary sheet for each, January first. */
export const exportPayrollYearSummary = (
	months: { month: number; employees: PayslipEmployee[] }[],
	year: number,
): void => {
	const wb = XLSX.utils.book_new()
	for (const { month, employees } of [...months].sort((a, b) => a.month - b.month)) {
		XLSX.utils.book_append_sheet(wb, summarySheet(employees), MONTH_NAMES[month - 1])
	}
	XLSX.writeFile(wb, `Payroll_Summary_${year}.xlsx`)
}
