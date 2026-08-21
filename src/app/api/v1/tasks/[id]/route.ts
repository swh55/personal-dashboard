import { createItemHandlers } from "@/lib/api/crud";
import { tasksConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(tasksConfig);
