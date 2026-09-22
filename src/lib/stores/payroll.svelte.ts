// stores/payroll.svelte.ts
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { convex } from '$lib/convex'
import type { PayrollData } from '$lib/types/payroll'
import { errorMessage, withLegacy, type WithLegacy } from '$lib/types/legacy'
import { authStore } from './auth.svelte'

type Employee = WithLegacy<Doc<'payroll'>>
type EmployeeId = Id<'payroll'>
interface EmployeeInsert {
	name: string
	basic_salary: number
	epf_employer: number
	lindung_24_jam?: boolean
}
type EmployeeUpdate = Partial<EmployeeInsert>

/** Contribution tables are in ringgit and sen; drop binary float noise (9.500000000000002). */
const toCents = (amount: number): number => Math.round(amount * 100) / 100

class PayrollStore {
	// State
	employees = $state<Employee[]>([])
	private loadingCount = $state(0)
	error = $state<string | null>(null)
	private unsubscribe: (() => void) | null = null
	private settleFirst: (() => void) | null = null
	private isInitialized = false

	get loading(): boolean {
		return this.loadingCount > 0
	}

	// Getters (computed)
	get totalEmployees(): number {
		return this.employees.length
	}

	get totalBasicSalary(): number {
		return this.employees.reduce((sum, employee) => sum + employee.basic_salary, 0)
	}

	// Actions
	fetchEmployees = async (): Promise<void> => {
		this.loadingCount++
		this.error = null
		try {
			const docs = await convex.query(api.payroll.list, { auth: authStore.token })
			this.employees = docs.map(withLegacy)
		} catch (err) {
			this.error = errorMessage(err, 'An error occurred while fetching employees')
			console.error('Error fetching employees:', err)
		} finally {
			this.loadingCount--
		}
	}

	addEmployee = async (newEmployee: EmployeeInsert): Promise<boolean> => {
		this.loadingCount++
		this.error = null
		try {
			await convex.mutation(api.payroll.add, { auth: authStore.token, ...newEmployee })
			return true
		} catch (err) {
			this.error = errorMessage(err, 'An error occurred while adding employee')
			console.error('Error adding employee:', err)
			return false
		} finally {
			this.loadingCount--
		}
	}

	updateEmployee = async (employeeId: EmployeeId, updates: EmployeeUpdate): Promise<boolean> => {
		this.loadingCount++
		this.error = null
		try {
			await convex.mutation(api.payroll.update, {
				auth: authStore.token,
				id: employeeId,
				...updates,
			})
			return true
		} catch (err) {
			this.error = errorMessage(err, 'An error occurred while updating employee')
			console.error('Error updating employee:', err)
			return false
		} finally {
			this.loadingCount--
		}
	}

	deleteEmployee = async (employeeId: EmployeeId): Promise<boolean> => {
		this.loadingCount++
		this.error = null
		try {
			await convex.mutation(api.payroll.remove, { auth: authStore.token, id: employeeId })
			return true
		} catch (err) {
			this.error = errorMessage(err, 'An error occurred while deleting employee')
			console.error('Error deleting employee:', err)
			return false
		} finally {
			this.loadingCount--
		}
	}

	getEmployeeById = (employeeId: string): Employee | undefined => {
		return this.employees.find((employee) => employee.id === employeeId)
	}

	searchEmployees = (query: string): Employee[] => {
		if (!query) return this.employees
		return this.employees.filter((employee) =>
			employee.name.toLowerCase().includes(query.toLowerCase()),
		)
	}

	// Malaysian contribution calculation functions
	calculateEPF = (salary: number) => {
		// EPF contribution rates: Employee 11%, Employer 12% for salary > RM5000
		// For salary <= RM5000: Employee 11%, Employer 13%
		const cappedSalary = Math.min(salary, 20000)

		let employeeContribution = 0
		let employerContribution = 0

		if (cappedSalary <= 10) {
			employeeContribution = 0
			employerContribution = 0
		} else if (cappedSalary <= 5000) {
			const roundedSalary = Math.ceil(cappedSalary / 20) * 20
			employeeContribution = Math.ceil(roundedSalary * 0.11)
			employerContribution = Math.ceil(roundedSalary * 0.13)
		} else if (cappedSalary <= 20000) {
			const roundedSalary = Math.ceil(cappedSalary / 100) * 100
			employeeContribution = Math.ceil(roundedSalary * 0.11)
			employerContribution = Math.ceil(roundedSalary * 0.12)
		} else {
			employeeContribution = Math.ceil(cappedSalary * 0.12)
			employerContribution = Math.ceil(cappedSalary * 0.12)
		}

		return {
			employee: employeeContribution,
			employer: employerContribution,
		}
	}

	private calculateSOCSO = (salary: number) => {
		// SOCSO rates based on official PERKESO table (2024) - Act 4
		// Updated ceiling: RM6000 (effective Oct 1, 2024)

		// Cap salary at RM6000
		const cappedSalary = Math.min(salary, 6000)

		let employeeContribution = 0
		let employerContribution = 0

		if (cappedSalary <= 30) {
			employeeContribution = 0.1
			employerContribution = 0.4
		} else if (cappedSalary <= 50) {
			employeeContribution = 0.2
			employerContribution = 0.7
		} else if (cappedSalary <= 70) {
			employeeContribution = 0.3
			employerContribution = 1.1
		} else if (cappedSalary <= 100) {
			employeeContribution = 0.4
			employerContribution = 1.5
		} else if (cappedSalary <= 140) {
			employeeContribution = 0.6
			employerContribution = 2.1
		} else if (cappedSalary <= 200) {
			employeeContribution = 0.85
			employerContribution = 2.95
		} else if (cappedSalary <= 300) {
			employeeContribution = 1.25
			employerContribution = 4.35
		} else {
			// For salaries above RM200, SOCSO follows a pattern:
			// Employee: RM0.50 per RM100 bracket
			// Employer: RM1.80, RM1.70 cycle per RM100 bracket
			const brackets = Math.min(Math.ceil(cappedSalary / 100), 60)
			employeeContribution = 1.25 + (brackets - 3) * 0.5
			let addOn = Math.floor((brackets - 3) / 2) * 3.5
			if ((brackets - 3) % 2 !== 0) {
				addOn += 1.8
			}
			employerContribution = 4.35 + addOn
		}

		return {
			employee: toCents(employeeContribution),
			employer: toCents(employerContribution),
		}
	}

	private calculateEIS = (salary: number) => {
		// EIS rates based on official PERKESO table (2024) - Act 800
		// Updated ceiling: RM6000 (effective Oct 1, 2024)

		// Cap salary at RM6000
		const cappedSalary = Math.min(salary, 6000)

		let contribution = 0

		if (cappedSalary <= 30) {
			contribution = 0.05
		} else if (cappedSalary <= 50) {
			contribution = 0.1
		} else if (cappedSalary <= 70) {
			contribution = 0.15
		} else if (cappedSalary <= 100) {
			contribution = 0.2
		} else if (cappedSalary <= 140) {
			contribution = 0.25
		} else if (cappedSalary <= 200) {
			contribution = 0.35
		} else {
			// For salaries above RM200, EIS follows a clear pattern:
			// RM0.20 per RM100 salary bracket
			// Formula: Math.ceil(salary / 100) * 0.20
			contribution = Math.ceil(cappedSalary / 100) * 0.2 - 0.1
		}

		contribution = toCents(contribution)
		return {
			employee: contribution,
			employer: contribution,
		}
	}

	// Lindung 24 Jam is only contributed from the June 2026 payroll onwards
	static readonly LINDUNG_24_START = { year: 2026, month: 6 }

	isLindung24Applicable = (year: number, month: number): boolean =>
		year > PayrollStore.LINDUNG_24_START.year ||
		(year === PayrollStore.LINDUNG_24_START.year && month >= PayrollStore.LINDUNG_24_START.month)

	calculateLindung24 = (salary: number) => {
		// Lindung 24 Jam / SKBBK (Non-Employment Injury Scheme) - Act 4, effective 1 June 2026.
		// Employee-only contribution; the employer contributes nothing but deducts and remits it.
		// Rates taken from PERKESO's official 65-band table (identical for both categories).
		// Ceiling: RM6000, giving a maximum of RM44.65.
		const cappedSalary = Math.min(salary, 6000)

		if (cappedSalary <= 0) {
			return 0
		} else if (cappedSalary <= 30) {
			return 0.2
		} else if (cappedSalary <= 50) {
			return 0.3
		} else if (cappedSalary <= 70) {
			return 0.5
		} else if (cappedSalary <= 100) {
			return 0.65
		} else if (cappedSalary <= 140) {
			return 0.9
		} else if (cappedSalary <= 200) {
			return 1.25
		}

		// Above RM200 the table runs in RM100 bands from RM1.85, alternating +RM0.80 / +RM0.70
		const brackets = Math.min(Math.ceil(cappedSalary / 100), 60)
		let addOn = Math.floor((brackets - 3) / 2) * 1.5
		if ((brackets - 3) % 2 !== 0) {
			addOn += 0.8
		}

		return toCents(1.85 + addOn)
	}

	generatePayrollData = (period: { year: number; month: number }): PayrollData[] => {
		const lindung24Applies = this.isLindung24Applicable(period.year, period.month)

		return this.employees.map((employee) => {
			const epf = this.calculateEPF(employee.basic_salary)
			const socso = this.calculateSOCSO(employee.basic_salary)
			const eis = this.calculateEIS(employee.basic_salary)
			const lindung24 =
				lindung24Applies && employee.lindung_24_jam
					? this.calculateLindung24(employee.basic_salary)
					: 0

			return {
				employeeId: employee.id,
				employeeName: employee.name,
				basicSalary: employee.basic_salary,
				pcb: 0,
				cp38: 0,
				epfEmployee: epf.employee,
				epfEmployer: employee.epf_employer, // Use database value instead of calculated
				socsoEmployee: socso.employee,
				socsoEmployer: socso.employer,
				eisEmployee: eis.employee,
				eisEmployer: eis.employer,
				lindung24,
			}
		})
	}

	calculateNetSalary = (payrollItem: PayrollData): number => {
		const totalDeductions =
			(payrollItem.pcb || 0) +
			(payrollItem.cp38 || 0) +
			(payrollItem.epfEmployee || 0) +
			(payrollItem.socsoEmployee || 0) +
			(payrollItem.eisEmployee || 0) +
			(payrollItem.lindung24 || 0)

		return toCents(payrollItem.basicSalary - totalDeductions)
	}

	// Subscription lifecycle
	private startSubscription = () => {
		if (this.unsubscribe) return

		let settled = false
		const settle = () => {
			if (settled) return
			settled = true
			this.loadingCount--
		}
		this.settleFirst = settle
		this.loadingCount++

		this.unsubscribe = convex.onUpdate(
			api.payroll.list,
			{ auth: authStore.token },
			(docs) => {
				this.employees = docs.map(withLegacy)
				this.error = null
				settle()
			},
			(err) => {
				this.error = errorMessage(err, 'An error occurred while fetching employees')
				console.error('Payroll subscription error:', err)
				settle()
			},
		)
	}

	// Initialize store by subscribing to the employee list
	initializeStore = async (): Promise<void> => {
		if (this.isInitialized) return
		this.isInitialized = true
		this.startSubscription()
	}

	// Cleanup: unsubscribe and reset state
	cleanup = () => {
		this.settleFirst?.()
		this.settleFirst = null
		this.unsubscribe?.()
		this.unsubscribe = null
		this.employees = []
		this.error = null
		this.isInitialized = false
	}
}

export const payrollStore = new PayrollStore()

// Re-export types for convenience
export type { PayrollData } from '$lib/types/payroll'
export type { Employee, EmployeeInsert, EmployeeUpdate }
