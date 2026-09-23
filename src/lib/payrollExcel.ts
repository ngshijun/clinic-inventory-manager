import * as XLSX from 'xlsx'
import type { PayrollData } from '$lib/types/payroll'

export interface PayrollPeriod {
	month: number
	year: number
}

/*
 * The accountant's journal: one Excel sheet of accrual entries for the month,
 * grouped by salary, EPF, SOCSO / EIS / Lindung 24 Jam, and PCB / CP38. The
 * account codes are the clinic's own chart of accounts.
 */
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

export const exportPayrollExcel = (
	payrollData: PayrollData[],
	period: PayrollPeriod,
	netSalaryOf: (item: PayrollData) => number,
): void => {
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
	const monthName = monthNames[period.month - 1]
	const year = period.year
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
		const netSalary = netSalaryOf(emp)
		return [
			info.salaryCode[0],
			info.salaryCode[1],
			`SALARIES - ${monthName} ${year} (${emp.employeeName})`,
			netSalary.toFixed(2),
			'0.00',
		]
	})
	const totalSalary = payrollData.reduce((sum, emp) => sum + netSalaryOf(emp), 0)
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
