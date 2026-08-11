function elapsedSince(startedAt) {
  return Math.max(0, performance.now() - startedAt);
}

function formatMetric(metric) {
  return `${metric.name};dur=${metric.duration.toFixed(1)}`;
}

/**
 * Adds lightweight, non-sensitive timings to selected Route Handler responses.
 * Server-Timing is visible in browser DevTools and does not expose query text,
 * user data, credentials, or database connection details.
 */
export function startApiTiming(route) {
  const startedAt = performance.now();
  const metrics = [];

  return {
    async measure(name, operation) {
      const metricStartedAt = performance.now();
      try {
        return await operation();
      } finally {
        metrics.push({ name, duration: elapsedSince(metricStartedAt) });
      }
    },

    apply(response) {
      const allMetrics = [...metrics, { name: 'total', duration: elapsedSince(startedAt) }];
      response.headers.set('Server-Timing', allMetrics.map(formatMetric).join(', '));

      if (process.env.API_PERFORMANCE_LOGGING === 'true') {
        console.info(JSON.stringify({
          event: 'api_performance',
          route,
          timings: allMetrics.map(({ name, duration }) => ({ name, durationMs: Math.round(duration) }))
        }));
      }

      return response;
    }
  };
}
