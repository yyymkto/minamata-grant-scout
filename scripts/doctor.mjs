#!/usr/bin/env node

import { emitDoctorResult, parseDoctorCliArgs, runDoctor } from "./lib/doctor/cli.mjs";

const options = parseDoctorCliArgs();
const result = await runDoctor();
emitDoctorResult(result, options);
process.exit(result.ok ? 0 : 1);
