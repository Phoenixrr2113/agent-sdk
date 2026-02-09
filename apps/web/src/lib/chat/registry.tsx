"use client"

/**
 * json-render React Registry
 *
 * Maps each catalog component to a Shadcn / Radix UI React implementation.
 * The `registry` export is used by `<Renderer />` to turn JSON specs into UI.
 *
 * @see catalog.ts for component definitions
 */
import { defineRegistry } from "@json-render/react"
import { catalog } from "./catalog"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { CodeBlock } from "@/components/ai-elements/code-block"
import { cn } from "@/libs/utils"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts"
import {
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  InfoIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
  FolderIcon,
  FileTextIcon,
  ChevronRightIcon,
  TerminalSquareIcon,
} from "lucide-react"

// ── Helpers ────────────────────────────────────────────────────────

const gapMap = { sm: "gap-2", md: "gap-4", lg: "gap-6" } as const
const paddingMap = { sm: "p-3", md: "p-5", lg: "p-7" } as const

function resolveGap(gap: string | null | undefined) {
  return gapMap[(gap ?? "md") as keyof typeof gapMap] ?? "gap-4"
}

function resolvePadding(padding: string | null | undefined) {
  return paddingMap[(padding ?? "md") as keyof typeof paddingMap] ?? "p-5"
}

const badgeVariantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  default: "default",
  success: "default",
  info: "secondary",
  warning: "outline",
  error: "destructive",
}

const badgeColorMap: Record<string, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  error: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
}

const alertIconMap: Record<string, typeof InfoIcon> = {
  info: InfoIcon,
  success: CheckCircle2Icon,
  warning: AlertTriangleIcon,
  error: XCircleIcon,
}

// ── Registry ───────────────────────────────────────────────────────

export const { registry, handlers, executeAction } = defineRegistry(catalog, {
  components: {
    // Layout
    Card: ({ props, children }) => {
      return (
        <Card className={cn(resolvePadding(props.padding))}>
          {(props.title || props.description) && (
            <CardHeader>
              {props.title && <CardTitle>{props.title}</CardTitle>}
              {props.description && (
                <CardDescription>{props.description}</CardDescription>
              )}
            </CardHeader>
          )}
          <CardContent>{children}</CardContent>
        </Card>
      )
    },

    Row: ({ props, children }) => (
      <div
        className={cn(
          "flex flex-wrap",
          resolveGap(props.gap),
          props.align === "center" && "items-center",
          props.align === "end" && "items-end",
          props.align === "stretch" && "items-stretch",
          props.align === "start" && "items-start",
          props.wrap === false && "flex-nowrap",
        )}
      >
        {children}
      </div>
    ),

    Column: ({ props, children }) => (
      <div
        className={cn(
          "flex flex-col",
          resolveGap(props.gap),
          props.align === "center" && "items-center",
          props.align === "end" && "items-end",
          props.align === "stretch" && "items-stretch",
          props.align === "start" && "items-start",
        )}
      >
        {children}
      </div>
    ),

    // Data Display
    Metric: ({ props }) => {
      const TrendIcon =
        props.trend === "up"
          ? TrendingUpIcon
          : props.trend === "down"
            ? TrendingDownIcon
            : MinusIcon

      return (
        <div className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-lg border bg-card p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {props.label}
          </span>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-foreground">
              {props.value}
            </span>
            {props.trend && props.trendValue && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  props.trend === "up" && "text-emerald-500",
                  props.trend === "down" && "text-red-500",
                  props.trend === "neutral" && "text-muted-foreground",
                )}
              >
                <TrendIcon className="size-3" />
                {props.trendValue}
              </span>
            )}
          </div>
        </div>
      )
    },

    Table: ({ props }) => (
      <div className="rounded-lg border">
        <Table>
          {props.caption && <TableCaption>{props.caption}</TableCaption>}
          <TableHeader>
            <TableRow>
              {props.columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                  )}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rows.map((row, i) => (
              <TableRow key={`row-${i}`}>
                {props.columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                    )}
                  >
                    {row[col.key] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    ),

    StatusBadge: ({ props }) => {
      const variant = badgeVariantMap[props.variant ?? "default"] ?? "default"
      const colorClass = badgeColorMap[props.variant ?? "default"]

      return (
        <Badge variant={variant} className={cn(colorClass)}>
          {props.label}
        </Badge>
      )
    },

    ProgressBar: ({ props }) => (
      <div className="flex flex-col gap-1.5">
        {props.label && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{props.label}</span>
            <span>{props.value}%</span>
          </div>
        )}
        <Progress value={props.value} />
      </div>
    ),

    // Typography
    Heading: ({ props }) => {
      const level = props.level ?? "3"
      const sizes: Record<string, string> = {
        "1": "text-2xl font-bold",
        "2": "text-xl font-semibold",
        "3": "text-lg font-semibold",
        "4": "text-base font-medium",
      }
      const className = cn(sizes[level] ?? sizes["3"], "text-foreground")
      switch (level) {
        case "1":
          return <h1 className={className}>{props.text}</h1>
        case "2":
          return <h2 className={className}>{props.text}</h2>
        case "4":
          return <h4 className={className}>{props.text}</h4>
        default:
          return <h3 className={className}>{props.text}</h3>
      }
    },

    Text: ({ props }) => {
      if (props.variant === "code") {
        return (
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground">
            {props.content}
          </code>
        )
      }
      return (
        <p
          className={cn(
            "text-foreground",
            props.variant === "caption" && "text-xs text-muted-foreground",
          )}
        >
          {props.content}
        </p>
      )
    },

    // Code
    CodeBlock: ({ props }) => (
      <CodeBlock
        code={props.code}
        language={(props.language ?? "text") as import("shiki").BundledLanguage}
        title={props.filename ?? undefined}
      />
    ),

    Terminal: ({ props }) => (
      <div className="rounded-lg border bg-zinc-950 text-zinc-100 font-mono text-sm overflow-hidden">
        {(props.title || props.command) && (
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
            <TerminalSquareIcon className="size-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-400">
              {props.title ?? "Terminal"}
            </span>
          </div>
        )}
        <div className="p-4 space-y-1">
          {props.command && (
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 select-none">$</span>
              <span className="text-zinc-200">{props.command}</span>
            </div>
          )}
          <pre className="whitespace-pre-wrap text-zinc-300 leading-relaxed">
            {props.output}
          </pre>
        </div>
      </div>
    ),

    FileTree: ({ props }) => (
      <div className="rounded-lg border bg-card">
        {props.title && (
          <div className="border-b px-4 py-2 text-sm font-medium text-foreground">
            {props.title}
          </div>
        )}
        <div className="py-1">
          {props.items.map((item, i) => {
            const isDir = item.type === "directory"
            const Icon = isDir ? FolderIcon : FileTextIcon
            return (
              <div
                key={`${item.name}-${i}`}
                className="flex items-center gap-1.5 px-3 py-1 text-sm hover:bg-muted/50"
                style={{ paddingLeft: `${12 + item.depth * 16}px` }}
              >
                {isDir && (
                  <ChevronRightIcon className="size-3 text-muted-foreground" />
                )}
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isDir
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    isDir ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    ),

    // Charts
    Chart: ({ props }) => {
      const DEFAULT_COLORS = [
        "hsl(210 80% 55%)",
        "hsl(150 60% 45%)",
        "hsl(340 75% 55%)",
        "hsl(45 90% 55%)",
        "hsl(280 65% 55%)",
      ]

      const config: ChartConfig = Object.fromEntries(
        props.valueKeys.map((vk, i) => [
          vk.key,
          {
            label: vk.label,
            color: vk.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
          },
        ]),
      )

      // Parse numeric values from string data
      const numericData = props.data.map((row) => {
        const parsed: Record<string, unknown> = {
          [props.categoryKey]: row[props.categoryKey],
        }
        for (const vk of props.valueKeys) {
          const raw = row[vk.key]
          parsed[vk.key] = raw ? Number(raw) : 0
        }
        return parsed
      })

      const renderChart = () => {
        switch (props.type) {
          case "bar":
            return (
              <BarChart data={numericData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey={props.categoryKey}
                  tickLine={false}
                  axisLine={false}
                  label={
                    props.xAxisLabel
                      ? { value: props.xAxisLabel, position: "bottom" }
                      : undefined
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  label={
                    props.yAxisLabel
                      ? {
                        value: props.yAxisLabel,
                        angle: -90,
                        position: "insideLeft",
                      }
                      : undefined
                  }
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {props.valueKeys.map((vk) => (
                  <Bar
                    key={vk.key}
                    dataKey={vk.key}
                    fill={`var(--color-${vk.key})`}
                    radius={4}
                  />
                ))}
              </BarChart>
            )

          case "line":
            return (
              <LineChart data={numericData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey={props.categoryKey}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {props.valueKeys.map((vk) => (
                  <Line
                    key={vk.key}
                    type="monotone"
                    dataKey={vk.key}
                    stroke={`var(--color-${vk.key})`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            )

          case "pie":
            return (
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={numericData}
                  dataKey={props.valueKeys[0]?.key ?? "value"}
                  nameKey={props.categoryKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {numericData.map((_, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            )

          default:
            return null
        }
      }

      return (
        <div className="space-y-2">
          {props.title && (
            <h4 className="text-sm font-semibold text-foreground">
              {props.title}
            </h4>
          )}
          <ChartContainer config={config} className="h-[250px] w-full">
            {renderChart()!}
          </ChartContainer>
        </div>
      )
    },

    // Feedback
    Alert: ({ props }) => {
      const variant = props.variant ?? "info"
      const Icon = alertIconMap[variant] ?? InfoIcon
      return (
        <Alert
          variant={variant === "error" ? "destructive" : "default"}
          className={cn(
            variant === "success" && "border-emerald-500/30 bg-emerald-500/5",
            variant === "warning" && "border-amber-500/30 bg-amber-500/5",
            variant === "info" && "border-blue-500/30 bg-blue-500/5",
          )}
        >
          <Icon className="size-4" />
          <AlertTitle>{props.title}</AlertTitle>
          {props.message && (
            <AlertDescription>{props.message}</AlertDescription>
          )}
        </Alert>
      )
    },

    Divider: ({ props }) => {
      if (props.label) {
        return (
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs font-medium text-muted-foreground">
              {props.label}
            </span>
            <Separator className="flex-1" />
          </div>
        )
      }
      return <Separator />
    },

    // Interactive
    Button: ({ props, onAction }) => (
      <Button
        variant={(props.variant as "default" | "secondary" | "outline" | "destructive") ?? "default"}
        onClick={() => onAction?.({ name: props.action })}
        size="sm"
      >
        {props.label}
      </Button>
    ),
  },

  // ── Actions ──────────────────────────────────────────────────────
  actions: {
    copy_to_clipboard: async (params) => {
      if (!params) return
      await navigator.clipboard.writeText(params.text)
    },
    navigate: async (params) => {
      if (!params) return
      window.location.href = params.url
    },
    refresh_data: async () => {
      window.location.reload()
    },
  },
})
