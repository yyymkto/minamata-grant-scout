import { defineRecord } from "../lib/record-def";

export const taskDef = defineRecord({
  key: "tasks",
  label: "Task",
  tableName: "tasks",
  fields: {
    title: { type: "text", label: "Title", required: true, maxLength: 200 },
    description: { type: "text", label: "Description", multiline: true },
    dueDate: { type: "date", label: "Due Date" },
    priority: {
      type: "select",
      label: "Priority",
      required: true,
      options: ["low", "medium", "high"] as const,
      defaultValue: "medium",
    },
  },
  status: {
    field: "status",
    label: "Status",
    options: ["open", "in_progress", "done"] as const,
    defaultValue: "open",
  },
  listView: {
    columns: ["title", "priority", "status", "dueDate"],
    defaultSort: { field: "status", direction: "asc" },
  },
  formView: {
    sections: [
      { label: "Basic", fields: ["title", "description"] },
      { label: "Schedule", fields: ["dueDate", "priority"] },
    ],
  },
});
