/**
 * Placeholder hooks for future OpenTelemetry instrumentation.
 * Call sites can depend on this interface without pulling OTEL infra into the MVP.
 */
export type SpanStatus = 'ok' | 'error';

export interface TracingHooks {
  startSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>,
  ): void;
  endSpan(name: string, status?: SpanStatus): void;
  recordException(name: string, error: unknown): void;
}

export const noopTracing: TracingHooks = {
  startSpan() {
    // Intentionally empty — wire OpenTelemetry later.
  },
  endSpan() {
    // Intentionally empty — wire OpenTelemetry later.
  },
  recordException() {
    // Intentionally empty — wire OpenTelemetry later.
  },
};

export const tracing: TracingHooks = noopTracing;
