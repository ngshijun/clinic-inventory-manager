import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import { MANAGER, REQUESTER, setup } from './test.helpers'

const amounts = {
	basic_salary: 2000,
	epf_employee: 220,
	epf_employer: 260,
	socso_employee: 9.75,
	socso_employer: 34.15,
	eis_employee: 3.9,
	eis_employer: 3.9,
	lindung_24_jam: 0,
	pcb: 0,
	cp38: 0,
	net_salary: 1766.35,
}

describe('payrollRuns.save', () => {
	test('amounts are stored to the sen', async () => {
		const t = setup()

		const run = await t.mutation(api.payrollRuns.save, {
			auth: MANAGER,
			year: 2026,
			month: 10,
			items: [{ employee_name: 'Siti', ...amounts, eis_employee: 9.500000000000002 }],
		})

		const [row] = await t.query(api.payrollRuns.items, { auth: MANAGER, run_id: run._id })
		expect(row.eis_employee).toBe(9.5)
	})

	test("saving a month again replaces that month's rows", async () => {
		const t = setup()
		const first = await t.mutation(api.payrollRuns.save, {
			auth: MANAGER,
			year: 2026,
			month: 10,
			items: [
				{ employee_name: 'Siti', ...amounts },
				{ employee_name: 'Ahmad', ...amounts },
			],
		})

		const second = await t.mutation(api.payrollRuns.save, {
			auth: MANAGER,
			year: 2026,
			month: 10,
			items: [{ employee_name: 'Siti', ...amounts, basic_salary: 2100 }],
		})

		expect(second._id).toBe(first._id)
		const rows = await t.query(api.payrollRuns.items, { auth: MANAGER, run_id: second._id })
		expect(rows.map((r) => [r.employee_name, r.basic_salary])).toEqual([['Siti', 2100]])
	})

	test('the requester password cannot see or save payroll', async () => {
		const t = setup()

		await expect(
			t.mutation(api.payrollRuns.save, { auth: REQUESTER, year: 2026, month: 10, items: [] }),
		).rejects.toThrow(/requires the manager role/)
		await expect(t.query(api.payrollRuns.list, { auth: REQUESTER })).rejects.toThrow(
			/requires the manager role/,
		)
	})
})
