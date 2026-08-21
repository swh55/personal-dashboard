import { createItemHandlers } from "@/lib/api/crud";
import { expensesConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(expensesConfig);
