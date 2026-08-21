import { createCollectionHandlers } from "@/lib/api/crud";
import { budgetsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(budgetsConfig);
