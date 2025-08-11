export const percent = (totalClaims:number, count: number) =>
      totalClaims > 0 ? ((count / totalClaims) * 100).toFixed(2) : '0.00';

export const subtractMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}