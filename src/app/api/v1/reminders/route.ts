import { createCollectionHandlers } from "@/lib/api/crud";
import { remindersConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(remindersConfig);
