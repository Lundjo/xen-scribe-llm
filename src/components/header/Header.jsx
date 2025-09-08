import React from "react";
import { useAuth } from "../../utils/AuthContext";

export default function Header() {
  const { user, signInWithGoogle, logout } = useAuth();

  return (
    <header className="flex items-center justify-between gap-4 p-4 bg-white/10 backdrop-blur-md shadow-md rounded-xl lg:w-[600px] mx-4 mt-4">
      <a href="/">
        <h1 className="text-2xl font-medium text-white/90 pl-2">
          Xen<span className="text-primary-400">Scribe</span>
        </h1>
      </a>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm hidden md:block">
                {user.displayName}
              </span>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200"
            >
              Odjavi se
            </button>
            <a
              href="/"
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200"
            >
              <i className="fa-solid fa-plus"></i>
              <p>Nova transkripcija</p>
            </a>
          </>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200"
          >
            <i className="fa-brands fa-google"></i>
            Prijavi se
          </button>
        )}
      </div>
    </header>
  );
}