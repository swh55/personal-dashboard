import { createCollectionHandlers } from "@/lib/api/crud";
import { tasksConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(tasksConfig);
