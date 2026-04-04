export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/bots/:path*",
    "/prices/:path*",
    "/sales/:path*",
    "/monitor/:path*",
    "/settings/:path*",
    "/simulations/:path*",
    "/tasks/:path*",
  ],
};
