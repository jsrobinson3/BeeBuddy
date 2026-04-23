import { schemaMigrations, addColumns } from "@nozbe/watermelondb/Schema/migrations";

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: "hives",
          columns: [
            { name: "install_kind", type: "string", isOptional: true },
            { name: "initial_frames", type: "number", isOptional: true },
            { name: "queen_introduced", type: "boolean", isOptional: true },
          ],
        }),
      ],
    },
  ],
});
