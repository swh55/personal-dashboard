import { createCollectionHandlers } from "@/lib/api/crud";
import { habitsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(habitsConfig);
