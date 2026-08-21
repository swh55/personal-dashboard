import { createCollectionHandlers } from "@/lib/api/crud";
import { pantryConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(pantryConfig);
