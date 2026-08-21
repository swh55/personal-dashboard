import { createCollectionHandlers } from "@/lib/api/crud";
import { expensesConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(expensesConfig);
