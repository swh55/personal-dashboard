import { createCollectionHandlers } from "@/lib/api/crud";
import { projectsConfig } from "@/lib/api/entities";

export const { GET, POST } = createCollectionHandlers(projectsConfig);
