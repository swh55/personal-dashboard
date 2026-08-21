import { createCollectionHandlers } from "@/lib/api/crud";
import { medicationsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(medicationsConfig);
