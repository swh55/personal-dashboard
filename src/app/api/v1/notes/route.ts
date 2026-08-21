import { createCollectionHandlers } from "@/lib/api/crud";
import { notesConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(notesConfig);
