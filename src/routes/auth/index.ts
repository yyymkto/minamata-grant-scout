import { Hono } from "hono";
import type { AppContextEnv } from "../../types";
import signup from "./signup";
import login from "./login";
import session from "./session";
import passwordReset from "./password-reset";
import emailVerification from "./email-verification";

const app = new Hono<AppContextEnv>()
  .route("/", signup)
  .route("/", login)
  .route("/", session)
  .route("/", passwordReset)
  .route("/", emailVerification);

export default app;
