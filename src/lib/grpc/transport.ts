import { createGrpcWebTransport } from "@connectrpc/connect-web";

export type GrpcTransportOptions = {
  baseUrl?: string;
  useBinaryFormat?: boolean;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
};

export const createTransport = (opts?: GrpcTransportOptions) => {
  const {
    baseUrl = process.env.NEXT_PUBLIC_GRPC_BASE_URL,
    useBinaryFormat = true,
    credentials = "include",
    headers = {},
  } = opts || {};

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_GRPC_BASE_URL environment variable is not defined");
  }

  return createGrpcWebTransport({
    baseUrl,
    useBinaryFormat,
    interceptors: [],
    // Headers can be provided per-call via signal/headers; default extra headers here
    fetch: (input, init) => {
      const mergedInit = { ...init, credentials } as RequestInit & { headers?: HeadersInit };
      const initHeaders = new Headers(mergedInit.headers || {});
      Object.entries(headers).forEach(([k, v]) => initHeaders.set(k, v));
      mergedInit.headers = initHeaders;
      return fetch(input, mergedInit);
    },
  });
};

export default createTransport;


