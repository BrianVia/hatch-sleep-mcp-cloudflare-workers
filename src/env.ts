import type { HatchSession } from "./session.js";

export interface Env {
  HATCH_EMAIL: string;
  HATCH_PASSWORD: string;
  MCP_BEARER: string;
  HATCH_SESSION: DurableObjectNamespace<HatchSession>;
}

let current: Env;
export const setEnv = (value: Env) => { current = value; };
export const env = () => current;
