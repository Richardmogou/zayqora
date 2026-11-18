import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = ["zayqora_session", "zq_session"];

export function middleware(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/orders/:path*",
    "/menu/:path*",
    "/kitchen/:path*",
    "/reservations/:path*",
    "/inventory/:path*",
    "/notifications/:path*",
    "/customers/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/platform/:path*",
  ],
};
