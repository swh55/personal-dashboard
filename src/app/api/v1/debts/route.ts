import { createCollectionHandlers } from "@/lib/api/crud";
import { debtsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(debtsConfig);
