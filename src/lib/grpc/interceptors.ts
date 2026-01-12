import type { Interceptor } from "@connectrpc/connect";

export const authInterceptor = (getToken: () => string | undefined): Interceptor => {
  return (next) => async (req) => {
    const token = getToken();
    if (token) {
      req.header.set("Authorization", `Bearer ${token}`);
    }
    return await next(req);
  };
};

export default authInterceptor;


