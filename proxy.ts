import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
    if (isProtectedRoute(request)) {
      await auth.protect();
    }
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  },
);

export const config = {
  matcher: ["/dashboard(.*)", "/api/uploadthing(.*)"],
};
