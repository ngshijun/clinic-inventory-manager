/**
 * Item, supplier and employee names are kept in capitals, as unit names are, so one
 * name has one spelling. The forms raise the letters as they are typed and
 * the server raises them again, which is what an Excel sheet goes through.
 */
export const capitalName = (name: string): string => name.trim().toUpperCase()
