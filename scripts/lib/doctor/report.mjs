function countChecksByLevel(checks) {
  return checks.reduce(
    (summary, check) => {
      summary[check.level] = (summary[check.level] ?? 0) + 1;
      return summary;
    },
    { pass: 0, warn: 0, fail: 0, info: 0 }
  );
}

function buildDoctorStatusLine(result) {
  if (result.skipped) {
    return "INFO Starter repository detected; generated-app checks were skipped.";
  }

  return result.ok
    ? "PASS Generated app checks passed."
    : "FAIL Generated app checks found issues.";
}

function buildDoctorSummaryLine(summary) {
  return `Summary: ${summary.pass} pass, ${summary.warn} warn, ${summary.fail} fail, ${summary.info} info`;
}

export function buildDoctorReport(result) {
  const summary = countChecksByLevel(result.checks ?? []);
  const detailLines = (result.checks ?? []).map((check) => {
    const prefix =
      check.level === "pass" ? "PASS" : check.level === "warn" ? "WARN" : check.level === "info" ? "INFO" : "FAIL";
    return `${prefix} ${check.message}`;
  });

  return {
    ok: result.ok,
    skipped: result.skipped ?? false,
    summary,
    lines: [
      buildDoctorStatusLine(result),
      buildDoctorSummaryLine(summary),
      ...detailLines,
    ],
  };
}
