/**
 * json-render Component Catalog
 *
 * Defines the guardrailed set of UI components the AI agent can generate.
 * Each component maps to a Shadcn/Radix UI component via the registry.
 *
 * @see registry.tsx for React implementations
 */
import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react"
import { z } from "zod"

export const catalog = defineCatalog(schema, {
  components: {
    // ── Layout ──────────────────────────────────────────────────────
    Card: {
      props: z.object({
        title: z.string().describe("Card heading"),
        description: z.string().nullable().describe("Optional subtitle"),
        padding: z.enum(["sm", "md", "lg"]).nullable().describe("Padding size"),
      }),
      slots: ["default"],
      description:
        "Container card for grouping content. Use as root or section wrapper.",
    },

    Row: {
      props: z.object({
        gap: z.enum(["sm", "md", "lg"]).nullable().describe("Gap between items"),
        align: z.enum(["start", "center", "end", "stretch"]).nullable(),
        wrap: z.boolean().nullable().describe("Whether items wrap"),
      }),
      slots: ["default"],
      description:
        "Horizontal flex row for side-by-side layout of children.",
    },

    Column: {
      props: z.object({
        gap: z.enum(["sm", "md", "lg"]).nullable().describe("Gap between items"),
        align: z.enum(["start", "center", "end", "stretch"]).nullable(),
      }),
      slots: ["default"],
      description: "Vertical flex column for stacked layout.",
    },

    // ── Data Display ───────────────────────────────────────────────
    Metric: {
      props: z.object({
        label: z.string().describe("Metric label"),
        value: z.string().describe("Displayed value (pre-formatted)"),
        format: z.enum(["currency", "percent", "number", "text"]).nullable(),
        trend: z.enum(["up", "down", "neutral"]).nullable(),
        trendValue: z.string().nullable().describe("e.g. +12%"),
      }),
      description:
        "Display a single KPI / metric with optional trend indicator.",
    },

    Table: {
      props: z.object({
        columns: z
          .array(
            z.object({
              key: z.string(),
              label: z.string(),
              align: z.enum(["left", "center", "right"]).nullable(),
            }),
          )
          .describe("Column definitions"),
        rows: z
          .array(z.record(z.string(), z.string()))
          .describe("Array of row objects keyed by column key"),
        caption: z.string().nullable(),
      }),
      description: "Data table with columns and rows.",
    },

    StatusBadge: {
      props: z.object({
        label: z.string(),
        variant: z
          .enum(["default", "success", "warning", "error", "info"])
          .nullable(),
      }),
      description: "Colored status badge / pill.",
    },

    ProgressBar: {
      props: z.object({
        value: z.number().min(0).max(100).describe("0–100"),
        label: z.string().nullable(),
      }),
      description: "Progress bar showing percentage completion.",
    },

    // ── Typography ─────────────────────────────────────────────────
    Heading: {
      props: z.object({
        text: z.string(),
        level: z.enum(["1", "2", "3", "4"]).nullable(),
      }),
      description: "Section heading. Defaults to h3 if level omitted.",
    },

    Text: {
      props: z.object({
        content: z.string(),
        variant: z.enum(["body", "caption", "code"]).nullable(),
      }),
      description: "Block of text or inline code.",
    },

    // ── Code ───────────────────────────────────────────────────────
    CodeBlock: {
      props: z.object({
        code: z.string(),
        language: z.string().nullable(),
        filename: z.string().nullable(),
      }),
      description: "Syntax-highlighted code block.",
    },

    Terminal: {
      props: z.object({
        output: z.string().describe("Terminal / command output text"),
        command: z.string().nullable().describe("The command that produced the output"),
        title: z.string().nullable().describe("Terminal window title"),
      }),
      description:
        "Terminal output display with command prompt styling. Use for shell output, logs, or CLI results.",
    },

    FileTree: {
      props: z.object({
        items: z
          .array(
            z.object({
              name: z.string(),
              type: z.enum(["file", "directory"]),
              depth: z.number().describe("Nesting depth (0 = root)"),
              icon: z.string().nullable().describe("Optional icon hint"),
            }),
          )
          .describe("Flat list of file tree entries with depth for indentation"),
        title: z.string().nullable(),
      }),
      description:
        "Hierarchical file/directory tree display. Use for project structures, search results.",
    },

    // ── Charts ─────────────────────────────────────────────────────
    Chart: {
      props: z.object({
        type: z.enum(["bar", "line", "pie"]).describe("Chart type"),
        title: z.string().nullable(),
        xAxisLabel: z.string().nullable(),
        yAxisLabel: z.string().nullable(),
        data: z
          .array(z.record(z.string(), z.string()))
          .describe("Array of data points. Each object has a category key and one or more value keys."),
        categoryKey: z.string().describe("Key in data objects used for the x-axis / category"),
        valueKeys: z
          .array(
            z.object({
              key: z.string(),
              label: z.string(),
              color: z.string().nullable().describe("CSS color, e.g. hsl(210 80% 55%)"),
            }),
          )
          .describe("Which data keys to plot as series"),
      }),
      description:
        "Data chart (bar, line, or pie). Provide data array and specify which keys to plot.",
    },

    // ── Feedback ───────────────────────────────────────────────────
    Alert: {
      props: z.object({
        title: z.string(),
        message: z.string().nullable(),
        variant: z.enum(["info", "success", "warning", "error"]).nullable(),
      }),
      description:
        "Alert / callout banner for important messages or status updates.",
    },

    Divider: {
      props: z.object({
        label: z.string().nullable().describe("Optional inline label"),
      }),
      description: "Horizontal divider / separator.",
    },

    // ── Interactive ────────────────────────────────────────────────
    Button: {
      props: z.object({
        label: z.string(),
        action: z.string().describe("Action name from catalog"),
        variant: z.enum(["default", "secondary", "outline", "destructive"]).nullable(),
      }),
      description: "Clickable button that dispatches a named action.",
    },
  },

  // ── Actions ────────────────────────────────────────────────────
  actions: {
    copy_to_clipboard: {
      params: z.object({
        text: z.string().describe("Text to copy"),
      }),
      description: "Copy text to the user's clipboard",
    },
    navigate: {
      params: z.object({
        url: z.string().describe("URL or route to navigate to"),
      }),
      description: "Navigate to a URL or in-app route",
    },
    refresh_data: {
      params: z.object({}),
      description: "Refresh the current data context",
    },
  },
})

/**
 * Generate system prompt supplement that teaches the AI about
 * available generative UI components.
 */
export function getCatalogSystemPrompt(): string {
  return catalog.prompt({
    customRules: [
      "Use Card as the root container for dashboards and reports.",
      "Use Row for horizontal layouts (e.g. side-by-side metrics).",
      "Use Column for vertical stacking.",
      "Prefer Metric components for KPIs over raw text.",
      "Use Table for structured data with more than 3 records.",
      "Use Chart for visual data — bar for comparisons, line for trends, pie for distributions.",
      "Use Terminal to display shell output, log excerpts, or CLI results.",
      "Use FileTree to show project structures or file search results.",
      "Use StatusBadge inside Tables for status columns.",
      "Always provide a meaningful title on Cards.",
      "Keep generated UIs focused — max 20 elements per response.",
    ],
  })
}
