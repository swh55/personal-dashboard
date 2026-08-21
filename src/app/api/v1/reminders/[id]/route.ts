import { createItemHandlers } from "@/lib/api/crud";
import { remindersConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(remindersConfig);
