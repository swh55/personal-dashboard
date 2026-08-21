import { createItemHandlers } from "@/lib/api/crud";
import { projectsConfig } from "@/lib/api/entities";

export const { GET, PATCH, DELETE } = createItemHandlers(projectsConfig);
