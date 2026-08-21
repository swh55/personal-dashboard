import { createCollectionHandlers } from "@/lib/api/crud";
import { assetsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(assetsConfig);
