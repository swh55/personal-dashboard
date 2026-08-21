import { createItemHandlers } from "@/lib/api/crud";
import { notesConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(notesConfig);
