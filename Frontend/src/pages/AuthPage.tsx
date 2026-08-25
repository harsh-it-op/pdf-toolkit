import { Link, useLocation } from "react-router-dom";

export function AuthPage() {
  const { pathname } = useLocation();
  const isLogin = pathname.endsWith("/login");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {isLogin ? "Log in" : "Create an account"}
      </h1>
      <p className="mt-1 text-slate-600">
        {isLogin
          ? "Sign in to access your recent files and processing history."
          : "Save your preferences and process more files per day."}
      </p>
      <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input id="email" type="email" className="input mt-1" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input id="password" type="password" className="input mt-1" placeholder="••••••••" />
        </div>
        <button type="submit" className="btn-primary w-full">
          {isLogin ? "Log in" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        {isLogin ? (
          <>
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium text-brand-700 hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-brand-700 hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
      <p className="mt-6 text-center text-xs text-slate-400">
        Authentication is wired but not yet active. Anonymous use is fully supported.
      </p>
    </div>
  );
}
