export function ownerCondition(table: string): string {
  const plans = "SELECT id FROM plans WHERE owner_id=?";
  const tasks = `SELECT id FROM tasks WHERE plan_id IN (${plans})`;
  switch (table) {
    case "plans":
      return "owner_id=?";
    case "plan_revisions":
    case "tasks":
    case "reviews":
      return `plan_id IN (${plans})`;
    case "executions":
    case "timers":
    case "completions":
      return `task_id IN (${tasks})`;
    case "commands":
      return "owner_id=?";
    default:
      throw new Error("Unsupported ownership table");
  }
}
