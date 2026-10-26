import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createHistoryProvider } from "./server/provider";

export default function contribute(server: PluginServerContext) {
  server.registerProvider(createHistoryProvider());
  return () => {};
}
