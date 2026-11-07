"use client";

import { useSession, signUp, signIn, signOut } from "@/lib/auth-client";
import { ErrorContext } from "better-auth/react";
import { useState } from "react";

export default function TestAuthPage() {
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const { data, error } = await signUp.email({
      email,
      password,
      name,
    }, {
      onRequest: () => setMessage("Signing up..."),
      onSuccess: () => setMessage("Sign up successful!"),
      onError: (ctx) => {
        setMessage(`Error: ${ctx.error.message || "Sign up failed"}`);
      }
    });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const { data, error } = await signIn.email({
      email,
      password,
    }, {
      onRequest: () => setMessage("Signing in..."),
      onSuccess: () => setMessage("Sign in successful!"),
      onError: (ctx) => {
        setMessage(`Error: ${ctx.error.message || "Sign in failed"}`);
      }
    });
  };

  const handleSignOut = async () => {
    setMessage("Signing out...");
    
    try {
      await signOut();
      setMessage("Signed out successfully!");
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Sign out failed"}`);
    }
  };

  const handleGoogleSignIn = async () => {
    setMessage("");

    await signIn.social({
      provider: "google",
      callbackURL: "/test-auth",
    }, {
      onRequest: () => setMessage("Signing in with Google..."),
      onSuccess: () => setMessage("Google sign in successful!"),
      onError: (ctx) => {
        setMessage(`Google sign in error: ${ctx.error.message || "Google sign in failed"}`);
      }
    });
  };

  if (isPending) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Authentication Test</h1>
      
      {message && (
        <div className="mb-4 p-4 bg-gray-100 border rounded">
          {message}
        </div>
      )}

      {session ? (
        <div className="mb-8 p-4 bg-green-100 border border-green-300 rounded">
          <h2 className="text-xl font-semibold mb-2">You are signed in!</h2>
          <p><strong>Name:</strong> {session.user.name}</p>
          <p><strong>Email:</strong> {session.user.email}</p>
          <p><strong>ID:</strong> {session.user.id}</p>
          <button
            onClick={handleSignOut}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="mb-8 p-4 bg-yellow-100 border border-yellow-300 rounded">
          <h2 className="text-xl font-semibold mb-2">You are not signed in</h2>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Sign Up</h2>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-rose-500 text-white rounded hover:bg-rose-600"
            >
              Sign Up
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Sign In</h2>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
